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
    meridian-runner/     # Python — Vertex AI training job    (TODO: M1)
    mcp-server/          # Python — MCP server → Cloud Run    (TODO: M2)
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
- **M1 — meridian-runner** — train Meridian on `hypothetical_geo_all_channels.csv`; export `model.pkl` + `results.json` to GCS.
- **M2 — mcp-server** — FastMCP server loading the fitted model; Phase 0 tools (§8) with credible intervals; Cloud Run.
- **M3 — web: auth, shell, Dashboard** — Supabase email/password auth; wire Login + shell + Dashboard.
- **M4 — web: Model Studio, Training Runs, Results** — read views; `/api/results` reads `results.json` from GCS, renders real charts.
- **M5 — web: Signal chat** — `/api/signal` calls the Anthropic API with the Trifecta MCP server attached (`mcp_servers`, `MCP_SERVER_URL`); streams grounded answers.
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
