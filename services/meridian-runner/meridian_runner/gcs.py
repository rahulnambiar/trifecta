"""Thin GCS helpers — upload the model and results artifacts."""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def download_to_temp(gs_uri: str) -> str:
    """Download gs://bucket/blob to a local temp file; return the local path.

    Lets the runner read a private training CSV from GCS (the job's service account
    already has bucket access) without baking data into the image or needing a
    public URL.
    """
    from google.cloud import storage  # imported lazily so local runs don't need it
    import os
    import tempfile

    assert gs_uri.startswith("gs://"), gs_uri
    bucket_name, _, blob_path = gs_uri[len("gs://"):].partition("/")
    client = storage.Client()
    suffix = os.path.basename(blob_path) or ".csv"
    fd, local = tempfile.mkstemp(suffix="_" + suffix)
    os.close(fd)
    client.bucket(bucket_name).blob(blob_path).download_to_filename(local)
    log.info("Downloaded %s -> %s", gs_uri, local)
    return local


def upload_file(local_path: str, bucket: str, blob_path: str) -> str:
    """Upload ``local_path`` to gs://bucket/blob_path. Returns the gs:// URI."""
    from google.cloud import storage  # imported lazily so local runs don't need it

    client = storage.Client()
    blob = client.bucket(bucket).blob(blob_path)
    blob.upload_from_filename(local_path)
    uri = f"gs://{bucket}/{blob_path}"
    log.info("Uploaded %s -> %s", local_path, uri)
    return uri
