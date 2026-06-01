# Trifecta Platform — Phase 0 Build Brief (for Claude Code)

**Version:** v1.1 — updated for the Claude Design → Claude Code handoff.
**Goal of Phase 0:** a deployed, navigable platform prototype, backed by a *real* Meridian model trained on the public simulated dataset — the asset you demo to prospective clients.
**Audience:** Claude Code, running via the Claude CLI on the Lucy dev server.
**Companions:** the Design PRD and the Technical Architecture. Both live in the repo (see §3).

---

## 1. Locked decisions

| Area | Decision |
|---|---|
| Web hosting | Vercel |
| Web framework | Next.js (React, TypeScript) |
| Auth + app DB | Supabase (Auth + Postgres) |
| Cloud / data / ML | Google Cloud — BigQuery, GCS, **Vertex AI** for training (all-GCP, supports the Google Measurement Partner goal) |
| Model training | Vertex AI custom job (GPU) |
| MCP server host | Cloud Run (CPU) |
| Conversational layer | Anthropic API (Claude) with the Trifecta MCP server attached |
| Design → build | Claude Design **Hand off to Claude Code** (no manual export, no screenshots) |

---

## 2. Phase 0 scope

**In scope**
- One hardcoded demo client ("Aeon Skincare"), no real data ingestion.
- `meridian-runner` — trains Meridian on the public simulated dataset, exports a fitted model + a results bundle to GCS.
- `mcp-server` — loads the fitted model, exposes the Phase 0 MCP tools.
- `apps/web` — operator console with: Login, Dashboard, Model Studio (read view), Training Runs (read view), Results, Signal (working chat).
- Deployed end-to-end: web on Vercel, MCP server on Cloud Run.

**Out of scope (Phase 1+)**
- Real data ingestion (BigQuery-direct, file upload, API connectors).
- Editable Model Studio config and writing model versions.
- Multi-tenancy and the `reconcile_measurement` tool (needs experiment data the simulated dataset doesn't have).
- Model Library, Client Settings, full operator Settings, scheduled refresh.

> Phase 0 is a **showcase**, not the product. Single client, read-mostly, but every number on the Results and Signal screens is a genuine Meridian output.

---

## 3. Repository structure

Monorepo. The web app is seeded by the Claude Design handoff (§4); the rest is built by Claude Code.
```
trifecta-platform/
  apps/
    web/                 # Next.js operator console — seeded by the Claude Design handoff → Vercel
  services/
    meridian-runner/     # Python — Vertex AI training job
    mcp-server/          # Python — MCP server → Cloud Run
  packages/
    db/                  # Supabase schema + seed
  data/
    sample/              # the Meridian simulated dataset
  docs/
    design-prd.md
    technical-architecture.md
    phase0-build-brief.md   # this file
  CLAUDE.md              # project context — Claude Code reads this automatically
```

---

## 4. Bringing in the design — the Claude Design handoff

The wireframe moves into the build through Claude Design's **Hand off to Claude Code** feature. This is a closed loop: the design is transferred natively for Claude Code to consume — no screenshots, no rebuilding from a picture.

**4.1 Do the handoff first.** From the approved wireframe in Claude Design, use **Hand off to Claude Code**. This brings the design into your Claude Code project as the starting point for `apps/web`. The feature is new — follow the in-product flow and trust what it shows you for the exact mechanics (whether it scaffolds a project, a branch, or a working folder). If it produces a standalone app, have Claude Code move it under `apps/web` and set up the monorepo structure (§3) around it.

**4.2 The handoff carries the design, not the plan.** It gives Claude Code the screens, layout, components and theme. It does **not** carry the engineering context — the stack, the Phase 0 scope, the data wiring. So immediately after the handoff, add the three specs (this brief, the Technical Architecture, the Design PRD) into `docs/` in the same project, and write `CLAUDE.md`.

**4.3 CLAUDE.md ties them together.** Create it at the repo root in M0. It must state, in plain words:
> "The handed-off design in `apps/web` is the source of truth for UI, layout, navigation and theme. Build it out per `docs/phase0-build-brief.md`: convert it into production Next.js components, wire placeholder data to live data, and stay within the Phase 0 scope. Do not add screens or navigation beyond the handed-off design."
> Also include: the locked decisions (§1), the repo map (§3), coding conventions, and a pointer to this brief.

**4.4 Design tokens.** The handoff carries the dark Trifecta theme. Confirm the palette and fonts match the Design PRD, Part B; that document is the reference if anything is missing or inconsistent.

**4.5 Per-milestone references.** When building a UI milestone, name the screen from the handed-off design (e.g. "the Results screen") and tell Claude Code exactly what live data it should now be wired to. The handoff gives the look; the brief gives the wiring.

---

## 5. Prerequisites — do these before running Claude Code

Claude Code cannot create accounts or cloud resources. Set these up first.

**Accounts & cloud**
- GCP project; enable **Vertex AI**, **Cloud Storage**, **Cloud Run**. Create a GCS bucket (e.g. `trifecta-artifacts`). Create a service account with access to all three; download its key.
- Supabase project — note the project URL, anon key, service-role key.
- Vercel account — connect it to the repo once the repo exists.
- Anthropic API key (for the Signal chat).

**Design**
- The approved wireframe exists in Claude Design (on claude.ai). The **Hand off to Claude Code** feature is the bridge from there to Claude Code on the Lucy server — see §4.

**On the Lucy server**
- Node.js 20+, Python 3.11 or 3.12, `gcloud` CLI authenticated, the GCP service-account key available, `git`, and the Claude CLI (already installed).
- A GPU is needed only to *run* the training. Easiest first artifact: run the runner once via Google's free Meridian Getting Started Colab (T4 GPU), then formalise it as a Vertex AI job. Everything downstream just needs `model.pkl` to exist in GCS.

**Data**
- Download the Meridian simulated dataset into `data/sample/`:
  `https://raw.githubusercontent.com/google/meridian/refs/heads/main/meridian/data/simulated_data/csv/hypothetical_geo_all_channels.csv`

---

## 6. Environment variables

`apps/web` (set in Vercel + a local `.env`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
MCP_SERVER_URL=                  # the deployed Cloud Run URL
GCS_BUCKET=trifecta-artifacts
GOOGLE_APPLICATION_CREDENTIALS=  # path/JSON for GCS reads
```
`services/mcp-server` (set in Cloud Run):
```
GCS_BUCKET=trifecta-artifacts
MODEL_ARTIFACT_PATH=aeon/model.pkl
```
`services/meridian-runner`:
```
GCP_PROJECT=
GCS_BUCKET=trifecta-artifacts
```

---

## 7. Build milestones

Work through these in order. Each is one Claude Code session — review, commit, then move on.

### M0 — Handoff & scaffold
Do the Claude Design **Hand off to Claude Code** to bring the wireframe in as `apps/web` (§4.1). Establish the monorepo structure (§3) around it. Add the three docs to `docs/`. Write `CLAUDE.md` (§4.3). Initialise git, add `.gitignore` and a root README.
**Done when:** the handed-off design opens as `apps/web`, the repo structure exists, `CLAUDE.md` is complete, and the repo is initialised in git.

### M1 — meridian-runner
A Python module that reproduces Google's Meridian Getting Started flow as a script: load `hypothetical_geo_all_channels.csv` with `CsvDataLoader` (map columns to `time, geo, controls, population, kpi, revenue_per_kpi, media, media_spend`), configure the model spec, sample the posterior (NUTS), and save the fitted model as `model.pkl`. Then use Meridian's analyzer/summarizer and `BudgetOptimizer` to export a `results.json` containing: channel contribution, ROI and marginal ROI, response-curve points, a budget-optimisation example, and model diagnostics (R-hat, holdout error). Upload `model.pkl` and `results.json` to GCS. Provide a Vertex AI custom-job config.
**Reference:** the official Meridian Getting Started Colab — follow its current API exactly.
**Done when:** `model.pkl` and `results.json` exist in GCS and `results.json` contains all the headline outputs above.

### M2 — mcp-server
A Python MCP server (MCP SDK / FastMCP) that loads `model.pkl` from GCS on startup and exposes the Phase 0 tools (§8). Each tool returns posterior-derived values **with credible intervals** — never point estimates dressed as certainty. Containerise it for Cloud Run.
**Done when:** the server runs locally, every tool returns sane values from the fitted model, and it deploys to Cloud Run with a reachable URL.

### M3 — web app: auth, shell, Dashboard
In `apps/web` (the handed-off design), confirm the Trifecta design tokens, then build Supabase email/password auth and wire the **Login** screen. Make the app shell — sidebar + top bar — and the **Dashboard** functional, converting the handed-off design into production Next.js components. One seeded client, "Aeon Skincare".
**Done when:** you can log in and navigate the shell; the Dashboard matches the handed-off design and renders the seeded client.

### M4 — web app: Model Studio, Training Runs, Results
Build out the **Model Studio** (read view — channels, priors, settings, versions) and **Training Runs** (read view — one completed run) screens from the handed-off design. Build the **Results** screens; a Next.js API route (`/api/results`) fetches `results.json` from GCS and the screens render real charts from it.
**Done when:** all three screens match the handed-off design and Results shows genuine Meridian outputs.

### M5 — web app: Signal chat
Build out the **Signal** screen as a working chat UI from the handed-off design. A Next.js API route takes the user's question, calls the Anthropic API with the Trifecta MCP server attached (the `mcp_servers` parameter, `MCP_SERVER_URL`), and streams the answer back. Claude calls the MCP tools and responds grounded in the model.
**Done when:** asking "which channels drive revenue?" or "optimise my budget" returns a real, model-grounded answer with credible intervals.

### M6 — Deploy & polish
Deploy `apps/web` to Vercel; confirm `mcp-server` on Cloud Run. End-to-end smoke test. Polish every screen against the handed-off design. Add the "fictional demo data" disclaimer.
**Done when:** a single URL gives the full demo, faithful to the handed-off design.

---

## 8. Phase 0 MCP tool set

Implement only the tools the simulated dataset genuinely supports:
- `get_channel_contribution` — incremental contribution + ROI per channel, with credible intervals.
- `get_marginal_roi` — return on the next dollar per channel.
- `get_response_curve` — saturation curve for a channel.
- `run_budget_scenario` — projected outcome of a proposed reallocation, with a credible interval.
- `optimize_budget` — Meridian's optimal allocation for a fixed budget.
- `get_model_health` — diagnostics: convergence, holdout error, training date.

`reconcile_measurement` is **Phase 1** — it needs incrementality-experiment data the simulated dataset doesn't contain. Do not fake it.

---

## 9. Working with the Claude CLI on Lucy

- Run `claude` from the repo root so it picks up `CLAUDE.md`.
- Work **one milestone per session.** Paste the milestone section as the task; let it work; review the diff; commit; start the next.
- Commit after every milestone — small, reversible steps.
- Ask it to write tests for the MCP tools (M2) and the results API (M4).
- When a UI milestone drifts from the design, point it back at the named screen in the handed-off `apps/web` design.
- Keep `docs/` current — it is Claude Code's memory across sessions.

---

## 10. Definition of Done — Phase 0

A live Vercel URL where you can: log in; navigate Dashboard, Model Studio, Training Runs, Results and Signal — all faithful to the handed-off design; see genuine Meridian outputs on Results; and hold a conversation on the Signal screen that returns real, model-grounded, uncertainty-honest answers. In short: **a prototype you can confidently put in front of a prospective client.**

---

*End of Phase 0 brief. Phases 1 and 2 are scoped in the Technical Architecture.*
