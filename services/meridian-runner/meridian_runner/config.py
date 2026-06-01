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

    def display_name(self, channel_id: str) -> str:
        return CHANNEL_DISPLAY_NAMES.get(channel_id, channel_id)


def quick_smoke(cfg: RunnerConfig) -> RunnerConfig:
    """Drastically shrink the sampler for a fast CPU sanity run (NOT publishable)."""
    cfg.n_prior_draws = 50
    cfg.n_chains = 2
    cfg.n_adapt = 50
    cfg.n_burnin = 50
    cfg.n_keep = 50
    return cfg
