"""End-to-end entrypoint: train Meridian → export model.pkl + results.json → GCS.

Usage:
    python -m meridian_runner.run [--smoke] [--no-upload]

Environment (see config.py and docs/phase0-build-brief.md §6):
    GCP_PROJECT, GCS_BUCKET, MODEL_ARTIFACT_PATH, RESULTS_ARTIFACT_PATH,
    TRAINING_CSV, N_CHAINS / N_ADAPT / N_BURNIN / N_KEEP, CONFIDENCE_LEVEL ...
"""
from __future__ import annotations

import argparse
import logging
import os

from . import gcs, results as results_mod, train
from .config import RunnerConfig, quick_smoke
from .data import load_input_data

log = logging.getLogger(__name__)


def main() -> int:
    parser = argparse.ArgumentParser(description="Trifecta Meridian training runner")
    parser.add_argument("--smoke", action="store_true", help="Tiny sampler for a fast CPU sanity run")
    parser.add_argument("--no-upload", action="store_true", help="Skip GCS upload; write artifacts locally only")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s  %(levelname)-7s %(name)s  %(message)s",
    )

    cfg = RunnerConfig()
    if args.smoke:
        cfg = quick_smoke(cfg)
        log.warning("SMOKE MODE — sampler is tiny; outputs are NOT publishable.")

    os.makedirs(cfg.out_dir, exist_ok=True)
    model_local = os.path.join(cfg.out_dir, "model.pkl")
    results_local = os.path.join(cfg.out_dir, "results.json")

    # 1. data -> 2. fit -> 3. save model
    data = load_input_data(cfg)
    mmm = train.build_model(data, cfg)
    mmm = train.fit(mmm, cfg)
    train.save_model(mmm, model_local)

    # 4. derive + write results bundle
    results = results_mod.build_results(mmm, data, cfg)
    results_mod.write_results(results, results_local)

    # 5. upload to GCS
    if args.no_upload or not cfg.gcs_bucket:
        if not cfg.gcs_bucket:
            log.warning("GCS_BUCKET not set — artifacts left in %s/", cfg.out_dir)
    else:
        gcs.upload_file(model_local, cfg.gcs_bucket, cfg.model_artifact_path)
        gcs.upload_file(results_local, cfg.gcs_bucket, cfg.results_artifact_path)

    log.info("Done. model=%s results=%s", model_local, results_local)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
