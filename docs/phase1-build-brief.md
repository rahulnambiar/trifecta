# Trifecta Platform — Phase 1 Build Brief

**Version:** v2.0 — supersedes v1.0.
**Status:** Phase 0 complete and live (commit `2971221`). Ten prospects engaged; converting to first paid client is the goal of Phase 1.
**Scope change from v1.0:** ADH integration formally dropped from Phase 1. Accelerators (formerly Phase 1b) deferred until the first paid client surfaces real pain. Phase 1 is now a single focused sprint to deliver the core loop end-to-end for a real client.

---

## 1. The core loop

```
Ingest  →  Customise  →  Train  →  Live
```

That is Phase 1. Anything that doesn't sit on this line is out of scope until it's proven necessary by a real client.

---

## 2. Locked decisions (carried from Phase 0)

| Area | Decision |
|---|---|
| Web hosting | Vercel (Next.js) |
| Auth + app DB | Supabase (M3 from Phase 0 lands here) |
| Cloud / data / ML | Google Cloud — BigQuery, GCS, Vertex AI |
| Model training | Vertex AI custom job (GPU) |
| MCP server host | Cloud Run, `asia-southeast1` |
| Conversational layer | Anthropic API + Trifecta MCP server |
| Design → build | Claude Design handoff for any new screens |
| Data residency | Singapore region (PDPA-aligned for SG clients) |

---

## 3. In scope vs explicitly deferred

### In scope for Phase 1
- Supabase auth and multi-tenancy
- Per-client GCP isolation (BigQuery dataset, GCS prefix, service account)
- **Two data ingestion paths:**
  - **Path A:** BigQuery-direct (client's existing dataset)
  - **Path C:** File upload + manual column mapping
- Harmonisation SQL — raw inputs to canonical weekly tables
- Model config persistence in Supabase (`model_configs`, `model_versions`, `training_runs`)
- Runner refactor — Meridian reads its config from Supabase, not hardcoded Python
- Translation layer — UI fields to Meridian model spec
- Editable Model Studio (priors, controls, settings persist; "Train new version" works)
- Cost-confirmation dialog on every training action
- Multi-tenant Signal and Results
- Onboarding the first paying client end-to-end

### Explicitly deferred (do NOT build during Phase 1)
- ADH integration, customer journey view, reconciliation engine
- AI-assisted column mapping
- Saved mapping templates (per-source / per-client)
- Auto-pulled controls (weather, Trends, macro)
- Vertical channel-taxonomy library
- Auto-QA / validation engine
- Portfolio operator console (multi-client dashboard)
- Run scheduling / monthly auto-refresh
- Cross-client benchmark library

> Every deferred feature has a real use case. None has earned its time yet. The first paid client decides which ones move into Phase 2.

---

## 4. Build sequence

This sequence is not the milestone list — it's the order of work. Follow it.

1. **Auth + multi-tenancy.** M1. Unblocks everything else. The Phase 0 URL is not safely shareable until this lands.
2. **Data ingestion.** M2 and M3 together. The thought-intensive part. Build whichever of Path A or Path C the first signing client needs; build the other one for client #2.
3. **Model config + runner refactor + editable Model Studio.** M4 and M5 together. Turns the read-only UI into the actual control surface.
4. **Multi-tenant Signal and Results.** M6. Mostly plumbing; the Phase 0 logic already works.
5. **First real client.** M7. The whole flow on real data. Document what hurts.

---

## 5. Milestones

### M1 — Auth & multi-tenancy foundation
- Supabase Auth (email/password, 2FA, roles: `admin`, `client-viewer`).
- App schema: `tenants, clients, users, user_clients` (role join), with row-level security on every query.
- Per-client isolation: dedicated BigQuery dataset and GCS prefix per client.
- Login screen wired (was placeholder in Phase 0).
- **Done when:** an operator sees only the clients they belong to; a client-viewer sees only their workspace; no path exists for cross-tenant data leakage.

### M2 — Client onboarding flow
- "Create client" operator action provisions the per-client GCP resources (BigQuery dataset, GCS prefix, service account) via a Cloud Function or scripted Terraform.
- Client Settings screen functional: GCP project ref, BigQuery dataset, GCS prefix, refresh cadence, data residency.
- **For Phase 1, manual provisioning is acceptable for clients 1–2.** Automate when it hurts.
- **Done when:** creating a new client takes one form submission with backing resources in place.

### M3 — Data ingestion (manual but functional)
**Path A — BigQuery-direct:**
- Operator pastes the client's BQ dataset reference; Trifecta service account is granted read access.
- Mapping UI maps the client's tables and columns to the canonical schema (`time, geo, kpi, channels, controls, population`).
- Mapping persisted to Supabase, reusable on next refresh.

**Path C — File upload:**
- Signed-URL upload direct to GCS.
- Basic column-mapping UI (drag-and-drop or dropdown — *no AI assist yet*).
- Mapping persisted, reused on next upload of the same file shape.

**Harmonisation SQL:**
- Templates parameterised per client.
- Output writes the canonical weekly tables in the client's BigQuery dataset.
- Validate against canonical-shape expectations before training.

- **Done when:** one client's data — whatever shape it arrives in — produces a clean canonical weekly table ready for Meridian.

### M4 — Model config persistence + runner refactor
- Supabase schema: `model_configs, model_versions, training_runs` (one row per save).
- Refactor `services/meridian-runner` to read its config from Supabase by `model_version_id` instead of hardcoded Python.
- Translation layer: UI fields (`roi_prior_mean`, `prior_strength`, `adstock_decay`, `saturation_hill`) → Meridian model spec.
- API routes: `POST /api/model-config` (save draft), `POST /api/training-runs` (trigger Vertex job).
- **Done when:** a config saved from the UI produces a Meridian run that uses that config; the trained posterior writes back to GCS and diagnostics to Supabase.

### M5 — Editable Model Studio
- Every input in Channels & Priors, Controls, Calibration, Settings writes to Supabase via the API route (currently read-only).
- "Train new version" button with cost-confirmation dialog: *"This will start a Vertex job, ~2 hours, ~$X. Proceed?"*
- Training Runs screen shows real status: queued → running → completed / failed, with diagnostics on completion.
- Version promotion ("Promote to Live") flips Results and Signal to read from the new posterior.
- **Done when:** an operator can change a prior, hit Train, watch a new version appear, promote it, and see Results and Signal update.

### M6 — Multi-tenant Signal + Results
- MCP server: per-client model loading from a GCS path encoded in the auth token; every tool call scoped to one client.
- Results: API routes read the right client's `results.json` based on the authenticated user.
- Per-client URL pattern (`app.trifecta.sg/<client-slug>` or auth-routed) — never cross-tenant data.
- **Done when:** two clients exist in the system; each operator/viewer sees only their own data, models, and chat answers.

### M7 — First client onboarding
- One paying client onboarded end-to-end through the platform.
- Document the friction in `docs/phase1b-notes.md` — every painful manual step, every clunky UI moment, every wish-this-was-automated thought.
- That document is the priority list for Phase 2.
- **Done when:** one paying client is live, using Signal against a Meridian model trained on their real data, through the platform.

---

## 6. Discipline — `phase1b-notes.md`

The single biggest risk in Phase 1 is **scope creep into accelerators that haven't earned their time.**

During M1–M7, every time you notice a slick feature you could build — vertical templates, AI mapping, auto-QA, anything from the deferred list — write it in `docs/phase1b-notes.md` with one line of context. Then *don't* build it.

Format:
```
2026-06-12 | M3 | Spent 40 minutes mapping Aeon's Meta export. AI-assist would cut this to ~5 minutes for subsequent refreshes.
2026-06-15 | M3 | Aeon's Q4 weather control was missing — operator had to fetch it manually. Auto-controls would have done this.
```

After M7, that file is your Phase 2 priority list, ranked implicitly by how often each pain appeared. Premature accelerators get built and used by no one; client-validated accelerators get built and save weeks.

---

## 7. Prerequisites — do these in parallel with the build

Most are non-technical and easily forgotten. Each one bites if missed.

**This week:**
- **Lock pricing.** Setup fee + monthly retainer is the recommended model. A decided number beats six versions of "we'll figure it out." Stop revisiting after this week.
- **Shareholder agreement with Rajeev.** 50/50 needs an explicit deadlock-resolution mechanism *before* money flows. Brief a Singapore-based startup lawyer this week.
- **SOW template.** Reusable Statement of Work — scope, deliverables, refresh cadence, data residency, termination, IP. Don't draft per-client.
- **DPA template.** PDPA-aligned. Required for any SG client.

**This month:**
- **Convert prospects.** Of your ten interested clients, identify the two or three most likely to sign and send each a pricing proposal plus draft SOW. Don't let interest go cold while you build.
- **Billing infrastructure.** Xero or similar. Invoice generation, AR tracking.
- **Client offboarding policy.** What happens to data on cancellation. PDPA requires a defined retention/deletion approach.

---

## 8. Working with Claude Code on a multi-week build

Phase 0 was eight sessions. Phase 1 will be 20–30 sessions over 4–6 weeks. Discipline scales accordingly.

- **Feature branches always.** `git checkout -b feature/M3-ingestion` per milestone. Never work on `main`. Merge after review.
- **One milestone per Claude Code arc.** A milestone may span multiple sessions; end each session with a working commit on the branch.
- **Write tests where stakes are real.** Especially: row-level security (data isolation), the translation layer (UI → Meridian spec), and the harmonisation SQL. Silent bugs in these three cause client-visible incidents.
- **Use Remote Control + Tailscale.** Already set up. Long jobs run while you step away; check from phone.
- **Step away when stuck.** If a milestone has fought you for an hour, exit, commit what works, take a break. Hour-two of grinding rarely produces better code than fresh eyes.
- **Keep `docs/` current.** This brief lives here. Update it as decisions land — it's Claude Code's memory.

---

## 9. Open question that shapes M3 priorities

Of the ten prospects, are the most-likely-to-sign clients sitting on:
- **(a) data already in BigQuery** → prioritise Path A; build a clean mapping UI; defer Path C.
- **(b) spreadsheets and agency files** → prioritise Path C; build the upload + manual mapping flow; defer Path A.

Build whichever applies to client #1 first. The other path follows when client #2 needs it. Don't try to build both perfectly in parallel.

---

## 10. What to do this week

1. **Brief a lawyer on the shareholder agreement.** Runs in parallel; don't gate the build on it.
2. **Send pricing proposals to your top 2–3 prospects.** Ask which of their data sits in BigQuery vs spreadsheets — that answers section 9.
3. **Start M1 (Auth & multi-tenancy).** Highest-leverage technical step; everything else depends on it.
4. **Decide pricing. Stop revisiting it after this week.**

---

## 11. Definition of Done — Phase 1

One paying client, fully onboarded and using the platform:

- Logs into the platform via Supabase auth → lands in their workspace
- Their data — ingested via the appropriate path — harmonised in the canonical weekly tables
- Their Meridian model configured and trained on Vertex, with diagnostics surfaced
- Results screens showing their numbers
- Signal answering questions about their model with proper uncertainty
- Auth and multi-tenancy clean — no cross-tenant leaks

That client is paying. The architecture supports adding more.

When that's true, Phase 1 is done.

---

## 12. What comes after Phase 1 (out of scope here; placeholder for planning)

- **Phase 2 — Accelerators.** Scope from `phase1b-notes.md` after Phase 1 is live. Likely candidates: AI-assisted column mapping, vertical templates, auto-pulled controls, auto-QA, portfolio operator console.
- **Phase 3 — Third pillar.** ADH integration, reconciliation engine, customer journey view, experiment registry, cross-client benchmarks.

Neither is in scope until Phase 1 has landed a real client and surfaced the actual pain.
