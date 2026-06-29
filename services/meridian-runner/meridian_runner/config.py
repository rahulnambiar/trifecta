"""Configuration for the Meridian training runner.

All knobs are environment-overridable so the same code runs as a quick local
smoke test (tiny sampler) or a faithful Vertex AI GPU job (notebook defaults).
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field


def _int(name: str, default: int) -> int:
    return int(os.environ.get(name, default))


def _float(name: str, default: float) -> float:
    return float(os.environ.get(name, default))


# The simulated dataset ships with five generic media channels (Channel0..4).
# For the Aeon Skincare demo we give them human labels so Results / Signal read
# like a real brand. This is cosmetic only — the numbers are genuine Meridian
# posterior outputs for the underlying simulated channel.
CHANNEL_DISPLAY_NAMES = {
    "Channel0": "Meta",
    "Channel1": "YouTube",
    "Channel2": "TV",
    "Channel3": "Paid Search",
    "Channel4": "TikTok",
}

# Per-client presets. Select with CLIENT_PRESET=<key>; absent = the Aeon defaults
# baked into RunnerConfig below (so existing behaviour is unchanged). Each preset
# overrides the data file, channels, controls, KPI and artifact paths so one
# codebase trains any client. (Demo data is synthetic; the engine is real.)
PRESETS: dict[str, dict] = {
    "claritin": {
        "client_name": "Bayer · Claritin",
        "csv_path": "data/clients/claritin/geo_all_channels.csv",
        "media_channels": ["walmart_connect", "amazon_ads", "linear_tv", "ctv", "meta", "tiktok", "google_search"],
        "display_names": {
            "walmart_connect": "Walmart Connect", "amazon_ads": "Amazon Ads",
            "linear_tv": "Linear TV", "ctv": "CTV", "meta": "Meta",
            "tiktok": "TikTok", "google_search": "Google Search",
        },
        "control_cols": ["pollen_index_control", "competitor_spend_control", "price_index_control"],
        "organic_media_cols": ["Organic_search_impression"],
        "organic_media_channels": ["Organic_search"],
        "non_media_treatment_cols": ["Promo"],
        "kpi_column": "units",
        "revenue_per_kpi_column": "revenue_per_unit",
        "model_artifact_path": "claritin/model.pkl",
        "results_artifact_path": "claritin/results.json",
    },
}


@dataclass
class RunnerConfig:
    # --- data -------------------------------------------------------------
    # Training file: the simulated geo dataset WITH a KPI (conversions) and
    # control columns. (hypothetical_geo_all_channels.csv has no KPI column —
    # it is the budget-optimiser scenario input, used optionally below.)
    csv_path: str = os.environ.get("TRAINING_CSV", "data/sample/geo_all_channels.csv")
    scenario_csv_path: str = os.environ.get(
        "SCENARIO_CSV", "data/sample/hypothetical_geo_all_channels.csv"
    )
    media_channels: list[str] = field(
        default_factory=lambda: ["Channel0", "Channel1", "Channel2", "Channel3", "Channel4"]
    )
    control_cols: list[str] = field(
        default_factory=lambda: ["sentiment_score_control", "competitor_sales_control"]
    )
    organic_media_cols: list[str] = field(default_factory=lambda: ["Organic_channel0_impression"])
    organic_media_channels: list[str] = field(default_factory=lambda: ["Organic_channel0"])
    non_media_treatment_cols: list[str] = field(default_factory=lambda: ["Promo"])
    kpi_column: str = os.environ.get("KPI_COLUMN", "conversions")
    revenue_per_kpi_column: str = os.environ.get("REVENUE_PER_KPI_COLUMN", "revenue_per_conversion")
    kpi_type: str = os.environ.get("KPI_TYPE", "non_revenue")  # current builder uses underscore

    # --- model spec -------------------------------------------------------
    roi_mu: float = _float("ROI_MU", 0.2)
    roi_sigma: float = _float("ROI_SIGMA", 0.9)
    enable_aks: bool = os.environ.get("ENABLE_AKS", "1") == "1"
    holdout_weeks: int = _int("HOLDOUT_WEEKS", 8)  # validation holdout (last N weeks)

    # --- sampler (Meridian Getting Started defaults) ----------------------
    n_prior_draws: int = _int("N_PRIOR_DRAWS", 500)
    n_chains: int = _int("N_CHAINS", 10)
    n_adapt: int = _int("N_ADAPT", 2000)
    n_burnin: int = _int("N_BURNIN", 500)
    n_keep: int = _int("N_KEEP", 1000)
    seed: int = _int("SEED", 0)

    # --- analysis ---------------------------------------------------------
    confidence_level: float = _float("CONFIDENCE_LEVEL", 0.9)  # 90% credible interval
    optimizer_budget: float | None = (
        float(os.environ["OPTIMIZER_BUDGET"]) if os.environ.get("OPTIMIZER_BUDGET") else None
    )

    # --- artifacts / GCS --------------------------------------------------
    gcs_bucket: str | None = os.environ.get("GCS_BUCKET")
    model_artifact_path: str = os.environ.get("MODEL_ARTIFACT_PATH", "aeon/model.pkl")
    results_artifact_path: str = os.environ.get("RESULTS_ARTIFACT_PATH", "aeon/results.json")
    out_dir: str = os.environ.get("OUT_DIR", "artifacts")

    gcp_project: str | None = os.environ.get("GCP_PROJECT")
    client_name: str = os.environ.get("CLIENT_NAME", "Aeon Skincare")

    def __post_init__(self) -> None:
        # Default display map is the Aeon (Channel0..4) labels; a preset can replace it.
        self._display = CHANNEL_DISPLAY_NAMES
        preset_key = os.environ.get("CLIENT_PRESET")
        if not preset_key:
            return
        preset = PRESETS.get(preset_key)
        if not preset:
            raise ValueError(f"Unknown CLIENT_PRESET={preset_key!r}; known: {list(PRESETS)}")
        self._display = preset.get("display_names", CHANNEL_DISPLAY_NAMES)
        # For fields that also have their own env var, an explicit env wins over the
        # preset (so a Vertex job can point TRAINING_CSV at a URL, override artifact
        # paths, etc.). Non-env fields (channels, controls...) always come from the preset.
        env_backed = {
            "csv_path": "TRAINING_CSV",
            "kpi_column": "KPI_COLUMN",
            "revenue_per_kpi_column": "REVENUE_PER_KPI_COLUMN",
            "model_artifact_path": "MODEL_ARTIFACT_PATH",
            "results_artifact_path": "RESULTS_ARTIFACT_PATH",
        }
        for key, val in preset.items():
            if key == "display_names":
                continue
            envname = env_backed.get(key)
            if envname and envname in os.environ:
                continue  # explicit env overrides the preset
            setattr(self, key, val)

    def display_name(self, channel_id: str) -> str:
        return self._display.get(channel_id, channel_id)


def quick_smoke(cfg: RunnerConfig) -> RunnerConfig:
    """Drastically shrink the sampler for a fast CPU sanity run (NOT publishable)."""
    cfg.n_prior_draws = 50
    cfg.n_chains = 2
    cfg.n_adapt = 50
    cfg.n_burnin = 50
    cfg.n_keep = 50
    return cfg
