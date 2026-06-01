# meridian-runner

Trains Google **Meridian** on the public simulated dataset and exports two artifacts to GCS:

- **`model.pkl`** — the fitted Meridian model (loaded by the MCP server, M2).
- **`results.json`** — the headline outputs the Results & Signal screens render.

This reproduces Meridian's official *Getting Started* flow as a runnable package.
It is **Phase 0** of the Trifecta Platform — the demo asset is backed by a *real*
Meridian model; only the client ("Aeon Skincare") and the channel labels are fictional.

## What it does (`python -m meridian_runner.run`)

1. **Load** `data/sample/geo_all_channels.csv` via `DataFrameInputDataBuilder`
   (KPI = `conversions`, revenue-per-KPI, population, two controls, five media
   channels, organic media, and the `Promo` non-media treatment).
2. **Fit** — LogNormal ROI prior, auto-knot-selection model spec, last 8 weeks
   held out for validation, NUTS posterior sampling (Getting Started defaults:
   10 chains · 2000 adapt · 500 burn-in · 1000 keep).
3. **Save** the fit to `model.pkl` (`model.save_mmm`).
4. **Derive** `results.json` — every figure with a 90% credible interval:
   - `channel_contribution` — incremental outcome + ROI per channel + contribution %
   - `marginal_roi` — return on the next dollar per channel
   - `response_curves` — saturation curve points per channel
   - `budget_optimization` — Meridian's optimal allocation vs. the current plan
   - `model_health` — R-hat convergence, holdout MAPE / R², training window
5. **Upload** both artifacts to `gs://$GCS_BUCKET/...`.

> ⚠️ The brief references the older `CsvDataLoader` and loads
> `hypothetical_geo_all_channels.csv`. The **current** Meridian replaced that
> loader with `DataFrameInputDataBuilder`, and that file now has **no KPI
> column** — it is the optimiser's *scenario* input, not a training file. So we
> train on `geo_all_channels.csv` (which has `conversions` + controls), exactly
> as the current Getting Started notebook does. See `meridian_runner/config.py`.

## Run it

Meridian needs Python 3.11/3.12 and — for real sampling — a CUDA GPU.

```bash
cd services/meridian-runner
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Fast CPU sanity run (tiny sampler — NOT publishable), local artifacts only:
python -m meridian_runner.run --smoke --no-upload

# Full run, upload to GCS (needs a GPU + gcloud auth):
GCS_BUCKET=trifecta-artifacts MODEL_ARTIFACT_PATH=aeon/model.pkl \
RESULTS_ARTIFACT_PATH=aeon/results.json \
python -m meridian_runner.run
```

Artifacts are written to `artifacts/` locally and (if `GCS_BUCKET` is set) uploaded.

## Run on Vertex AI (the locked Phase 0 path)

```bash
# 1. Build & push the GPU container
gcloud builds submit --tag \
  $REGION-docker.pkg.dev/$GCP_PROJECT/trifecta/meridian-runner ./services/meridian-runner

# 2. Submit the custom job (single T4, matches the Getting Started Colab)
GCP_PROJECT=... GCS_BUCKET=trifecta-artifacts REGION=us-central1 \
IMAGE_URI=$REGION-docker.pkg.dev/$GCP_PROJECT/trifecta/meridian-runner:latest \
python vertex/submit_job.py
```

## Configuration

Everything is environment-overridable — see `meridian_runner/config.py`. Key vars:
`GCS_BUCKET`, `MODEL_ARTIFACT_PATH`, `RESULTS_ARTIFACT_PATH`, `TRAINING_CSV`,
`N_CHAINS`/`N_ADAPT`/`N_BURNIN`/`N_KEEP`, `CONFIDENCE_LEVEL`, `HOLDOUT_WEEKS`,
`OPTIMIZER_BUDGET`.

## Layout

```
meridian_runner/
  config.py   — env-driven config (channels, sampler, GCS paths)
  data.py     — CSV → Meridian InputData
  train.py    — model spec + prior, NUTS sampling, save model.pkl
  results.py  — Analyzer + BudgetOptimizer → results.json (with credible intervals)
  gcs.py      — artifact upload
  run.py      — end-to-end entrypoint
vertex/
  submit_job.py — Vertex AI custom (GPU) job submission
Dockerfile      — CUDA image for the Vertex job
```
