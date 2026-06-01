"""Configuration for the MCP server (env-driven)."""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class ServerConfig:
    # Where the posterior bundle lives. Local file wins if set (dev/tests),
    # otherwise it's pulled from GCS.
    results_json: str | None = os.environ.get("RESULTS_JSON")
    gcs_bucket: str | None = os.environ.get("GCS_BUCKET")
    results_artifact_path: str = os.environ.get("RESULTS_ARTIFACT_PATH", "aeon/results.json")

    # Cloud Run provides PORT; default 8080 for local runs.
    port: int = int(os.environ.get("PORT", "8080"))
    host: str = os.environ.get("HOST", "0.0.0.0")

    client_name: str = os.environ.get("CLIENT_NAME", "Aeon Skincare")
