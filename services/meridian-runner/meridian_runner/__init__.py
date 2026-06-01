"""Trifecta Meridian training runner.

Reproduces Google's Meridian "Getting Started" flow on the public simulated
dataset, exports a fitted model (model.pkl) and a results bundle (results.json)
to GCS. Phase 0 of the Trifecta Platform.
"""

__all__ = ["config", "data", "train", "results", "gcs", "run"]
