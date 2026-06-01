# Trifecta Platform — project context for Claude Code

Trifecta Consulting Group runs **Marketing Mix Modelling (MMM) as a managed service**,
building Bayesian causal models with Google's open-source **Meridian** library. The
**Trifecta Platform** is the internal operator console two founders use to run that
service across a portfolio of clients. It is *not* self-serve SaaS — it is an operator
console with a thin client-facing layer ("Signal") on top.

We are in **Phase 0 — the showcase prototype**: a deployed, navigable platform backed by a
*real* Meridian model trained on Google's public simulated dataset. Single hardcoded demo
client ("Aeon Skincare"), read-mostly, no real data ingestion — but every number on the
Results and Signal screens is a genuine Meridian output.

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
- **M6 — Deploy & polish** — Vercel + Cloud Run; end-to-end smoke test; "fictional demo data" disclaimer.

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
