"""Submit the Meridian runner as a Vertex AI custom (GPU) training job.

Prereqs:
  - Build & push the container:
      gcloud builds submit --tag $REGION-docker.pkg.dev/$GCP_PROJECT/trifecta/meridian-runner ./services/meridian-runner
  - A GCS bucket exists ($GCS_BUCKET) and the job's service account can write to it.

Usage:
  GCP_PROJECT=... GCS_BUCKET=trifecta-artifacts REGION=us-central1 \
  IMAGE_URI=us-central1-docker.pkg.dev/$GCP_PROJECT/trifecta/meridian-runner:latest \
  python vertex/submit_job.py
"""
from __future__ import annotations

import os

from google.cloud import aiplatform


def main() -> None:
    project = os.environ["GCP_PROJECT"]
    region = os.environ.get("REGION", "us-central1")
    bucket = os.environ["GCS_BUCKET"]
    image_uri = os.environ["IMAGE_URI"]

    # GPU type/count — a single T4 matches the Getting Started Colab.
    machine_type = os.environ.get("MACHINE_TYPE", "n1-standard-8")
    accelerator_type = os.environ.get("ACCELERATOR_TYPE", "NVIDIA_TESLA_T4")
    accelerator_count = int(os.environ.get("ACCELERATOR_COUNT", "1"))

    aiplatform.init(project=project, location=region, staging_bucket=f"gs://{bucket}")

    job = aiplatform.CustomContainerTrainingJob(
        display_name="trifecta-meridian-runner",
        container_uri=image_uri,
    )

    # Environment passed into the container — the runner reads these (config.py).
    env = {
        "GCP_PROJECT": project,
        "GCS_BUCKET": bucket,
        "MODEL_ARTIFACT_PATH": os.environ.get("MODEL_ARTIFACT_PATH", "aeon/model.pkl"),
        "RESULTS_ARTIFACT_PATH": os.environ.get("RESULTS_ARTIFACT_PATH", "aeon/results.json"),
    }

    job.run(
        replica_count=1,
        machine_type=machine_type,
        accelerator_type=accelerator_type,
        accelerator_count=accelerator_count,
        environment_variables=env,
        sync=True,
    )
    print("Vertex AI custom job submitted.")


if __name__ == "__main__":
    main()
