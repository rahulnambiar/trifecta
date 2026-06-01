"""Thin GCS helpers — upload the model and results artifacts."""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def upload_file(local_path: str, bucket: str, blob_path: str) -> str:
    """Upload ``local_path`` to gs://bucket/blob_path. Returns the gs:// URI."""
    from google.cloud import storage  # imported lazily so local runs don't need it

    client = storage.Client()
    blob = client.bucket(bucket).blob(blob_path)
    blob.upload_from_filename(local_path)
    uri = f"gs://{bucket}/{blob_path}"
    log.info("Uploaded %s -> %s", local_path, uri)
    return uri
