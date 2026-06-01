# Trifecta Platform — Technical Architecture

**Purpose:** the engineering architecture for building the Trifecta Platform with Claude Code.
**Companion to:** the Design PRD (wireframe brief). This document governs the build; that one governs the UI.
**Status:** v1.0 — for the build phase.

---

## 1. How to use this with Claude Code

This document defines the system: components, data flow, stack, repo layout, build phases. Hand it to Claude Code alongside the approved wireframe. Build in the phase order in §9 — the **prototype phase comes first** because it produces a client-ready demo on a real Meridian model with no real client data required.

---

## 2. The one architectural decision that shapes everything

**Vercel is the right host — but only for part of the system.** Vercel runs the Next.js operator console (the wireframe) beautifully. It **cannot** run Meridian training (long-running, GPU-bound) or host the persistent Python MCP server. So the platform is split into two planes:

- **Control plane** — the web app. Stateless, short-lived requests. → **Vercel.**
- **Data & ML plane** — BigQuery, model training on GPU, the MCP server. Long-running, stateful, Python. → **Google Cloud (Vertex AI).**

The control plane *orchestrates* the data plane via API calls; it never does the heavy work itself. Keep this separation clean and the rest of the architecture falls into place.

---

## 3. System overview

```
                       ┌──────────────── CONTROL PLANE (Vercel) ────────────────┐
                       │  Next.js operator console (the wireframe)               │
   Operators  ───────► │  - all screens · auth · Model Studio config             │
   (you + Rajeev)      │  - serverless API routes = orchestration glue only      │
                       └───┬───────────┬───────────────┬──────────────┬──────────┘
                           │           │               │              │
                  app state│   data +  │results  trigger│ training     │ Signal
                           │   uploads │               │ jobs         │ queries
                           ▼           ▼               ▼              ▼
            ┌──────────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────────┐
            │ Postgres         │ │ BigQuery     │ │ Meridian     │ │ MCP server     │
            │ (Supabase)       │ │ raw +        │ │ runner       │ │ (Python, MCP   │
            │ clients, configs,│ │ harmonised   │ │ (Vertex GPU) │ │ SDK)           │
            │ versions, runs,  │ │ canonical    │ │ NUTS / MCMC  │ │ loads fitted   │
            │ mappings, log    │ │ tables       │ │              │ │ model, serves  │
            └──────────────────┘ └──────┬───────┘ └──────┬───────┘ │ Signal chat    │
                                        │                │         └───────┬────────┘
                                        │  reads         │ writes          │ loads
                                        └────────────────┤ .pkl + diags    │
                                                          ▼                 │
                                                 ┌──────────────────┐       │
                                                 │ GCS               │◄─────┘
                                                 │ fitted models     │
                                                 │ (.pkl) + raw files│
                                                 └──────────────────┘
            DATA & ML PLANE (Google Cloud)
```

---

## 4. Components

### 4.1 Web app — operator console
- **Next.js (React, TypeScript)** on **Vercel**. The approved wireframe is already React; this is its production home.
- **Serverless API routes** act only as orchestration glue: read/write Postgres, query BigQuery, issue signed upload URLs, trigger training jobs, proxy MCP calls. No long-running work.
- **Auth:** Supabase Auth (email/password + 2FA, role-based: operator/admin vs client-viewer). Clerk is a fine alternative.

### 4.2 App database
- **Postgres via Supabase** — chosen because it bundles Auth, Storage and row-level security, which keeps a two-person stack lean. (Neon is an alternative if you want DB-only.)
- Stores: `tenants`, `clients`, `data_sources`, `column_mappings`, `model_configs`, `model_versions`, `training_runs`, `experiments`, `decision_log`.
- **Postgres holds platform state. BigQuery holds the marketing data. Never mix the two.**

### 4.3 Data warehouse
- **BigQuery** — per the methodology and the existing site. One isolated dataset per client.
- Two layers: a **raw landing** layer (whatever each source provides) and a **harmonised canonical** layer in Meridian's required schema (see §5).

### 4.4 Object storage
- **Google Cloud Storage** — fitted Meridian models (`.pkl` artifacts) and raw uploaded files. Staying in GCP keeps the data/ML plane in one cloud.

### 4.5 Meridian runner (training)
- A **Python service running as a GPU batch job**. Meridian requires Python 3.11/3.12 and a GPU; its NUTS/MCMC sampling is compute-intensive — this is why it cannot live on Vercel.
- **Host: Vertex AI custom training jobs (GPU)** — locked decision: keeps the entire data & ML plane inside GCP, alongside BigQuery and GCS, and supports the Google Measurement Partner goal.
- Job flow: read the client's canonical tables from BigQuery → run Meridian → save the fitted model `.pkl` to GCS → write run diagnostics (R-hat, holdout error, status) back to Postgres.
- **Triggered by** the web app (manual "Start training run") or a scheduler (monthly refresh — Cloud Scheduler).

### 4.6 MCP server (Signal backend)
- A **persistent Python service** built with the official MCP SDK (FastMCP). Loads a fitted model `.pkl` from GCS and exposes MCP tools (channel contribution, budget scenario, measurement reconciliation, model health, etc. — per the product PRD).
- Querying the posterior is CPU-light (no GPU); host as a small always-on container on **Cloud Run**.
- Multi-tenant: every tool call is auth-scoped to one client.

---

## 5. Data import — three paths, one destination

Every path converges on the **harmonised canonical BigQuery tables** in Meridian's required schema. Meridian's CSV loader expects these variable types: `time`, `geo`, `controls`, `population`, `kpi`, `revenue_per_kpi`, `media`, `media_spend` (plus `organic_media` and `non_media_treatments` where relevant).

### Path A — Client already has data in BigQuery *(your specific ask — make this the default)*
Many sophisticated clients already run BigQuery. In that case **do not re-ingest** — connect to it:
1. The client grants a Trifecta service account **read access** to their BQ dataset.
2. A **mapping step** maps their existing tables/columns to the canonical schema.
3. A **harmonisation transform** (parameterised SQL, or dbt-core) writes the canonical weekly tables into Trifecta's project (or a dataset in theirs).
This is the cleanest, fastest onboarding path and should be the platform's first-class option.

### Path B — API connectors
For Google Ads, Meta, TikTok, GA4. **Don't hand-build and maintain connectors** as a two-person team — use managed pipes: BigQuery Data Transfer Service (free-tier for Google Ads/GA4) plus Fivetran or Airbyte for the rest. They land raw data in BigQuery; the same harmonisation transform takes over.

### Path C — File upload (Excel/CSV)
For TV, radio, print, OOH, and digital sources with no ad server. Upload (direct-to-GCS via a signed URL, to avoid Vercel function size limits) → store raw → a **column-mapping UI** maps spreadsheet columns to the canonical schema → load into BigQuery. Saved mappings are reused; a layout change flags "needs remapping." This is the most-used path, not an edge case.

> All three paths feed the same harmonisation layer. Build the harmonisation transform once; the three import paths are just different ways of filling the raw layer.

---

## 6. Existing MCPs for Meridian — research findings

- **BlueAlpha** ships an MCP whose optional MMM tools activate when a fitted Google Meridian model is connected to a BlueAlpha account. It is commercial and account-bound. BlueAlpha also publishes a how-to on operationalising an MMM through an MCP server with Claude — useful as a **reference for the pattern** (and worth noting as a potential competitor).
- There is **no widely adopted, open-standard Meridian MCP**. Other MMM tools (Robyn, LightweightMMM) don't ship MCPs at all.
- **Recommendation: build your own MCP server.** It's the right call anyway — the MCP layer (uncertainty-honest tools, tri-source reconciliation, decision logging) is Trifecta's differentiator and shouldn't be outsourced to a competitor's product. Use BlueAlpha's public material only as a pattern reference. Sources: `bluealpha.ai/mcp/comparison`, `bluealpha.ai/mcp/how-to-operationalize-your-marketing-mix-model-(mmm)-with-claude-mcp`.

---

## 7. Sample data & the showcase prototype — research findings

Meridian **ships a simulated dataset** — a geo-level, all-channels CSV in the Google repo:
`https://raw.githubusercontent.com/google/meridian/refs/heads/main/meridian/data/simulated_data/csv/hypothetical_geo_all_channels.csv`

There is also an official **Getting Started Colab** (free T4 GPU) that runs the full flow on this data, and a reach-and-frequency simulation notebook.

**Use this to build the client-showcase prototype:**
1. Run Meridian's Getting Started flow on `hypothetical_geo_all_channels.csv`; save the fitted model `.pkl` to GCS.
2. Wire the platform's **Results** and **Signal** screens to that real fitted model.
3. The demo client ("Aeon Skincare") is fictional, but the numbers are **genuine Meridian outputs** — far more convincing than synthetic figures, with the honest caveat that the underlying data is simulated.

This gives a fully working, navigable platform demo with **no real client data required** — exactly the asset to put in front of prospects.

---

## 8. Tech stack summary

| Layer | Choice | Notes |
|---|---|---|
| Web app | Next.js (TypeScript) | Operator console; the wireframe's production home |
| Hosting (web) | Vercel | Control plane only |
| Auth | Supabase Auth | Email/password + 2FA, roles |
| App database | Postgres (Supabase) | Platform state |
| Warehouse | BigQuery | Raw + harmonised canonical tables |
| Transform | Parameterised SQL or dbt-core | Raw → canonical schema |
| Connectors | BQ Data Transfer Service + Fivetran/Airbyte | Managed — don't hand-build |
| Object storage | Google Cloud Storage | Model `.pkl` artifacts, raw uploads |
| Model training | Vertex AI custom jobs (GPU) | All-GCP; locked decision |
| MCP server | Python + MCP SDK (FastMCP) on Cloud Run | Persistent, CPU-only |
| Orchestration | Cloud Scheduler | Monthly model refresh |
| Languages | TypeScript (web), Python (ML + MCP) | |

---

## 9. Repository structure & build phases

```
trifecta-platform/
  apps/
    web/                 # Next.js operator console  → Vercel
  services/
    meridian-runner/     # Python — training jobs    → Vertex AI
    mcp-server/          # Python — Signal MCP server → Cloud Run
  packages/
    db/                  # Postgres schema + migrations + client
    harmonization/       # SQL / dbt transforms → canonical schema
    shared/              # shared types, canonical schema definitions
  data/
    sample/              # Meridian simulated dataset (prototype)
  infra/                 # IaC, scheduler config
```

**Phase 0 — Showcase prototype.** Run Meridian on the simulated dataset, pre-train and store one model. Build `meridian-runner`, `mcp-server`, and the Next.js console (Dashboard, Model Studio read view, Results and Signal wired to the real model). Single hardcoded demo client, no real ingestion. *Output: a working demo for client pitches.*

**Phase 1 — Real client data.** BigQuery-direct connector (Path A), file upload + column-mapping (Path C), the harmonisation layer, full Model Studio config persistence in Postgres, training triggered from the app, run history, multi-tenancy and auth.

**Phase 2 — Scale.** Managed API connectors (Path B), scheduled auto-refresh, client-facing Signal access, calibration/experiment registry, operator-console polish.

---

## 10. Security & multi-tenancy

- One isolated BigQuery dataset and GCS prefix per client; per-client GCP service accounts.
- Row-level security in Postgres scopes every query to one tenant.
- Every MCP tool call is auth-scoped to a single client.
- Secrets: Vercel environment variables for the web app; GCP Secret Manager for the data/ML plane.
- Client BigQuery access (Path A) is **read-only** via a dedicated service account.

---

## 11. Cost notes

- **Vercel / Supabase** — generous free/low tiers; negligible at two-person scale.
- **BigQuery** — cheap for this data volume; storage + query, pay-as-you-go.
- **GPU training** — the real variable cost. Each Meridian run is GPU-hours on Vertex AI. Batch and schedule it — never run training on demand — and price compute into each client engagement.
- **MCP server** — small always-on CPU container; minimal.

---

## 12. Open decisions to confirm before building

1. *(Resolved)* Training runs on **Vertex AI** — all-GCP, supports the Google Measurement Partner goal.
2. **Harmonisation transform** — plain SQL (simplest) or dbt-core (more structure). Recommend starting with SQL.
3. **Where the canonical tables live** for Path A clients — Trifecta's GCP project, or the client's. Affects data-residency commitments.
4. **MCP delivery to clients** — a Claude connector the client adds, or a Trifecta-hosted chat UI. Phase 2 question.
5. **Model refresh cadence** in the standard contract — monthly vs quarterly; drives compute cost.

---

*End of architecture. Pair with the Design PRD and the approved wireframe when briefing Claude Code.*
