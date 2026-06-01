"""Load the posterior results bundle from a local file or GCS."""
from __future__ import annotations

import json
import logging

from .config import ServerConfig

log = logging.getLogger(__name__)


def load_results(cfg: ServerConfig) -> dict:
    if cfg.results_json:
        log.info("Loading results bundle from local file: %s", cfg.results_json)
        with open(cfg.results_json) as f:
            return json.load(f)

    if not cfg.gcs_bucket:
        raise RuntimeError("Set RESULTS_JSON (local) or GCS_BUCKET + RESULTS_ARTIFACT_PATH.")

    from google.cloud import storage  # lazy import — only needed for the GCS path

    uri = f"gs://{cfg.gcs_bucket}/{cfg.results_artifact_path}"
    log.info("Loading results bundle from %s", uri)
    client = storage.Client()
    blob = client.bucket(cfg.gcs_bucket).blob(cfg.results_artifact_path)
    return json.loads(blob.download_as_text())
