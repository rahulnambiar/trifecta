"""Phase 1 entrypoint: train a specific model_version whose config lives in Supabase.

The Vertex job runs:  python -m meridian_runner.run_version --model-version-id <uuid>

It reads the config from Supabase by model_version_id, translates it (translation.py),
fits Meridian, writes the posterior bundle to a per-version GCS path, and writes status
+ diagnostics back to Supabase (training_runs + model_versions). The Phase 0 run.py is
left untouched.

Env (passed by the submitter):
    MODEL_VERSION_ID         the version to train
    SUPABASE_URL             project URL
    SUPABASE_SECRET_KEY      service/secret key (bypasses RLS — server-side only)
    GCS_BUCKET               artifacts bucket
    SMOKE=1                  tiny sampler (cheap sanity run)
"""
from __future__ import annotations

import argparse
import datetime
import json
import logging
import math
import os
import urllib.request
import urllib.error


def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

from . import gcs, results as results_mod, train
from .config import RunnerConfig, quick_smoke
from .data import load_input_data
from . import translation

log = logging.getLogger(__name__)


# ── Supabase REST (stdlib only — no extra deps in the training image) ──────────
class Supa:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip("/")
        self.key = key

    def _req(self, method: str, path: str, body=None):
        req = urllib.request.Request(
            self.url + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers={
                "apikey": self.key,
                "Authorization": "Bearer " + self.key,
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            },
            method=method,
        )
        with urllib.request.urlopen(req, timeout=30) as r:
            d = r.read().decode()
            return json.loads(d) if d else None

    def get(self, path):
        return self._req("GET", path)

    def patch(self, path, body):
        return self._req("PATCH", path, body)

    def post(self, path, body):
        return self._req("POST", path, body)


def _scalar_prior_from_config(cfg_json: dict) -> tuple[float, float] | None:
    """Derive a single LogNormal ROI prior (mu, sigma) from the saved UI config.

    Translates the config (validating it), then averages the included channels' priors.
    Per-channel priors on the real 5-channel dataset come next; this already makes the
    Supabase config drive the fit. Returns None if the config has no usable channels.
    """
    try:
        params = translation.translate(cfg_json)
    except translation.ConfigError as e:
        log.warning("config did not translate (%s) — using runner defaults", e)
        return None
    if not params.channels:
        return None
    mu = sum(c.roi_mu for c in params.channels) / len(params.channels)
    sigma = sum(c.roi_sigma for c in params.channels) / len(params.channels)
    log.info("Config → ROI prior: mu=%.3f sigma=%.3f (median ROI ≈ %.2fx) from %d channels",
             mu, sigma, math.exp(mu), len(params.channels))
    return mu, sigma


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model-version-id", default=os.environ.get("MODEL_VERSION_ID"))
    ap.add_argument("--smoke", action="store_true", default=os.environ.get("SMOKE") == "1")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s %(message)s")

    vid = args.model_version_id
    if not vid:
        raise SystemExit("MODEL_VERSION_ID is required")
    supa = Supa(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SECRET_KEY"])

    # 1. fetch the version + its config + the client slug
    rows = supa.get(f"/rest/v1/model_versions?id=eq.{vid}&select=id,client_id,status,fitted_by,config_id,model_configs(config),clients(slug)")
    if not rows:
        raise SystemExit(f"model_version {vid} not found")
    v = rows[0]
    slug = (v.get("clients") or {}).get("slug") or "client"
    cfg_json = (v.get("model_configs") or {}).get("config") or {}
    log.info("Training version %s for client '%s' (status=%s)", vid, slug, v["status"])

    # 2. mark fitting + move the queued run (or create one) to running
    supa.patch(f"/rest/v1/model_versions?id=eq.{vid}", {"status": "fitting"})
    queued = supa.get(f"/rest/v1/training_runs?version_id=eq.{vid}&status=eq.queued&order=created_at.desc&limit=1")
    if queued:
        run_id = queued[0]["id"]
        supa.patch(f"/rest/v1/training_runs?id=eq.{run_id}", {"status": "running", "started_at": _now()})
    else:
        run = supa.post("/rest/v1/training_runs", {"version_id": vid, "status": "running", "started_at": _now()})
        run_id = run[0]["id"] if run else None

    try:
        # 3. build runner config; let the Supabase config set the ROI prior
        cfg = RunnerConfig()
        if args.smoke:
            cfg = quick_smoke(cfg)
            log.warning("SMOKE MODE — tiny sampler; outputs are NOT publishable.")
        prior = _scalar_prior_from_config(cfg_json)
        if prior:
            cfg.roi_mu, cfg.roi_sigma = prior

        os.makedirs(cfg.out_dir, exist_ok=True)
        model_local = os.path.join(cfg.out_dir, "model.pkl")
        results_local = os.path.join(cfg.out_dir, "results.json")

        # 4. data → fit → save
        data = load_input_data(cfg)
        mmm = train.build_model(data, cfg)
        mmm = train.fit(mmm, cfg)
        train.save_model(mmm, model_local)
        results = results_mod.build_results(mmm, data, cfg)
        results_mod.write_results(results, results_local)

        # 5. upload to a per-version GCS path
        bucket = os.environ.get("GCS_BUCKET") or cfg.gcs_bucket
        base = f"{slug}/versions/{vid}"
        gcs.upload_file(model_local, bucket, f"{base}/model.pkl")
        gcs.upload_file(results_local, bucket, f"{base}/results.json")
        posterior_path = f"gs://{bucket}/{base}/results.json"

        # 6. diagnostics → Supabase; run completed; version → in_review (sign-off gate)
        diag = (results.get("model_health") or {}) if isinstance(results, dict) else {}
        if run_id:
            supa.patch(f"/rest/v1/training_runs?id=eq.{run_id}",
                       {"status": "completed", "finished_at": _now(), "diagnostics": diag})
        supa.patch(f"/rest/v1/model_versions?id=eq.{vid}",
                   {"status": "in_review", "gcs_posterior_path": posterior_path, "diagnostics": diag})
        log.info("DONE — posterior at %s ; version in_review", posterior_path)
        return 0

    except Exception as e:  # noqa: BLE001
        log.exception("training failed")
        if run_id:
            supa.patch(f"/rest/v1/training_runs?id=eq.{run_id}", {"status": "failed", "finished_at": _now(), "error": str(e)[:500]})
        supa.patch(f"/rest/v1/model_versions?id=eq.{vid}", {"status": "draft"})
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
