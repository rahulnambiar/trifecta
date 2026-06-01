# mcp-server

The **Signal backend** — a FastMCP server exposing the Phase 0 MMM tools over the
Model Context Protocol, grounded in the fitted Meridian model's posterior outputs.
Every tool returns **credible intervals**, never bare point estimates.

It runs over **Streamable HTTP** so the Anthropic Messages API can attach it via the
`mcp_servers` parameter (that's what powers the Signal chat in M5). Hosted on **Cloud Run**.

## Design note — why it reads `results.json`, not `model.pkl`

The Meridian runner (M1) already exports a complete posterior bundle (`results.json`)
with contribution, ROI, marginal ROI, response curves (mean + credible band), the
optimal budget allocation, and diagnostics. The MCP server serves the tools straight
from that bundle. The payoff: a **tiny, fast, cheap** container (no TensorFlow, no GPU,
instant cold start) that is **fully unit-testable** — and still genuinely model-grounded
and uncertainty-honest.

The one limit: exact re-optimisation for a *non-current* total budget needs the live
model — so `optimize_budget(total_budget=…)` for a different total falls back to a
response-curve approximation (clearly flagged in its output). Loading the live model
for exact arbitrary re-optimisation is a Phase 1 enhancement.

## Tools

| Tool | Returns |
|---|---|
| `get_channel_contribution` | incremental revenue + ROI per channel (90% CI) + contribution % |
| `get_marginal_roi` | return on the next dollar per channel (90% CI) |
| `get_response_curve(channel)` | saturation curve: incremental revenue vs spend, with credible band |
| `run_budget_scenario(changes)` | projected outcome of a proposed spend plan (90% CI) |
| `optimize_budget(total_budget?)` | Meridian's optimal allocation + expected lift (90% CI) |
| `get_model_health` | R-hat convergence, holdout MAPE / R², training window |

`reconcile_measurement` is **Phase 1** (needs incrementality-experiment data the
simulated dataset doesn't have) — deliberately not implemented.

## Run locally

```bash
cd services/mcp-server
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Serve from a local bundle (no GCS needed):
RESULTS_JSON=tests/fixtures/results.json python -m mcp_server.server
# → Streamable HTTP on http://localhost:8080/mcp

# Or from GCS:
GCS_BUCKET=trifecta-artifacts-498105 RESULTS_ARTIFACT_PATH=aeon/results.json \
python -m mcp_server.server
```

## Test

The engine is pure (no Meridian), so the tools test locally against the real bundle:

```bash
cd services/mcp-server
RESULTS_JSON=tests/fixtures/results.json python -m pytest tests   # 8 tests
```

## Deploy to Cloud Run

```bash
# Build & push (Cloud Build)
gcloud builds submit --config cloudbuild.yaml .

# Deploy (reads the bundle from GCS at startup; scales to zero)
gcloud run deploy trifecta-mcp \
  --region=asia-southeast1 \
  --image=asia-southeast1-docker.pkg.dev/$GCP_PROJECT/trifecta/mcp-server:latest \
  --set-env-vars=GCS_BUCKET=trifecta-artifacts-498105,RESULTS_ARTIFACT_PATH=aeon/results.json \
  --allow-unauthenticated --port=8080
```

The Cloud Run URL + `/mcp` is what `MCP_SERVER_URL` points to for the web app's Signal route.

## Layout

```
mcp_server/
  config.py   — env config (GCS bucket, results path, port)
  loader.py   — load results.json from local file or GCS
  engine.py   — the 6 tools as pure functions over the posterior bundle (with CIs)
  server.py   — FastMCP server (Streamable HTTP) wiring tools -> engine
tests/        — engine tests against the real bundle
Dockerfile · cloudbuild.yaml
```
