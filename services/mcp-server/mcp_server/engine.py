"""The MMM analysis engine — pure functions over the posterior results bundle.

Every method returns model-grounded values with credible intervals. This module
has no Meridian / TensorFlow dependency (it reads results.json), so it is fast,
cheap to host, and fully unit-testable without a GPU.
"""
from __future__ import annotations

import math
from typing import Any


def _pct(cl: float) -> int:
    return round(cl * 100)


class MMMEngine:
    def __init__(self, results: dict):
        self.r = results or {}
        self.meta = self.r.get("meta", {})
        self.cl = float(self.meta.get("confidence_level", 0.9))
        # id -> display name (Channel0 -> "Meta")
        self.names: dict[str, str] = self.meta.get("channel_display_names", {})
        # lookup accepts either the display name or the raw id, case-insensitively
        self._lookup = {}
        for cid, disp in self.names.items():
            self._lookup[cid.lower()] = cid
            self._lookup[disp.lower()] = cid

    # -- helpers -----------------------------------------------------------
    def _resolve(self, channel: str) -> str | None:
        return self._lookup.get(str(channel).strip().lower())

    def _disp(self, cid: str) -> str:
        return self.names.get(cid, cid)

    @property
    def channels(self) -> list[str]:
        return [self._disp(c.get("channel_id")) for c in self.r.get("channel_contribution", [])]

    def _ci_note(self) -> str:
        return f"Ranges are {_pct(self.cl)}% credible intervals from the fitted Meridian posterior."

    @staticmethod
    def _mean_rows(records: list[dict], metric: str = "mean") -> list[dict]:
        return [r for r in (records or []) if str(r.get("metric", "mean")).lower() == metric]

    # -- tools -------------------------------------------------------------
    def channel_contribution(self) -> dict:
        return {
            "client": self.meta.get("client"),
            "confidence_level": self.cl,
            "channels": self.r.get("channel_contribution", []),
            "note": "Incremental revenue and ROI per channel. " + self._ci_note(),
        }

    def marginal_roi(self) -> dict:
        return {
            "client": self.meta.get("client"),
            "confidence_level": self.cl,
            "channels": self.r.get("marginal_roi", []),
            "note": "Return on the next dollar of spend in each channel. " + self._ci_note(),
        }

    def model_health(self) -> dict:
        h = self.r.get("model_health", {}) or {}
        max_rhat = h.get("max_rhat")
        pa = h.get("predictive_accuracy", []) or []

        def _pa(metric, gran, ev):
            for row in pa:
                if row.get("metric") == metric and row.get("geo_granularity") == gran and row.get("evaluation_set") == ev:
                    return row.get("value")
            return None

        holdout_mape = _pa("MAPE", "national", "Test")
        if holdout_mape is None:
            holdout_mape = h.get("mape")
        holdout_r2 = _pa("R_Squared", "geo", "Test")  # geo-level: the stable out-of-sample figure
        converged = max_rhat is not None and max_rhat <= 1.1
        return {
            "converged": converged,
            "max_rhat": max_rhat,
            "holdout_mape": holdout_mape,
            "holdout_r2_geo": holdout_r2,
            "training_window": h.get("training_window"),
            "trained_at": self.meta.get("generated_at"),
            "sampler": self.meta.get("sampler"),
            "verdict": (
                "Converged (R-hat ≤ 1.1); diagnostics within healthy range."
                if converged
                else "Convergence is borderline — treat point estimates with extra caution."
            ),
            "note": "Diagnostics from the latest posterior. " + self._ci_note(),
        }

    def response_curve(self, channel: str) -> dict:
        cid = self._resolve(channel)
        if cid is None:
            return {"error": f"Unknown channel '{channel}'. Available: {', '.join(self.channels)}."}
        pts = [p for p in (self.r.get("response_curves", {}).get("points", [])) if p.get("channel") == cid]
        by_mult: dict[float, dict] = {}
        for p in pts:
            mult = p.get("spend_multiplier")
            d = by_mult.setdefault(mult, {"spend_multiplier": mult, "spend": p.get("spend")})
            metric = str(p.get("metric"))
            if metric == "mean":
                d["incremental_outcome"] = p.get("incremental_outcome")
            elif metric == "ci_lo":
                d["ci_lo"] = p.get("incremental_outcome")
            elif metric == "ci_hi":
                d["ci_hi"] = p.get("incremental_outcome")
        curve = sorted(by_mult.values(), key=lambda x: (x["spend_multiplier"] is None, x["spend_multiplier"]))
        return {
            "channel": self._disp(cid),
            "confidence_level": self.cl,
            "points": curve,
            "note": "Saturation (response) curve: incremental revenue vs. spend, with credible band. "
            + "spend_multiplier 1.0 is the current spend level.",
        }

    # -- budget -------------------------------------------------------------
    def _optimized_table(self) -> dict:
        bo = self.r.get("budget_optimization", {}) or {}
        opt = self._mean_rows(bo.get("optimized", []))
        opt_lo = {r["channel"]: r for r in self._mean_rows(bo.get("optimized", []), "ci_lo")}
        opt_hi = {r["channel"]: r for r in self._mean_rows(bo.get("optimized", []), "ci_hi")}
        non = {r["channel"]: r for r in self._mean_rows(bo.get("nonoptimized", []))}
        rows = []
        for r in opt:
            cid = r.get("channel")
            cur = non.get(cid, {})
            rows.append(
                {
                    "channel": self._disp(cid),
                    "current_spend": cur.get("spend"),
                    "optimal_spend": r.get("spend"),
                    "delta_spend": (r.get("spend") or 0) - (cur.get("spend") or 0),
                    "optimal_roi": r.get("roi"),
                    "incremental_outcome": {
                        "median": r.get("incremental_outcome"),
                        "ci_lo": (opt_lo.get(cid) or {}).get("incremental_outcome"),
                        "ci_hi": (opt_hi.get(cid) or {}).get("incremental_outcome"),
                    },
                }
            )
        return {"rows": rows, "lift": bo.get("total_incremental_lift")}

    def optimize_budget(self, total_budget: float | None = None) -> dict:
        tbl = self._optimized_table()
        current_total = sum((row.get("current_spend") or 0) for row in tbl["rows"])

        if total_budget is None or (current_total and abs(total_budget - current_total) / current_total < 1e-6):
            return {
                "mode": "meridian_optimal",
                "fixed_budget": current_total,
                "confidence_level": self.cl,
                "allocation": tbl["rows"],
                "expected_lift": tbl["lift"],
                "note": "Meridian's optimal allocation for the current total budget, vs. the current plan. "
                + self._ci_note(),
            }

        # Arbitrary budget: re-allocate over the posterior response curves (greedy on
        # marginal return). An approximation of Meridian's BudgetOptimizer that does
        # not model cross-channel/adstock interactions — flagged as such.
        approx = self._greedy_allocate(total_budget)
        return {
            "mode": "response_curve_approximation",
            "fixed_budget": total_budget,
            "confidence_level": self.cl,
            "allocation": approx["allocation"],
            "projected_incremental_outcome": approx["total"],
            "note": "Approximate allocation maximising incremental revenue across the channel "
            "response curves under your budget. Exact re-optimisation for a non-current budget "
            "needs the live model (Phase 1). " + self._ci_note(),
        }

    def run_budget_scenario(self, changes: dict[str, float] | list[dict] | None = None) -> dict:
        """Project the outcome of a proposed per-channel spend plan.

        ``changes`` maps channel -> new absolute spend (channels omitted keep their
        current spend). Outcome is read off each channel's posterior response curve.
        """
        spec = self._normalise_changes(changes)
        baseline_total, baseline_lo, baseline_hi = 0.0, 0.0, 0.0
        scenario_total, scenario_lo, scenario_hi = 0.0, 0.0, 0.0
        per_channel = []
        for cid in self.names:
            cur_spend = self._current_spend(cid)
            new_spend = spec.get(cid, cur_spend)
            base = self._interp_curve(cid, cur_spend)
            scen = self._interp_curve(cid, new_spend)
            baseline_total += base["mean"]; baseline_lo += base["ci_lo"]; baseline_hi += base["ci_hi"]
            scenario_total += scen["mean"]; scenario_lo += scen["ci_lo"]; scenario_hi += scen["ci_hi"]
            if abs(new_spend - cur_spend) > 1e-9:
                per_channel.append(
                    {
                        "channel": self._disp(cid),
                        "current_spend": cur_spend,
                        "new_spend": new_spend,
                        "incremental_outcome": {"median": scen["mean"], "ci_lo": scen["ci_lo"], "ci_hi": scen["ci_hi"]},
                    }
                )
        delta = scenario_total - baseline_total
        return {
            "confidence_level": self.cl,
            "changes": per_channel,
            "baseline_incremental_outcome": {"median": baseline_total, "ci_lo": baseline_lo, "ci_hi": baseline_hi},
            "scenario_incremental_outcome": {"median": scenario_total, "ci_lo": scenario_lo, "ci_hi": scenario_hi},
            "delta": delta,
            "delta_pct": round(100.0 * delta / baseline_total, 2) if baseline_total else None,
            "note": "Projected from the posterior response curves (channels treated independently). "
            + self._ci_note(),
        }

    # -- curve maths -------------------------------------------------------
    def _curve_points(self, cid: str) -> list[dict]:
        rc = self.response_curve(self._disp(cid))
        return [p for p in rc.get("points", []) if p.get("spend") is not None]

    def _current_spend(self, cid: str) -> float:
        for p in self._curve_points(cid):
            if abs((p.get("spend_multiplier") or 0) - 1.0) < 1e-9:
                return float(p.get("spend") or 0.0)
        pts = self._curve_points(cid)
        return float(pts[-1]["spend"]) if pts else 0.0

    def _interp_curve(self, cid: str, spend: float) -> dict:
        """Linear-interpolate incremental_outcome (mean + CI) at ``spend``."""
        pts = [p for p in self._curve_points(cid) if p.get("incremental_outcome") is not None]
        pts.sort(key=lambda p: p["spend"])
        if not pts:
            return {"mean": 0.0, "ci_lo": 0.0, "ci_hi": 0.0}

        def interp(key):
            xs = [p["spend"] for p in pts]
            ys = [p.get(key, p.get("incremental_outcome")) for p in pts]
            if spend <= xs[0]:
                return ys[0]
            if spend >= xs[-1]:
                return ys[-1]
            for i in range(1, len(xs)):
                if spend <= xs[i]:
                    x0, x1, y0, y1 = xs[i - 1], xs[i], ys[i - 1], ys[i]
                    t = 0 if x1 == x0 else (spend - x0) / (x1 - x0)
                    return y0 + t * (y1 - y0)
            return ys[-1]

        return {"mean": interp("incremental_outcome"), "ci_lo": interp("ci_lo"), "ci_hi": interp("ci_hi")}

    def _greedy_allocate(self, budget: float, steps: int = 200) -> dict:
        ids = list(self.names)
        alloc = {c: 0.0 for c in ids}
        step = budget / steps if steps else budget
        for _ in range(steps):
            best, best_gain = None, -math.inf
            for c in ids:
                cur = self._interp_curve(c, alloc[c])["mean"]
                nxt = self._interp_curve(c, alloc[c] + step)["mean"]
                gain = nxt - cur
                if gain > best_gain:
                    best, best_gain = c, gain
            if best is None:
                break
            alloc[best] += step
        rows, total = [], {"mean": 0.0, "ci_lo": 0.0, "ci_hi": 0.0}
        for c in ids:
            out = self._interp_curve(c, alloc[c])
            for k in total:
                total[k] += out[k]
            rows.append({"channel": self._disp(c), "spend": round(alloc[c], 2),
                         "incremental_outcome": {"median": out["mean"], "ci_lo": out["ci_lo"], "ci_hi": out["ci_hi"]}})
        return {"allocation": rows, "total": {"median": total["mean"], "ci_lo": total["ci_lo"], "ci_hi": total["ci_hi"]}}

    def _normalise_changes(self, changes: Any) -> dict[str, float]:
        spec: dict[str, float] = {}
        if not changes:
            return spec
        items = changes.items() if isinstance(changes, dict) else (
            ((d.get("channel"), d.get("spend", d.get("new_spend"))) for d in changes)
        )
        for ch, spend in items:
            cid = self._resolve(ch)
            if cid is not None and spend is not None:
                spec[cid] = float(spend)
        return spec
