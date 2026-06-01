"""Derive the Phase 0 results bundle from a fitted Meridian model.

Produces ``results.json`` with every headline output the Results and Signal
screens need, each carrying a credible interval (never a bare point estimate):

  - channel_contribution : incremental outcome + ROI per channel (median + CI) + contribution %
  - marginal_roi         : return on the next dollar per channel (median + CI)
  - response_curves      : saturation curve points per channel
  - budget_optimization  : Meridian's optimal allocation vs. the current plan
  - model_health         : R-hat convergence, holdout MAPE / R², training window

We compute credible intervals directly from posterior draws with numpy
(robust to xarray coordinate renames across Meridian versions) and also keep
the analyzer's own xarray summaries as ``raw`` for completeness.
"""
from __future__ import annotations

import datetime as dt
import json
import logging

import numpy as np

from meridian.analysis import analyzer, optimizer

from .config import RunnerConfig

log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _ci_bounds(confidence_level: float) -> tuple[float, float]:
    tail = (1.0 - confidence_level) / 2.0
    return tail, 1.0 - tail


def _channel_intervals(draws, channels, cfg: RunnerConfig) -> list[dict]:
    """Per-channel median/mean + credible interval from posterior draws.

    ``draws`` is expected to have its channel dimension last, e.g. shape
    (n_chains, n_draws, n_channels). Earlier dims are flattened into samples.
    """
    arr = np.asarray(draws, dtype=float)
    arr = arr.reshape(-1, arr.shape[-1])  # (samples, n_channels)
    lo_q, hi_q = _ci_bounds(cfg.confidence_level)
    out = []
    for i, ch in enumerate(channels):
        col = arr[:, i]
        out.append(
            {
                "channel_id": ch,
                "channel": cfg.display_name(ch),
                "median": float(np.median(col)),
                "mean": float(np.mean(col)),
                "ci_lo": float(np.quantile(col, lo_q)),
                "ci_hi": float(np.quantile(col, hi_q)),
            }
        )
    return out


def _ds_records(ds, max_rows: int | None = None) -> list[dict]:
    """Flatten an xarray Dataset to JSON-safe records (NaN -> null)."""
    df = ds.to_dataframe().reset_index()
    if max_rows is not None:
        df = df.head(max_rows)
    return json.loads(df.to_json(orient="records"))


def _media_channels(mmm) -> list[str]:
    return [str(c) for c in np.asarray(mmm.input_data.media_channels)]


# --------------------------------------------------------------------------- #
# sections
# --------------------------------------------------------------------------- #
def channel_contribution(az, mmm, cfg: RunnerConfig) -> list[dict]:
    channels = _media_channels(mmm)
    incremental = az.incremental_outcome(use_posterior=True, include_non_paid_channels=False)
    roi = az.roi(use_posterior=True)

    inc = _channel_intervals(incremental, channels, cfg)
    roi_rows = {r["channel_id"]: r for r in _channel_intervals(roi, channels, cfg)}

    total = sum(max(r["median"], 0.0) for r in inc) or 1.0
    rows = []
    for r in inc:
        roi_r = roi_rows.get(r["channel_id"], {})
        rows.append(
            {
                "channel_id": r["channel_id"],
                "channel": r["channel"],
                "incremental_outcome": {
                    "median": r["median"], "ci_lo": r["ci_lo"], "ci_hi": r["ci_hi"],
                },
                "contribution_pct": round(100.0 * max(r["median"], 0.0) / total, 2),
                "roi": {
                    "median": roi_r.get("median"),
                    "ci_lo": roi_r.get("ci_lo"),
                    "ci_hi": roi_r.get("ci_hi"),
                },
            }
        )
    return rows


def marginal_roi(az, mmm, cfg: RunnerConfig) -> list[dict]:
    channels = _media_channels(mmm)
    mroi = az.marginal_roi(use_posterior=True)
    return _channel_intervals(mroi, channels, cfg)


def response_curves(az, cfg: RunnerConfig) -> dict:
    rc = az.response_curves(confidence_level=cfg.confidence_level)
    return {
        "confidence_level": cfg.confidence_level,
        "points": _ds_records(rc, max_rows=2000),
    }


def budget_optimization(mmm, cfg: RunnerConfig) -> dict:
    bo = optimizer.BudgetOptimizer(mmm)
    kwargs = {}
    if cfg.optimizer_budget is not None:
        kwargs["budget"] = cfg.optimizer_budget
    res = bo.optimize(**kwargs)  # fixed_budget=True by default

    optimized = _ds_records(res.optimized_data)
    nonoptimized = _ds_records(res.nonoptimized_data)

    def _total_incremental(records: list[dict]) -> float | None:
        vals = [r.get("incremental_outcome") for r in records if r.get("incremental_outcome") is not None]
        return float(sum(vals)) if vals else None

    opt_total = _total_incremental(optimized)
    non_total = _total_incremental(nonoptimized)
    lift = None
    if opt_total is not None and non_total is not None:
        lift = {
            "optimized": opt_total,
            "current": non_total,
            "delta": opt_total - non_total,
            "delta_pct": round(100.0 * (opt_total - non_total) / non_total, 2) if non_total else None,
        }

    return {
        "fixed_budget": True,
        "budget": cfg.optimizer_budget,
        "confidence_level": cfg.confidence_level,
        "optimized": optimized,
        "nonoptimized": nonoptimized,
        "total_incremental_lift": lift,
    }


def model_health(az, cfg: RunnerConfig, data) -> dict:
    health: dict = {"confidence_level": cfg.confidence_level}

    # R-hat convergence
    try:
        rhat_df = az.rhat_summary()
        health["rhat"] = json.loads(rhat_df.to_json(orient="records"))
        rhat_col = next((c for c in rhat_df.columns if "rhat" in c.lower()), None)
        if rhat_col is not None:
            health["max_rhat"] = float(rhat_df[rhat_col].max())
    except Exception as e:  # noqa: BLE001 - diagnostics are best-effort
        log.warning("rhat_summary failed: %s", e)

    # Predictive accuracy (R-squared, MAPE, wMAPE; Train/Test if holdout set)
    try:
        pa = az.predictive_accuracy()
        records = _ds_records(pa)
        health["predictive_accuracy"] = records
        health.update(_extract_headline_accuracy(records))
    except Exception as e:  # noqa: BLE001
        log.warning("predictive_accuracy failed: %s", e)

    # Training window
    try:
        times = [str(t) for t in np.asarray(data.kpi.coords["time"])]
        health["training_window"] = {
            "start": times[0],
            "end": times[-1],
            "n_weeks": len(times),
            "holdout_weeks": cfg.holdout_weeks,
        }
    except Exception as e:  # noqa: BLE001
        log.warning("training window extraction failed: %s", e)

    return health


def _extract_headline_accuracy(records: list[dict]) -> dict:
    """Best-effort pull of a single MAPE / R² number for the UI headline."""
    out: dict = {}
    if not records:
        return out

    def _pick(metric_key: str):
        # Prefer national-level Test split, else national All-Data, else any.
        cands = []
        for r in records:
            blob = " ".join(str(v).lower() for v in r.values())
            val = None
            for k, v in r.items():
                if metric_key in k.lower() and isinstance(v, (int, float)):
                    val = v
            if val is None:
                continue
            score = 0
            if "test" in blob:
                score += 2
            if "national" in blob:
                score += 1
            cands.append((score, val))
        if not cands:
            return None
        cands.sort(key=lambda x: x[0], reverse=True)
        return float(cands[0][1])

    mape = _pick("mape")
    r2 = _pick("r-squared") or _pick("r_squared") or _pick("rsquared")
    if mape is not None:
        out["mape"] = mape
    if r2 is not None:
        out["r_squared"] = r2
    return out


# --------------------------------------------------------------------------- #
# orchestration
# --------------------------------------------------------------------------- #
def build_results(mmm, data, cfg: RunnerConfig) -> dict:
    az = analyzer.Analyzer(mmm)
    log.info("Deriving results bundle (confidence_level=%.2f)", cfg.confidence_level)

    results = {
        "meta": {
            "client": cfg.client_name,
            "generated_at": dt.datetime.utcnow().isoformat() + "Z",
            "dataset": cfg.csv_path,
            "library": "google-meridian",
            "sampler": {
                "n_chains": cfg.n_chains,
                "n_adapt": cfg.n_adapt,
                "n_burnin": cfg.n_burnin,
                "n_keep": cfg.n_keep,
                "method": "NUTS",
            },
            "confidence_level": cfg.confidence_level,
            "channel_display_names": {c: cfg.display_name(c) for c in cfg.media_channels},
            "disclaimer": (
                "Fictional demo client. Numbers are genuine Meridian posterior "
                "outputs trained on Google's public simulated dataset."
            ),
        },
        "channel_contribution": channel_contribution(az, mmm, cfg),
        "marginal_roi": marginal_roi(az, mmm, cfg),
        "response_curves": response_curves(az, cfg),
        "budget_optimization": budget_optimization(mmm, cfg),
        "model_health": model_health(az, cfg, data),
    }
    return results


def write_results(results: dict, path: str) -> str:
    with open(path, "w") as f:
        json.dump(results, f, indent=2, allow_nan=False)
    log.info("Wrote results bundle to %s", path)
    return path
