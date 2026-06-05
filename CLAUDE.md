# Trifecta Platform — project context for Claude Code

Trifecta Consulting Group runs **Marketing Mix Modelling (MMM) as a managed service**,
building Bayesian causal models with Google's open-source **Meridian** library. The
**Trifecta Platform** is the internal operator console two founders use to run that
service across a portfolio of clients. It is *not* self-serve SaaS — it is an operator
console with a thin client-facing layer ("Signal") on top.

**Phase 0 — the showcase prototype — is complete and live** (deployed at
https://platform.trifecta.sg, a custom domain on the `trifecta-platform` Vercel project;
`trifecta-platform.vercel.app` still works too). A *real* Meridian model trained on Google's
public simulated dataset backs it. Single hardcoded demo client ("Aeon Skincare"),
read-mostly — but every number on the Results and Signal screens is a genuine Meridian output.

**We are now in Phase 1 — the core loop (`Ingest → Customise → Train → Live`).** The goal is to
convert the first paying client end-to-end through the platform. The plan of record is
**`docs/phase1-build-brief.md`** (v2.0) — see the "Phase 1" section below. Work it milestone by
milestone (M1–M7), one milestone per arc, **always on a feature branch** (`feature/M<n>-<slug>`),
never directly on `main`.

## Source of truth for the UI

The handed-off design from **Claude Design** lives in `trifecta-design/project/` (the original
HTML/JSX prototype) and has been recreated as a production Next.js app in **`apps/web`**. The
design is the source of truth for UI, layout, navigation and theme. Build it out per
`docs/phase0-build-brief.md`: convert placeholder data to live data and stay within the
Phase 0 scope. **Do not add screens or navigation beyond the handed-off design.**

`apps/web/app/page.jsx` is the full operator console, ported faithfully from the handoff
(shared-scope prototype modules concatenated into one Next.js client component). `app/globals.css`
is the design's stylesheet verbatim. If anything about the palette or fonts is ambiguous, the
**Design PRD, Part B** (`docs/design-prd.md`) is the reference.

## Locked decisions (Phase 0 build brief §1)

| Area | Decision |
|---|---|
| Web hosting | Vercel |
| Web framework | Next.js (React, TypeScript) |
| Auth + app DB | Supabase (Auth + Postgres) |
| Cloud / data / ML | Google Cloud — BigQuery, GCS, **Vertex AI** for training |
| Model training | Vertex AI custom job (GPU) |
| MCP server host | Cloud Run (CPU) |
| Conversational layer | Anthropic API (Claude) with the Trifecta MCP server attached |
| Design → build | Claude Design **Hand off to Claude Code** |

## Repo map (Phase 0 monorepo)

```
trifecta/
  apps/
    web/                 # Next.js operator console → Vercel  (BUILT: design handoff ported)
  services/
    meridian-runner/     # Python — Vertex AI training job    (M1 ✅ trained; artifacts in GCS)
    mcp-server/          # Python — MCP server → Cloud Run    (M2 ✅ deployed & live)
  packages/
    db/                  # Supabase schema + seed             (TODO)
  data/
    sample/              # Meridian simulated dataset
  docs/                  # design-prd.md, technical-architecture.md, phase0-build-brief.md
  trifecta-design/       # original Claude Design handoff bundle (reference)
  CLAUDE.md              # this file
```

## Build milestones (see `docs/phase0-build-brief.md` §7)

- **M0 — Handoff & scaffold** ✅ design ported into `apps/web`, monorepo + docs in place, git initialised.
- **M1 — meridian-runner** ✅ *trained on Vertex AI; artifacts live in GCS.* Trains Meridian on
  `geo_all_channels.csv` (current API: `DataFrameInputDataBuilder`, not the brief's deprecated
  `CsvDataLoader`; `hypothetical_geo_all_channels.csv` has no KPI column and is the optimiser
  scenario input). Exports `model.pkl` (`save_mmm`) + `results.json` with contribution, ROI,
  marginal ROI, response curves, budget optimisation, and diagnostics — all with 90% credible
  intervals. **Ran as a CPU Vertex CustomJob** (GPU is the locked production path; CPU avoids a
  quota wait) — image built via Cloud Build (`Dockerfile.cpu`, `cloudbuild.yaml`), job specs in
  `vertex/{smoke,real}-job.yaml`. Converged run: 8 chains · 2000 adapt · 1000 keep, **max R-hat
  1.065**, national MAPE 3.4% (all-data) / 16.3% (holdout), geo R² 0.61 (holdout).
  - GCP: project `trifecta-platform-498105`, region `asia-southeast1`, bucket
    `gs://trifecta-artifacts-498105` (artifacts at `aeon/model.pkl`, `aeon/results.json`).
  - `apps/web/app/results-preview` is a temporary viewer for the bundle (replaced by the real
    Results screen in M4). gcloud CLI lives at `~/google-cloud-sdk/bin`.
- **M2 — mcp-server** ✅ *deployed to Cloud Run.* FastMCP (Streamable HTTP) server exposing the six
  Phase 0 tools, each with 90% credible intervals. Serves the posterior bundle (`results.json`,
  baked into the image for Phase 0 — no runtime GCS creds; GCS-load path retained for re-trains).
  All 6 tools verified live via an MCP client.
  - **MCP_SERVER_URL** = `https://trifecta-mcp-781866440451.asia-southeast1.run.app/mcp`
    (Cloud Run service `trifecta-mcp`, `asia-southeast1`, unauthenticated, scales to zero).
  - This is what the Signal route (M5) attaches via the Anthropic API `mcp_servers` parameter.
- **M3 — web: auth, shell, Dashboard** — Supabase email/password auth; wire Login + shell + Dashboard.
- **M4 — web: Results wired to real data** ✅ `/api/results` serves the posterior bundle (bundled
  `apps/web/data/results.json` in Phase 0; GCS-fetch is the documented Phase 1 seam). The **Results**
  screen (`app/_components/ResultsLive.jsx`) renders genuine Meridian outputs across all 4 tabs —
  contribution (incremental revenue + share), ROI & marginal ROI (with CI whiskers), response curves
  (posterior saturation + credible band), budget optimiser (current vs optimal + lift) — keeping the
  handoff's SVG chart language. Model Studio & Training Runs remain the handoff's faithful seeded
  read-views (the model *config* isn't persisted in Phase 0; only Results/Signal carry real numbers,
  per the brief). Note: the real model has 5 channels (Meta/YouTube/TV/Paid Search/TikTok); the
  config screens show the richer Aeon fiction.
- **M5 — web: Signal chat** ✅ `app/api/signal/route.js` calls the Anthropic API (`claude-opus-4-8`) with the
  Trifecta MCP server attached via the **MCP connector** (`mcp_servers` + `mcp_toolset`, beta header
  `mcp-client-2025-11-20`, `MCP_SERVER_URL`), streaming NDJSON back to `app/_components/SignalChat.jsx`
  (chat UI with tool-call chips + suggested prompts). System prompt is prompt-cached. Verified live:
  "which channels drive revenue?" → Claude calls `get_channel_contribution` → grounded answer with 90%
  CIs. **Needs `ANTHROPIC_API_KEY` + `MCP_SERVER_URL` in `apps/web/.env.local`** (gitignored).
- **M6 — Deploy & polish** ✅ `apps/web` deployed to **Vercel** at **https://trifecta-platform.vercel.app**
  (project `trifecta-platform`, `ANTHROPIC_API_KEY` + `MCP_SERVER_URL` set as production env vars).
  End-to-end smoke test passed in production (Signal → Claude → MCP on Cloud Run → grounded answer with
  CIs). Badge/footer rebranded as a Phase 0 demo with the "fictional demo data" disclaimer.

## Phase 1 — the core loop (plan of record: `docs/phase1-build-brief.md` v2.0)

Phase 1 turns the read-mostly Phase 0 console into the real control surface and onboards the
**first paying client** end-to-end. Core loop: **`Ingest → Customise → Train → Live`**. Anything
not on that line is deferred (ADH, reconciliation, AI mapping, saved-mapping templates,
auto-controls, vertical taxonomy, auto-QA, portfolio dashboard, run scheduling — see brief §3).
Capture every "we should build X" temptation in `docs/phase1b-notes.md` instead of building it.

Build sequence (order of work, not separate tracks):
1. **M1 — Auth & multi-tenancy.** Supabase Auth (email/password, 2FA; roles `admin`,
   `client-viewer`); schema `tenants, clients, users, user_clients` with **row-level security on
   every query**; per-client BigQuery dataset + GCS prefix; wire the Login screen (Phase 0 left it
   a hardcoded boolean). *Unblocks everything; the platform URL isn't safely shareable until this lands.*
2. **M2 — Client onboarding.** "Create client" provisions per-client GCP resources (manual OK for
   clients 1–2); Client Settings screen functional.
3. **M3 — Data ingestion** (build whichever path client #1 needs first; see brief §9). **Path A**
   BigQuery-direct (paste dataset ref → grant read → map tables/cols to canonical schema). **Path C**
   file upload (signed-URL → GCS → manual column-mapping UI, no AI assist). Mappings persist in
   Supabase. **Harmonisation SQL** writes canonical weekly tables to the client's BQ dataset.
4. **M4 — Model config + runner refactor.** Supabase `model_configs, model_versions, training_runs`;
   refactor `services/meridian-runner` to read config from Supabase by `model_version_id` (not
   hardcoded Python); translation layer (UI fields → Meridian model spec); `POST /api/model-config`,
   `POST /api/training-runs` (trigger Vertex job).
5. **M5 — Editable Model Studio.** Every Channels/Controls/Calibration/Settings input persists via the
   API; "Train new version" with a **cost-confirmation dialog**; Training Runs shows real
   queued→running→completed status; "Promote to Live" flips Results + Signal to the new posterior.
6. **M6 — Multi-tenant Signal + Results.** MCP server loads per-client model from a GCS path encoded
   in the auth token; every tool call + Results route scoped to one client; no cross-tenant leakage.
7. **M7 — First client onboarding.** Whole flow on real data; document friction in `docs/phase1b-notes.md`
   (that file is the Phase 2 priority list).

Conventions for Phase 1: feature branch per milestone; end each session with a working commit on the
branch; **write tests for the three high-stakes areas** — row-level security (data isolation), the
translation layer (UI → Meridian spec), and the harmonisation SQL. New env vars land in `apps/web/.env.local`
(+ Vercel) and Cloud Run; keep `docs/` current as decisions land.

## Phase 0 MCP tools (only what the simulated dataset supports)

`get_channel_contribution`, `get_marginal_roi`, `get_response_curve`, `run_budget_scenario`,
`optimize_budget`, `get_model_health`. Every tool returns posterior-derived values **with
credible intervals** — never point estimates dressed as certainty. `reconcile_measurement` is
**Phase 1** (needs experiment data the simulated dataset lacks) — do not fake it.

## Conventions

- `apps/web` is JavaScript Next.js (App Router). The build brief names TypeScript as the target
  stack; the handoff is JSX, so it was ported as `.jsx`. Migrate to `.tsx` incrementally if/when
  typing earns its keep — keep the visual output pixel-identical.
- Design tokens are CSS variables in `app/globals.css` (`--bg`, `--panel`, `--blue`, `--mint`, …).
  Status semantics: **mint** = healthy/live/automated · **amber** = action needed/manual ·
  **red** = stale/blocked · **sky/blue** = informational/in-progress.
- Fonts: Bricolage Grotesque (display), Hanken Grotesk (body), JetBrains Mono (numbers/IDs).
- Control plane (web, Vercel) only *orchestrates*; the data/ML plane (BigQuery, Vertex, MCP on
  GCP) does the heavy work. API routes are orchestration glue — no long-running work on Vercel.
- Environment variables: see `docs/phase0-build-brief.md` §6.

## Running the web app

```
cd apps/web
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (currently green, prerenders statically)
```
