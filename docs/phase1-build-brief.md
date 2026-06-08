# Trifecta Platform — Phase 1 Build Brief

**Version:** v4.0 (final for Phase 1 handoff to Claude Code) — supersedes v3.0.
**Status:** Phase 0 complete and live (commit `2971221`). Ten prospects engaged; first paid client is the goal of Phase 1.
**Adds in v4.0:** the CMO Signal surface product spec (the hero, client-facing product), and the export-integrity rule (*uncertainty travels with the number*) as a hard requirement on all charts and exports.

> **How to use this doc with Claude Code.** Work one milestone per feature branch (`feature/M1-auth`). Read this file at the start of each session; it is the source of truth. End every session with a working commit. The build order is section 5; the done-when criteria are in section 6.

---

## 1. The core loop

```
Ingest  →  Customise  →  Train  →  Sign off  →  Live
```

That is Phase 1. The **Sign off** gate is the human-judgment checkpoint. The CMO Signal surface (section 3d) is the client-facing product that sits at the end of this loop. Anything off this line is deferred until a real client proves it necessary.

---

## 2. Locked decisions

| Area | Decision |
|---|---|
| Web hosting | Vercel (Next.js) |
| Auth + app DB | Supabase |
| Cloud / data / ML | Google Cloud — BigQuery, GCS, Vertex AI |
| Model training | Vertex AI custom job (GPU) |
| MCP server host | Cloud Run, `asia-southeast1` |
| Conversational layer | Anthropic API + Trifecta MCP server (per-client scoped) |
| Delivery model | Managed service. Trifecta owns the client, project and accountability. Modelling delivered by a fractional expert bench — not a marketplace the client transacts on. |
| Sign-off principle | The fitter is never the sole judge. Every decision-grade model carries a named senior sign-off by someone other than the fitter. |
| **Export integrity** | **Uncertainty travels with the number. Every chart and every export (image, PDF, Excel) carries the credible interval, the as-of date, and the model version. A number must never escape its context.** |
| Data residency | Singapore region (PDPA-aligned) |

---

## 3. Delivery model & access

### 3a. The managed-bench model
Trifecta is accountable end to end. The platform is **Trifecta's delivery engine**, not a hiring marketplace — clients never shop for or transact with experts directly. Modelling is delivered by a fractional expert bench, starting with **one data scientist (Kisholoy)** and growing to a curated panel later. The workflow below is built for one and generalises to many with no rebuild. Each client has a **named lead data scientist** they know and can talk to. Trifecta owns the relationship, brand and margin.

### 3b. User management & access model — four user types
Every non-admin user is scoped to specific clients via a membership join; row-level security enforces it on every query.

**Type 1 — Trifecta in-house (admin / operator).** Rahul, Rajeev, future staff. Full access: all clients, user management, onboarding, Data Pipeline, Model Studio, training, Results, Signal, billing, the expert bench and assignments. The only type that can manage users and create clients. Seniors hold `can_sign_off` (Rajeev is day-1 reviewer).

**Type 2 — External experts (fractional DS bench).** Kisholoy now; panel later. Scoped to assigned clients only: Data Pipeline (read/operate), Model Studio (full — they fit), Training Runs, Results, client comms/Signal when needed. Cannot see unassigned clients, manage users, or see billing. `can_sign_off` held only by seniors; a fitter cannot sign off their own model. Under NDA + contractor DPA.

**Type 3 — External client users (data upload / collaborator).** Client marketing-ops / analyst. Scoped to their own client workspace, focused on ingestion: upload files, see mapping status, see ingestion/QA results. Cannot see Model Studio internals, model config, other clients, or Trifecta admin.

**Type 4 — External client users (Signal-only / decision-maker).** The CMO and decision-makers. See only the Signal chat for their client, scoped to the client's live model. No navigation to Pipeline, Model Studio, Training, or full Results dashboards. The MCP, posterior and machinery stay invisible. They ask; they get a model-grounded, uncertainty-honest answer. Everything behind it happens like magic. Full product spec in 3d.

#### Access matrix

| Surface / capability | T1 In-house | T2 Expert | T3 Client-upload | T4 Client-Signal |
|---|---|---|---|---|
| User management | Full | — | — | — |
| Client onboarding / create | Full | — | — | — |
| Billing & settings | Full | — | — | — |
| Data Pipeline | All clients | Assigned (operate) | Own (upload only) | — |
| Model Studio | All | Assigned (full) | — | — |
| Training Runs | All | Assigned | — | — |
| Sign-off action | Seniors | Seniors only, not own fit | — | — |
| Results dashboards | All | Assigned | Own (view, optional) | — |
| Signal chat | All | Assigned | Optional | **Own client only** |

> Highest-risk property in the whole build: a Type 4 user must **never** surface another client's data through Signal. The MCP server must be auth-scoped per request to exactly one client's posterior. Test explicitly (section 9).

### 3c. The model-fitting workflow & sign-off gate
`model_versions.status`: **draft → fitting → in_review → signed_off → live** (then `archived`).
- `fitted_by`, `reviewed_by`, `signed_off_at`.
- Promote-to-Live is gated on `signed_off`. No model reaches Results or Signal unsigned.
- System **enforces fitter ≠ reviewer**.
- **Lineage table** records every event (who, what, when): data loads, config changes, fits, refit cycles, reviews, sign-offs, ratings.
- Two ratings recorded (not yet driving pay): `client_satisfaction_rating` (client-entered, satisfaction/speed/clarity only — never model quality) and `technical_quality_rating` (reviewer-entered).

### 3d. The CMO Signal surface (Type 4) — product spec
For the CMO this is **the entire product**; everything else exists to make this one surface trustworthy. It must feel like a finished executive product, mobile-first (CMOs open it on a phone), MCP-backed and scoped to the client's live model.

**Phase 1 MVP (in M6):**
- **Persistent chat history** — messages stored per user/client; scroll back and revisit past conversations; tool results stored so charts re-render on reopen. (Search/threads deferred.)
- **Uncertainty-aware charts** — a defined set matched to the MCP tools: contribution bars, ROI-by-channel, response curves, budget-scenario. **Every chart shows the interval** (whiskers or shaded bands), never a bare point estimate. Executive styling in the brand palette; responsive.
- **Share-as-image (WhatsApp etc.)** — client-side render chart → PNG with the credible interval + as-of date + Trifecta logo baked in → native share sheet.
- **Freshness indicator** — when the model was last refreshed / which version is live (trust + traceability).

**Fast-follow (M6.5, first month post-launch — not a Phase 1 DoD gate):**
- **PDF export** of an answer or conversation — branded, carrying caveats + as-of/version footer.
- **Excel export** of the underlying numbers — including explicit lower/upper credible-interval columns so uncertainty survives in a spreadsheet.

**Deferred (Phase 2):** conversation search/threads, starter/suggested questions, scheduled monthly auto-PDF to the CMO.

**Hard requirement across all of the above:** the export-integrity rule (section 2) — interval, date, version on every chart and export.

---

## 4. In scope vs explicitly deferred

### In scope for Phase 1
- Supabase auth, the four user types, RBAC + row-level security, multi-tenancy
- Per-client GCP isolation (BigQuery dataset, GCS prefix, service account)
- Client onboarding + user/assignment management (in-house)
- Two ingestion paths: A (BigQuery-direct) and C (file upload + manual column mapping)
- Harmonisation SQL — raw to canonical weekly tables
- Model config persistence + lineage; runner refactor; translation layer (UI → spec)
- Editable Model Studio + cost-confirmation on training
- Model-fitting workflow with the sign-off gate (status flow, fitted_by/reviewed_by, fitter≠reviewer)
- Multi-tenant Results + Signal
- **CMO Signal MVP:** chat history, uncertainty-aware charts, share-as-image, freshness indicator
- **CMO export trio (M6.5 fast-follow):** PDF + Excel, post-launch
- Onboarding the first paying client end-to-end (Kisholoy fits, senior signs off, CMO uses Signal)

### Explicitly deferred (do NOT build in Phase 1)
- Comp automation / pay-by-volume-or-quality; expert rating dashboards; task-picking or bidding queues; panel routing
- Conversation search/threads, starter questions, scheduled auto-PDF
- ADH integration, customer journey, reconciliation engine
- AI-assisted column mapping, saved mapping templates
- Auto-pulled controls, vertical taxonomy library, auto-QA engine
- Portfolio operator console, scheduled refreshes, cross-client benchmarks

> Roles and the workflow are built now; the marketplace machinery on top of them waits until there's a panel and volume to justify it.

---

## 5. Build sequence

1. **Auth, four user types & multi-tenancy.** M1. Unblocks everything; the Phase 0 URL is not shareable until this lands.
2. **Onboarding + user/assignment management.** M2.
3. **Data ingestion.** M3. The thought-intensive part. Build whichever path client #1 needs; the other follows for client #2.
4. **Model config + runner refactor + editable Model Studio + sign-off workflow.** M4 and M5 together.
5. **Multi-tenant Results + Signal, incl. the CMO MVP (history, charts, share-as-image).** M6.
6. **First real client.** M7. Whole flow on real data; Kisholoy fits, senior signs off, CMO uses Signal. Document what hurts.
7. **CMO export trio.** M6.5 — fast-follow within the first month, shaped by the client's actual export requests.

---

## 6. Milestones

### M1 — Auth, user types & multi-tenancy
- Supabase Auth (email/password, 2FA); the four user types as roles; `can_sign_off` permission flag.
- Schema: `tenants, clients, users, user_clients` (membership + role join), `lead_ds` on `clients`; row-level security on every query.
- Per-client isolation: dedicated BigQuery dataset + GCS prefix.
- Role-aware routing: each type lands on its right surface (Type 4 lands directly in Signal, nothing else).
- **Done when:** each of the four types sees exactly its permitted surfaces for exactly its assigned clients; no cross-tenant path exists.

### M2 — Client onboarding & user management
- In-house "create client" provisions per-client GCP resources (manual acceptable for clients 1–2).
- In-house screen to invite/assign experts (T2) and client users (T3, T4) to a client; set `lead_ds`; grant/revoke.
- Client Settings screen functional.
- **Done when:** an admin can stand up a client, assign Kisholoy as lead DS, invite the client's upload user and CMO chat user, all correctly scoped.

### M3 — Data ingestion (manual but functional)
- **Path A — BigQuery-direct:** grant read to Trifecta service account; mapping UI to canonical schema (`time, geo, kpi, channels, controls, population`); mapping persisted, reusable.
- **Path C — File upload:** signed-URL upload to GCS; basic column-mapping UI (no AI assist); mapping persisted, reused.
- **Harmonisation SQL:** parameterised per client; writes canonical weekly tables; validate shape before training.
- Type 3 users can drive the upload path for their own client.
- **Done when:** one client's data, whatever shape, produces a clean canonical weekly table ready for Meridian.

### M4 — Model config persistence + runner refactor
- Schema: `model_configs, model_versions, training_runs` + lineage table.
- Refactor `services/meridian-runner` to read config from Supabase by `model_version_id`.
- Translation layer: UI fields (`roi_prior_mean`, `prior_strength`, `adstock_decay`, `saturation_hill`) → Meridian model spec.
- API routes: `POST /api/model-config` (save draft), `POST /api/training-runs` (trigger Vertex job).
- **Done when:** a config saved from the UI produces a Meridian run using it; posterior to GCS, diagnostics to Supabase, lineage recorded.

### M5 — Editable Model Studio + sign-off workflow
- All Model Studio inputs write to Supabase (currently read-only).
- "Train new version" with cost-confirmation dialog.
- Training Runs screen: queued → running → completed / failed with diagnostics.
- Sign-off workflow: status flow; `fitted_by`/`reviewed_by` captured; system blocks signing off own fit; Promote-to-Live gated on `signed_off`.
- Two rating fields captured (recorded only).
- **Done when:** Kisholoy can fit a version, send to review, a senior signs it off, and only then does it promote to Live and feed Results + Signal.

### M6 — Multi-tenant Results + Signal (incl. CMO MVP)
- MCP server: per-client posterior loading from a path encoded in the auth token; every tool call scoped to one client.
- Results: API routes read the right client's outputs per authenticated user.
- **CMO Signal surface (Type 4):** standalone chat, no other navigation, scoped to the client's live model, powered by Claude + the per-client Trifecta MCP server. Includes:
  - Persistent chat history (per user/client; tool results stored for re-render).
  - Uncertainty-aware charts (defined set; every chart shows the interval; brand styling; responsive).
  - Share-as-image: chart → PNG with interval + as-of date + logo baked in → native share sheet.
  - Freshness/as-of indicator.
- **Done when:** two clients exist; a Type 4 CMO for client A sees only client A's chat, with history, charts and image-share working, and can never reach client B's data; experts and in-house see their permitted scope.

### M6.5 — CMO export trio (fast-follow, first month post-launch; not a Phase 1 DoD gate)
- **PDF export** of an answer or conversation — branded; caveats + as-of/version footer.
- **Excel export** of underlying numbers — explicit lower/upper credible-interval columns.
- Both obey the export-integrity rule (section 2).
- **Done when:** a CMO can export a chart/answer to a branded PDF and the underlying numbers to Excel, both carrying interval + date + version.

### M7 — First client onboarding
- One paying client end-to-end: in-house onboards, Kisholoy fits, senior signs off, CMO uses Signal.
- Document friction in `docs/phase1b-notes.md` — every painful manual step.
- **Done when:** one paying client is live, the CMO is asking Signal questions against a signed-off model trained on their real data.

---

## 7. Discipline — `phase1b-notes.md`

Biggest risk in Phase 1 is scope creep into accelerators and marketplace machinery that haven't earned their time. During M1–M7, log every tempting feature with one line of context, then **don't build it**:

```
2026-06-12 | M3 | 40 min mapping Aeon's Meta export. AI-assist would cut repeat refreshes to ~5 min.
2026-06-18 | M6 | CMO asked to compare two months side by side in chat. Worth a comparison view later.
```

After M7 that file is the Phase 2 priority list, ranked by how often each pain recurred.

---

## 8. Prerequisites — in parallel with the build

**This week:**
- **Lock pricing.** Setup fee + monthly retainer; tiered by lead-DS seniority once the panel grows. Decide and stop revisiting.
- **Shareholder agreement with Rajeev** (deadlock mechanism before money flows).
- **Kisholoy engagement:** contractor vs fractional retainer vs equity-track; sign **NDA + contractor DPA** before he touches client data; simple per-project/retainer comp for now; client-facing bio/credential line.
- **Designate the day-1 reviewer** (Rajeev or Krishnamurthy) so fitter ≠ signer holds from client #1.
- **SOW + DPA templates** (PDPA-aligned).

**This month:**
- Convert top 2–3 prospects with pricing proposals + draft SOW.
- Billing infra (Xero).
- Client offboarding / data-deletion policy.

---

## 9. Working with Claude Code on a multi-week build

- **Feature branches always** (`feature/M3-ingestion`); never on `main`.
- **One milestone per arc;** end each session with a working commit.
- **Test where stakes are real — four places above all:**
  1. **Cross-tenant isolation** and the **Type 4 Signal property** (a CMO can never reach another client's data via chat). Catastrophic-leak surface.
  2. The **fitter ≠ reviewer** enforcement and **promote-gated-on-sign-off**.
  3. The **translation layer** (UI → Meridian spec) and **harmonisation SQL**.
  4. **Export integrity** — every chart and export carries interval + as-of date + model version. Write a test that fails if any export omits them.
- **Remote Control + Tailscale** for long jobs; check from phone.
- **Step away when stuck.** Commit what works, take a break.
- **Keep `docs/` current** — this brief is Claude Code's memory.

---

## 10. Open question shaping M3

Are the most-likely-to-sign clients on **(a)** data already in BigQuery → prioritise Path A, or **(b)** spreadsheets / agency files → prioritise Path C? Build client #1's path first; the other follows for client #2. Don't build both perfectly in parallel.

---

## 11. What to do this week

1. Brief a lawyer on the shareholder agreement; runs in parallel.
2. Settle Kisholoy's engagement terms, NDA + DPA, bio. Designate the reviewer.
3. Send pricing proposals to top 2–3 prospects; ask BigQuery-vs-spreadsheet (answers section 10).
4. Start **M1** — auth, the four user types, multi-tenancy.
5. Decide pricing; stop revisiting after this week.

---

## 12. Definition of Done — Phase 1

One paying client, fully onboarded and live:
- Four user types working with correct scoping — in-house full; Kisholoy scoped to assigned client; client upload-user limited to ingestion; client CMO limited to Signal.
- Client data ingested via the right path, harmonised into canonical weekly tables.
- Meridian model configured and trained on Vertex; **fitted by Kisholoy, signed off by a senior who did not fit it**; only then promoted to Live.
- Results showing the client's numbers.
- **CMO Signal surface working as a finished product:** chat with persistent history, uncertainty-aware charts, share-as-image, freshness indicator, MCP-backed and scoped to that client — and every chart carrying its interval.
- No cross-tenant leakage anywhere, Signal included.
- Lineage and both ratings recorded for the engagement.

(PDF + Excel export, M6.5, follow within the first month and are not gates.)

When that's true, Phase 1 is done.

---

## 13. After Phase 1 (placeholder)

- **Phase 2 — Accelerators + panel mechanics + CMO depth.** From `phase1b-notes.md`: AI-assisted mapping, templates, auto-controls, auto-QA, portfolio console; the panel layer (rating dashboards, comp formula, assignment routing) once there's a panel and volume; CMO conversation search, starter questions, scheduled auto-PDF.
- **Phase 3 — Third pillar.** ADH integration, reconciliation engine, customer journey, experiment registry, cross-client benchmarks.

Neither is in scope until Phase 1 lands a real client and surfaces the actual pain.
