"""Translation layer — UI model config → Meridian model spec parameters.

This is the high-stakes seam called out in the Phase 1 brief (§9): the mapping from
the operator-facing Model Studio fields to the numbers Meridian's ``ModelSpec`` /
``PriorDistribution`` need. It is deliberately a **pure module** — no Meridian,
TensorFlow, or numpy imports — so it can be unit-tested in isolation (the real
distributions are built from these numbers by ``train.build_model_from_params``).

The canonical config is what M4 will persist in Supabase ``model_configs`` and load
by ``model_version_id``. Its shape (all keys optional unless noted):

    {
      "channels": [                         # required, >=1 with include=true
        {
          "id": "meta",                     # required
          "name": "Meta",                   # display label (defaults to id)
          "include": true,                  # default true
          "roi_prior_mean": 1.4,            # ROI prior central value (>0), "1.4x"
          "prior_strength": 0.7,            # 0..1; higher = tighter prior (smaller sigma)
          "adstock_decay": 0.6,             # 0..1 geometric carry-over retention
          "saturation_hill": 1.0,           # Hill slope prior mean (>0); default 1.0
          "medium": "digital"               # cosmetic
        }, ...
      ],
      "controls": [ {"id","name","include"} , ... ],
      "calibrations": [                      # geo-holdout results injected as priors
        {"channel_id":"meta","roi_mean":1.1,"roi_sd":0.2}, ...
      ],
      "settings": {
        "kpi_type": "non_revenue",          # non_revenue | revenue
        "holdout_weeks": 8,                  # >=0
        "max_lag": 8,                        # adstock window, >=0
        "confidence_level": 0.9,             # (0,1)
        "sampler": {"n_chains":8,"n_adapt":2000,"n_burnin":500,"n_keep":1000,
                    "n_prior_draws":500,"seed":0}
      }
    }

``translate(config)`` validates and returns a ``MeridianSpecParams``. Invalid input
raises ``ConfigError`` with a precise, human-readable message — a bad config must
never silently produce a degenerate model spec.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any


class ConfigError(ValueError):
    """Raised when a UI model config can't be translated to a valid Meridian spec."""


# ── Mapping constants ─────────────────────────────────────────────────────────
# prior_strength s∈[0,1] maps linearly to the LogNormal ROI sigma. A strong prior
# (s→1) is tight (SIGMA_MIN); a weak prior (s→0) is diffuse (SIGMA_MAX) and lets the
# brand's own data dominate. Monotonic decreasing, matching the UI's "σ = 1 − strength".
SIGMA_MIN = 0.20
SIGMA_MAX = 0.90

DEFAULT_MAX_LAG = 8
DEFAULT_HOLDOUT_WEEKS = 8
DEFAULT_HILL_SLOPE = 1.0
DEFAULT_CONFIDENCE = 0.9
DEFAULT_KPI_TYPE = "non_revenue"
_KPI_TYPES = ("non_revenue", "revenue")

# A calibrated (geo-tested) ROI prior is deliberately tighter than a benchmark prior
# when the experiment didn't report its own spread.
CALIBRATED_DEFAULT_SIGMA = 0.30

# Beta means are clamped off the {0,1} boundary — a degenerate Beta is undefined.
_EPS = 1e-3

DEFAULT_SAMPLER: dict[str, int] = {
    "n_prior_draws": 500,
    "n_chains": 8,
    "n_adapt": 2000,
    "n_burnin": 500,
    "n_keep": 1000,
    "seed": 0,
}


# ── Output types ──────────────────────────────────────────────────────────────
@dataclass
class ChannelSpec:
    """Translated, Meridian-ready priors for one included media channel."""
    id: str
    name: str
    roi_mu: float           # LogNormal(mu, sigma) on ROI — natural-log space
    roi_sigma: float
    adstock_retention_mean: float   # Beta prior mean for geometric adstock (alpha_m)
    hill_slope_mean: float          # Hill saturation slope prior mean (slope_m)
    calibrated: bool = False        # True if a geo-holdout experiment set this prior


@dataclass
class MeridianSpecParams:
    """Everything ``train.build_model_from_params`` needs, as plain numbers."""
    channels: list[ChannelSpec]
    control_cols: list[str]
    max_lag: int = DEFAULT_MAX_LAG
    holdout_weeks: int = DEFAULT_HOLDOUT_WEEKS
    kpi_type: str = DEFAULT_KPI_TYPE
    confidence_level: float = DEFAULT_CONFIDENCE
    sampler: dict[str, int] = field(default_factory=lambda: dict(DEFAULT_SAMPLER))

    # Convenience views aligned to ``media_channels`` order ---------------------
    @property
    def media_channels(self) -> list[str]:
        return [c.name for c in self.channels]

    @property
    def roi_m_mu(self) -> list[float]:
        return [c.roi_mu for c in self.channels]

    @property
    def roi_m_sigma(self) -> list[float]:
        return [c.roi_sigma for c in self.channels]


# ── Small, individually-testable math helpers ─────────────────────────────────
def strength_to_sigma(strength: float) -> float:
    """Map prior_strength∈[0,1] → LogNormal sigma (tighter as strength rises)."""
    s = _require_unit("prior_strength", strength)
    return SIGMA_MAX - s * (SIGMA_MAX - SIGMA_MIN)


def roi_lognormal_from_prior(mean: float, strength: float) -> tuple[float, float]:
    """A benchmark ROI prior: median == ``mean`` (mu = ln mean), sigma from strength."""
    if not _is_number(mean) or mean <= 0:
        raise ConfigError(f"roi_prior_mean must be > 0, got {mean!r}")
    return math.log(mean), strength_to_sigma(strength)


def lognormal_from_mean_sd(mean: float, sd: float) -> tuple[float, float]:
    """Method-of-moments LogNormal(mu, sigma) for a measured ROI mean ± sd (sd≥0).

    Used to inject a geo-holdout experiment result as a prior. For sd==0 this
    collapses to a point belief (sigma→0), so we floor sigma at a small value.
    """
    if not _is_number(mean) or mean <= 0:
        raise ConfigError(f"calibration roi_mean must be > 0, got {mean!r}")
    if not _is_number(sd) or sd < 0:
        raise ConfigError(f"calibration roi_sd must be >= 0, got {sd!r}")
    if sd == 0:
        return math.log(mean), 1e-3
    sigma = math.sqrt(math.log(1.0 + (sd / mean) ** 2))
    mu = math.log(mean) - 0.5 * sigma ** 2
    return mu, sigma


# ── Public entry point ────────────────────────────────────────────────────────
def translate(config: dict[str, Any]) -> MeridianSpecParams:
    """Validate ``config`` and return Meridian-ready spec parameters.

    Raises ``ConfigError`` (never returns a half-built spec) on any problem.
    """
    if not isinstance(config, dict):
        raise ConfigError(f"config must be a dict, got {type(config).__name__}")

    raw_channels = config.get("channels")
    if not isinstance(raw_channels, list) or not raw_channels:
        raise ConfigError("config.channels must be a non-empty list")

    calib = _index_calibrations(config.get("calibrations") or [])

    channels: list[ChannelSpec] = []
    seen_ids: set[str] = set()
    for i, ch in enumerate(raw_channels):
        if not isinstance(ch, dict):
            raise ConfigError(f"channels[{i}] must be an object")
        cid = ch.get("id")
        if not cid or not isinstance(cid, str):
            raise ConfigError(f"channels[{i}].id is required and must be a string")
        if cid in seen_ids:
            raise ConfigError(f"duplicate channel id {cid!r}")
        seen_ids.add(cid)
        if not ch.get("include", True):
            continue  # excluded channels never reach the model spec

        name = ch.get("name") or cid
        adstock = _require_unit(f"channels[{cid}].adstock_decay", ch.get("adstock_decay", 0.5))
        hill = ch.get("saturation_hill", DEFAULT_HILL_SLOPE)
        if not _is_number(hill) or hill <= 0:
            raise ConfigError(f"channels[{cid}].saturation_hill must be > 0, got {hill!r}")

        if cid in calib:
            mu, sigma = lognormal_from_mean_sd(calib[cid]["roi_mean"], calib[cid].get("roi_sd", 0.0))
            calibrated = True
        else:
            mu, sigma = roi_lognormal_from_prior(
                ch.get("roi_prior_mean", 1.0), ch.get("prior_strength", 0.5)
            )
            calibrated = False

        channels.append(ChannelSpec(
            id=cid, name=name, roi_mu=mu, roi_sigma=sigma,
            adstock_retention_mean=_clamp(adstock, _EPS, 1 - _EPS),
            hill_slope_mean=float(hill), calibrated=calibrated,
        ))

    if not channels:
        raise ConfigError("at least one channel must be included (all were excluded)")

    # A calibration pointing at a channel that isn't included is almost certainly a
    # mistake — surface it rather than silently dropping the experiment.
    unknown = set(calib) - {c.id for c in channels}
    if unknown:
        raise ConfigError(
            "calibration(s) reference unknown/excluded channel(s): " + ", ".join(sorted(unknown))
        )

    controls = _included_ids(config.get("controls") or [])
    settings = config.get("settings") or {}
    return MeridianSpecParams(
        channels=channels,
        control_cols=controls,
        max_lag=_require_nonneg_int("settings.max_lag", settings.get("max_lag", DEFAULT_MAX_LAG)),
        holdout_weeks=_require_nonneg_int(
            "settings.holdout_weeks", settings.get("holdout_weeks", DEFAULT_HOLDOUT_WEEKS)
        ),
        kpi_type=_require_kpi_type(settings.get("kpi_type", DEFAULT_KPI_TYPE)),
        confidence_level=_require_open_unit(
            "settings.confidence_level", settings.get("confidence_level", DEFAULT_CONFIDENCE)
        ),
        sampler=_merge_sampler(settings.get("sampler") or {}),
    )


# ── Internal validation utilities ─────────────────────────────────────────────
def _index_calibrations(items: list[Any]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for i, c in enumerate(items):
        if not isinstance(c, dict):
            raise ConfigError(f"calibrations[{i}] must be an object")
        cid = c.get("channel_id")
        if not cid or not isinstance(cid, str):
            raise ConfigError(f"calibrations[{i}].channel_id is required")
        if "roi_mean" not in c:
            raise ConfigError(f"calibrations[{i}].roi_mean is required")
        out[cid] = c  # last calibration for a channel wins
    return out


def _included_ids(items: list[Any]) -> list[str]:
    out: list[str] = []
    for i, it in enumerate(items):
        if not isinstance(it, dict):
            raise ConfigError(f"controls[{i}] must be an object")
        if not it.get("include", True):
            continue
        cid = it.get("id")
        if not cid or not isinstance(cid, str):
            raise ConfigError(f"controls[{i}].id is required")
        out.append(cid)
    return out


def _merge_sampler(s: dict[str, Any]) -> dict[str, int]:
    merged = dict(DEFAULT_SAMPLER)
    for k, v in s.items():
        if k not in DEFAULT_SAMPLER:
            raise ConfigError(f"unknown sampler key {k!r}")
        if not isinstance(v, int) or isinstance(v, bool) or v < 0:
            raise ConfigError(f"sampler.{k} must be a non-negative integer, got {v!r}")
        merged[k] = v
    for k in ("n_chains", "n_keep"):
        if merged[k] < 1:
            raise ConfigError(f"sampler.{k} must be >= 1")
    return merged


def _is_number(x: Any) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and not _is_nan(x)


def _is_nan(x: Any) -> bool:
    return isinstance(x, float) and math.isnan(x)


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _require_unit(name: str, x: Any) -> float:
    if not _is_number(x) or x < 0 or x > 1:
        raise ConfigError(f"{name} must be within [0, 1], got {x!r}")
    return float(x)


def _require_open_unit(name: str, x: Any) -> float:
    if not _is_number(x) or x <= 0 or x >= 1:
        raise ConfigError(f"{name} must be within (0, 1), got {x!r}")
    return float(x)


def _require_nonneg_int(name: str, x: Any) -> int:
    if not isinstance(x, int) or isinstance(x, bool) or x < 0:
        raise ConfigError(f"{name} must be a non-negative integer, got {x!r}")
    return x


def _require_kpi_type(x: Any) -> str:
    if x not in _KPI_TYPES:
        raise ConfigError(f"settings.kpi_type must be one of {_KPI_TYPES}, got {x!r}")
    return x
