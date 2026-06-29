"""Load the simulated CSV into a Meridian ``InputData`` object.

Uses the current ``DataFrameInputDataBuilder`` API (the older ``CsvDataLoader``
still exists but is no longer the path the Getting Started notebook takes).
"""
from __future__ import annotations

import logging

import pandas as pd

from meridian.data import data_frame_input_data_builder as dfb

from .config import RunnerConfig

log = logging.getLogger(__name__)


def read_training_frame(cfg: RunnerConfig) -> "pd.DataFrame":
    """Read the training CSV into a DataFrame (shared by the guardrails + the builder).

    Supports a local path, an https URL (e.g. the public Meridian sample), or a
    private gs:// URI (downloaded via the job's service account).
    """
    path = cfg.csv_path
    if path.startswith("gs://"):
        from .gcs import download_to_temp
        path = download_to_temp(path)
    log.info("Reading training CSV: %s", path)
    return pd.read_csv(path)


def load_input_data(cfg: RunnerConfig, df: "pd.DataFrame | None" = None):
    """Assemble Meridian ``InputData`` from the training frame (read it if not given)."""
    df = read_training_frame(cfg) if df is None else df

    builder = dfb.DataFrameInputDataBuilder(
        kpi_type=cfg.kpi_type,
        default_kpi_column=cfg.kpi_column,
        default_revenue_per_kpi_column=cfg.revenue_per_kpi_column,
    )
    builder = (
        builder.with_kpi(df)
        .with_revenue_per_kpi(df)
        .with_population(df)
        .with_controls(df, control_cols=cfg.control_cols)
    )
    builder = builder.with_media(
        df,
        media_cols=[f"{c}_impression" for c in cfg.media_channels],
        media_spend_cols=[f"{c}_spend" for c in cfg.media_channels],
        media_channels=cfg.media_channels,
    )
    if cfg.non_media_treatment_cols:
        builder = builder.with_non_media_treatments(
            df, non_media_treatment_cols=cfg.non_media_treatment_cols
        )
    if cfg.organic_media_cols:
        builder = builder.with_organic_media(
            df,
            organic_media_cols=cfg.organic_media_cols,
            organic_media_channels=cfg.organic_media_channels,
        )

    data = builder.build()
    log.info(
        "Built InputData: %d geos x %d time periods, channels=%s",
        data.kpi.shape[0],
        data.kpi.shape[1],
        cfg.media_channels,
    )
    return data
