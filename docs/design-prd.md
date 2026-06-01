# Trifecta Platform — Design PRD (Wireframe Brief)

**Purpose:** a complete, self-contained brief for generating an end-to-end, navigable **wireframe** of the Trifecta Platform.
**Intended use:** paste this whole document into Claude and ask it to produce the wireframe as a single interactive artifact.
**Fidelity:** mid-fidelity wireframe — real structure, real labels, real navigation; data visualisations shown as labelled placeholders.
**Status:** v1.0 — design phase (code comes after the wireframe is approved).

---

## How to use this brief

This document is written so it can be handed to a fresh Claude session with **no prior context**. It contains everything needed: the product, the users, the visual direction, the full screen-by-screen specification, and the output format.

Suggested prompt to accompany it:
> "Using the design PRD below, build the Trifecta Platform as a single navigable React artifact — a mid-fidelity wireframe covering every screen, with working sidebar navigation. Follow the visual direction and screen specs exactly."

If the full build is too large for one generation, ask for it in three passes: (1) shell + Login + Dashboard, (2) the client modules, (3) Model Library + Settings — then have them combined.

---

# Part A — Product Context

## A.1 What Trifecta is
Trifecta Consulting Group is a two-person consultancy that delivers **Marketing Mix Modelling (MMM) as a managed service**. It builds Bayesian causal models — using Google's open-source **Meridian** library — that tell a brand how much each marketing channel actually drives revenue, and how to reallocate budget.

The **Trifecta Platform** is the internal software the two operators use to run this service. It is the system that lets two people manage many clients without quality loss. It is *not* a self-serve SaaS — it is an operator console, with a thin client-facing layer ("Signal") on top.

## A.2 The problem the platform solves
The hard part of MMM is **not the model** — Meridian is free and open source. The hard parts are:
1. **Data.** Getting every marketing input into one clean weekly time series. Some sources have APIs (Google Ads, Meta); many do not — **TV, radio, print, out-of-home, cinema**, and also a large share of *digital* spend (direct programmatic buys, smaller DSPs, influencer/creator, podcasts, affiliates) whenever a brand has no ad server. Everything without an API arrives as inconsistent spreadsheets, at different cadences, always late. The real divide is **API-available vs. not** — not digital vs. traditional.
2. **Configuration.** Every brand needs a *different* model — different channels, different prior beliefs, different carry-over and saturation assumptions.
3. **Trust.** Turning a statistical model into decisions a non-technical executive will act on.

The platform makes all three **repeatable** so two operators can run a portfolio of clients.

## A.3 Users & roles
- **Operator (Admin)** — the two founders (e.g. "Rajeev Bala"). Full access. Runs data pipelines, configures models, triggers training, reviews results. This is the primary user of every screen in this brief.
- **Client viewer** — staff at a client brand (e.g. a Head of Growth). Limited, read-oriented access — mainly the "Signal" conversational layer and reports. *The client view is out of scope for this wireframe; design the operator console only, but show where client access is configured.*

## A.4 Key vocabulary (use these exact terms in the UI)
- **MMM** — Marketing Mix Model. **Meridian** — Google's open-source MMM library the platform is built on.
- **Channel** — a marketing input (TV, Meta, etc.).
- **Connection method** — how a data source reaches the platform: API, Feed (SFTP), Upload (Excel/CSV), Manual entry, or Warehouse. Independent of whether the channel is digital or offline.
- **Prior** — the model's starting belief about a channel's effectiveness. In the UI this is the channel's configurable "weight".
- **Prior strength** — how strongly the prior is enforced vs. how much the brand's own data can override it.
- **Adstock / carry-over** — how long a channel's effect lingers after spend.
- **Saturation** — diminishing returns as spend rises (a "Hill" curve).
- **Calibration** — anchoring the model to measured results from geo-holdout incrementality experiments.
- **Model version** — a saved configuration; each client has its own versioned model (v1, v2, v3…).
- **Model readiness** — a 0–100% score of how prepared a client's data + config is for the next training run.

---

# Part B — Design Direction

## B.1 Tone
Technical, precise, confident, calm. The feeling of a serious analytics instrument — "a Bloomberg terminal with a clear head". Dense where it needs to be, never cluttered. This is a tool for experts; it should look like one.

## B.2 Theme & colour
Dark theme throughout. Use these exact values as CSS variables:

| Token | Hex | Use |
|---|---|---|
| `bg` | `#070b16` | App background |
| `panel` | `#0d1322` | Sidebar, raised surfaces |
| `panel2` | `#111a2c` | Cards |
| `panel3` | `#0a0f1d` | Inset fields, placeholders |
| `line` | `#1d2740` | Borders, dividers |
| `line2` | `#2a3656` | Stronger borders |
| `text` | `#e9edf8` | Primary text |
| `dim` | `#8b97b0` | Secondary text |
| `faint` | `#5c6883` | Tertiary / labels |
| `blue` | `#4f6ef2` | Primary accent, primary buttons |
| `sky` | `#7d9bff` | Highlights, active icons |
| `mint` | `#37d39b` | Healthy / live / automated |
| `amber` | `#e6b052` | Action needed / manual |
| `red` | `#e87a70` | Stale / blocked / error |

**Status semantics (apply consistently):** mint = healthy/live/automated · amber = action needed/manual file · red = stale/missing/blocked · sky/blue = informational/in-progress.

## B.3 Typography
- **Display / headings:** `Bricolage Grotesque` (700–800 weight), tight letter-spacing.
- **Body / UI:** `Hanken Grotesk` (400–600).
- **Numbers, data, IDs, technical values:** `JetBrains Mono`.
Load via Google Fonts. Do not use Inter, Roboto, or system fonts.

## B.4 Logo
A small rounded square rotated 45°, filled with a blue→mint gradient, with a small dark notch cut into the centre. Wordmark "TRIFECTA" in the display font.

## B.5 Fidelity rules
- This is a **wireframe**: prioritise structure, layout and labelling over polish.
- **Data visualisations** (charts, graphs, curves) are rendered as **labelled dashed-border placeholders** — e.g. a box reading `[ channel contribution — chart ]`. Do not build real charts.
- **Forms are fully drawn** — toggles, sliders, dropdowns, input fields all rendered as real (if non-functional) components.
- **Navigation must work** — clicking sidebar items and key buttons changes the screen.
- Use realistic placeholder content (see the sample data in Part D), not lorem ipsum.
- Include a small "Wireframe · v1.0" badge in the top bar.

---

# Part C — Information Architecture & Global Shell

## C.1 Screen map
```
Login  (no shell)
└── App shell (persistent sidebar + top bar)
    ├── WORKSPACE
    │   ├── Dashboard            — portfolio of all clients
    │   └── Model Library        — reusable model templates
    ├── CLIENT  (context: one selected client)
    │   ├── Data Pipeline        — data source ingestion & harmonisation
    │   ├── Model Studio         — per-brand model configuration  ← core screen
    │   ├── Training Runs        — trigger Meridian training, run history
    │   ├── Results              — model outputs
    │   ├── Signal               — client-facing chat layer config
    │   └── Client Settings      — engagement, users, data residency
    └── SYSTEM
        └── Settings             — team, auth, infrastructure, billing
```

## C.2 App shell
- **Left sidebar** (~210px, `panel` background):
  - Logo + "TRIFECTA" wordmark at top.
  - Nav grouped under labels: `WORKSPACE`, `CLIENT`, `SYSTEM`.
  - The `CLIENT` group has a client-selector header (shows the active client name, e.g. "Aeon Skincare", with a dropdown chevron) followed by the six client module links.
  - Active item: highlighted background + a 2px `blue` left border + `sky` icon.
  - Bottom: a "Sign out — rajeev@trifecta.sg" row.
- **Top bar:** screen title (display font) + a one-line description of the screen's purpose underneath + the "Wireframe · v1.0" badge on the right.
- **Main content area:** scrollable, ~22px padding.
- Responsive: on narrow screens the sidebar may stack above the content.

---

# Part D — Screen Specifications

For each screen: **Purpose**, **Layout**, **Content**. Sample data is fictional ("Aeon Skincare" is the active demo client).

## D.1 Login
**Purpose:** operator authentication.
**Layout:** centred card (~360px) on the dark background with a subtle radial glow at top.
**Content:**
- Logo + "TRIFECTA" wordmark; subtitle "Operator Console — sign in".
- Email field (with mail icon, prefilled `rajeev@trifecta.sg`).
- Password field (with lock icon, masked dots).
- Primary "Sign in" button (full width) → navigates to **Dashboard**.
- Small footer line with a shield icon: "Protected by 2-factor authentication".

## D.2 Dashboard (Portfolio)
**Purpose:** see every client and what needs attention.
**Layout:** vertical stack.
**Content:**
1. **Lifecycle strip** — a horizontal row of 5 connected steps with arrows: `Connect data → Configure model → Train & calibrate → Analyse results → Signal (client)`. Labelled "Platform lifecycle — every client moves through this".
2. **Portfolio stat tiles** (row of 4): `4 Active clients` · `3 Models live` · `10 Open actions` (amber) · `28 May Next training run`.
3. **Client portfolio** — a responsive grid of client cards. Each card: client name, status tag, model version + last/next run, a "model readiness" progress bar with %, and an actions line ("3 actions pending" in amber, or "No actions pending" in faint with a check). Cards are clickable → enter that client (go to **Model Studio** or **Data Pipeline**).
   Sample clients:
   - Aeon Skincare — 78% — v3 · live — Next run 01 Jun — 3 actions — *Action needed* (amber)
   - Northwind Coffee — 100% — v5 · live — Trained 12 May — 0 actions — *Healthy* (mint)
   - Lumio Home — 64% — v2 · draft — Onboarding — 6 actions — *Onboarding* (sky)
   - Vega Mobility — 92% — v4 · live — Next run 28 May — 1 action — *Healthy* (mint)
4. An "Add client" button near the portfolio heading.

## D.3 Data Pipeline
**Purpose:** connect, harmonise and QA every data source feeding the model. This screen carries the message that offline media data — not the model — is the hard part.
**Layout:** vertical stack.
**Content:**
1. **Readiness banner** — large "78%" with a progress bar; caption "~20 sources · ~70 raw line items → 23 model variables · weekly, Jan 2024 – Apr 2026"; a "Connect source" button.
2. **Pipeline stages strip** — 4 connected stages with arrows: `Intake (~20 sources)` → `Validate (2 warnings)` → `Harmonise (~70 → 23)` → `Model-ready (78%)`.
3. **Connection method is independent of channel type.** Every source row carries one of five **connection-method tags** — `API` (auto), `Feed` (scheduled SFTP), `Upload` (Excel/CSV file), `Manual entry` (hand-keyed), `Warehouse` (auto). Any source — digital *or* offline — can use any method. A brand with no ad server uploads its display and programmatic numbers in a spreadsheet exactly as it does its TV. The platform must treat an uploaded digital source as a first-class citizen, with the same column-mapping and QA as offline media. **Do not assume digital = API.**
4. **Data sources, grouped into 4 category cards.** Each source row shows: icon, name, cadence + coverage, a connection-method tag, and a status tag. Rows with a problem show an inline warning line.
   - **Paid media — Digital** — *mixed methods, not all-API*. `API · auto`: Google Ads, Meta Ads, TikTok Ads. `API`: DV360 / ad server — **but only if the client has one; many do not**. `Upload` (Excel/CSV): direct programmatic & smaller-DSP buys, influencer / creator spend, podcast & audio, affiliate networks without an API, publisher direct buys. Show at least two upload-method digital rows so the wireframe makes this explicit — e.g. "Programmatic (direct buy)" (*Upload*, monthly — Live) and "Influencer / creator" (*Upload*, monthly — **Action needed:** "April spend file not yet received").
   - **Paid media — Traditional** (note: "No APIs exist — each arrives as an agency file, no two formats alike."): TV (*Feed*, GRPs + spend, weekly — **Action needed:** "Agency changed file layout — 3 columns need remapping"); Radio (*Upload*, weekly — Live); Print (*Upload*, monthly — **Stale:** "Last file 41 days old"); Out-of-Home (*Upload*, monthly — Live); Cinema (*Manual entry*, monthly — Live).
   - **Business outcomes** (method: *Warehouse · auto*): Sales / Revenue (DTC + retail POS), Web conversions (GA4).
   - **Control variables & external signals** (note: "Without these, media takes credit for things it didn't cause."): Price index, Promotions calendar, Distribution / availability (**Action needed**), Competitor media (estimate), Weather, Google query volume, Consumer confidence.
5. **Manual-upload & column-mapping path.** When a source is connected by `Upload`, the operator maps the client's spreadsheet columns to the platform's canonical schema (channel, week, spend, impressions/exposure, geography). Saved mappings are reused for future files; if a file's layout changes, the source flags "needs remapping" (as the TV row shows). This same upload-and-map flow applies to digital and offline sources alike — it is the platform's most-used ingestion path, not an edge case. The wireframe should show this as an "Upload & map" action available on any `Upload` source row.
6. **Right-hand panels:** a "Harmonisation engine" panel (a small funnel: ~20 sources → ~70 raw line items → 23 model variables → 122 weekly rows); a "Data coverage" panel (a few sources as horizontal coverage bars, showing manual sources — digital and offline — lagging); an "Action queue" panel listing the open items above.
7. A callout box: "The model is the easy 20%. The hard part is everything without an API — offline media *and* a large share of digital spend — arriving as inconsistent spreadsheets. The platform templates the upload-and-harmonise work once, so two people can repeat it across every client."

## D.4 Model Studio  ★ core screen
**Purpose:** configure the brand-specific MMM. Every client has a different model; this is where its channels, priors ("weights"), carry-over, saturation and calibration are set and versioned.
**Layout:** version bar at top, then an internal tab row, then tab content.
**Content:**

**Version bar:** model icon + "Aeon MMM — v3" + subtitle "Bayesian MMM · Google Meridian" + a "Live" tag; buttons "New version" and "Save as template".

**Internal tabs:** `Channels & Priors` · `Control Variables` · `Calibration` · `Model Settings` · `Versions`.

**Tab 1 — Channels & Priors** (the heart of the platform):
- A **channel table**. Columns: `Channel` · `Include` (toggle) · `ROI prior (μ)` · `Strength` · `Adstock` · `Prior source`.
  Sample rows: TV (1.8x, Strong, 0.72, "Geo-test + category"); Radio (1.4x, Medium, 0.55, "Category prior"); Print (1.1x, Weak, 0.40, "Default"); Out-of-Home (1.3x, Medium, 0.50, "Category prior"); Meta (2.4x, Strong, 0.30, "Mar 2026 geo-test"); YouTube (3.0x, Medium, 0.35, "Prior model v2"); TikTok (2.6x, Weak, 0.25, "Default"); Paid Search (2.0x, Medium, 0.15, "Calibrated"); Programmatic (excluded — toggle off, row dimmed).
  Rows are selectable; the selected row drives the detail panel below.
- A **channel detail panel** for the selected channel showing the full prior configuration: a "ROI prior (μ)" slider with value; a "Prior strength (σ)" slider with the caption "how hard the data can override this belief"; an "Adstock / carry-over decay" slider; two placeholder charts — `[ ROI prior distribution ]` and `[ saturation (Hill) curve ]`; buttons "Apply experiment result" and "Reset to template".
- An explainer callout: "Per-brand model weights. Priors are the model's starting beliefs about each channel; strength controls how much the brand's own data can move them. Every client runs a different configuration — tuned from category benchmarks, prior model versions, and that brand's own incrementality tests."

**Tab 2 — Control Variables:** a list of control variables, each with an include toggle and a one-line description: Price index, Promotions calendar, Distribution / availability, Competitor media, Weather, Google query volume, Consumer confidence (toggled off), Seasonality (Fourier).

**Tab 3 — Calibration:** intro line "Geo-holdout test results are injected as priors so the model is anchored to measured causal lift"; an "Add calibration" button; a list of experiments each linked to a channel prior with an applied/not-run status: Meta geo-holdout (Mar 2026 → Meta ROI prior, Applied); TV regional lift (Q4 2025 → TV ROI prior, Applied); TikTok holdout (Proposed → TikTok ROI prior, Not yet run).

**Tab 4 — Model Settings:** a grid of fields: Outcome/KPI (Revenue, SGD); Geography level (National + 5 regions); Time granularity (Weekly); Training window (Jan 2024 – Apr 2026, 122 wks); Holdout for validation (Last 8 weeks); Media effect prior (LogNormal ROI); Reach & frequency channels (TV, YouTube); Sampler (Meridian — NUTS, 4 chains).

**Tab 5 — Versions:** a list of model versions, each with a status tag and diagnostics: v3 (Live — trained 12 May 2026, "R-hat 1.01 · holdout MAPE 9%"); v2 (Archived — 03 Apr 2026, "Pre-Meta calibration"); v1 (Archived — 28 Feb 2026, "Initial build"). Each row has a "Compare" action.

## D.5 Training Runs
**Purpose:** trigger Meridian training and review run diagnostics. This is where the platform connects to the Meridian compute backend.
**Layout:** a "next run" config card, then a run-history table.
**Content:**
- **Next run — configuration card:** fields for Model version (Aeon MMM v3), Data window, Compute (Meridian · Vertex AI GPU); a "Start training run" primary button; an info line: "Training runs on GPU as a batch job; the posterior artifact is saved to GCS and becomes the source for Results and Signal."
- **Run history table.** Columns: Run ID · Version · Started · Duration · Status · R-hat · MAPE. Sample: #28 (v3, 12 May 09:14, 2h 41m, Success, R̂ 1.01, MAPE 9%); #27 (v3, 01 May, 2h 38m, Success, 1.01, 10%); #26 (v2, 03 Apr, 2h 51m, Success, 1.02, 12%).

## D.6 Results
**Purpose:** view model outputs.
**Layout:** an internal tab row, then a content card.
**Content:** tabs `Channel contribution` · `ROI & marginal ROI` · `Response curves` · `Budget optimiser`. Each shows a large labelled placeholder chart and an "Export report" button. Caption: "Every figure carries a 90% credible interval. Results read from the latest posterior artifact."

## D.7 Signal
**Purpose:** configure the client-facing conversational decision layer (a chat interface, built as an MCP server over the trained model).
**Layout:** a tool-configuration card, then a client-access card.
**Content:**
- Intro: "The client-facing conversational layer. Choose which tools are exposed to this client." A "Preview Signal" button.
- A grid of toggleable tools: Channel contribution, Marginal ROI, Budget scenario, Budget optimiser, Measurement reconciliation, Model health, Experiment proposals (off), Decision log.
- Client access list: maya@aeonskincare.com (Head of Growth), sam@aeonskincare.com (Marketing Analyst).

## D.8 Client Settings
**Purpose:** engagement, users and data residency for the active client.
**Content:**
- **Engagement card** — fields: Client legal name; Engagement value (USD 54,000 / year); Model refresh cadence (Monthly); Contract term (12 months · renews Feb 2027); Data residency (Singapore, asia-southeast1); GCP project (trifecta-aeon-prod).
- **Client users card** — list with roles (Editor / Viewer); an "Invite" button.

## D.9 Model Library
**Purpose:** reusable model archetypes so a new client never starts from zero.
**Content:** intro line "Reusable model archetypes — channel sets, priors and adstock defaults. Clone one to start a new client model, then tune it per brand in Model Studio." A grid of template cards: DTC E-commerce (digital-led, 8 channels, 6 clients); FMCG / Retail (offline-heavy, 11 channels, 3 clients); Subscription / SaaS (lead-gen funnel, 7 channels, 2 clients); Travel & Hospitality (strong seasonality, 9 channels, 1 client). Each card has a "Use template" button (→ Model Studio).

## D.10 Settings (operator)
**Purpose:** team, authentication, backend infrastructure, billing.
**Layout:** internal tab row.
**Content:**
- **Team & Access:** operator list with roles — Rajeev Bala (Admin · Owner), Partner (Admin); note "Roles: Admin · Analyst · Client-viewer".
- **Authentication:** Password policy (12+ chars, 90-day rotation — on); Two-factor authentication (required — on); Single sign-on (Google Workspace — off). Each as a labelled row with a toggle.
- **Infrastructure:** the backend connections, each as a row with an icon and a status tag — BigQuery (warehouse — Connected); Cloud Storage / GCS (posterior artifacts — Connected); Meridian compute (Vertex AI GPU — Connected); Ads Data Hub (privacy-safe attribution — *Access pending*, amber). Intro line: "How the platform connects to the Meridian stack. One isolated set per client."
- **Billing:** Plan; GPU compute this month (34.5 hrs); BigQuery storage (118 GB across 4 clients); Billing contact.

---

# Part E — Component Library

Build these reusable components and use them consistently:
- **Card** — `panel2` background, `line` border, ~12px radius.
- **Tag / status chip** — small uppercase mono label, coloured by status semantics; a "solid" variant for emphasis (filled background, dark text).
- **Button** — three kinds: *primary* (filled blue), *ghost* (transparent, `line2` border), *mint* (subtle mint). Optional leading icon.
- **Toggle** — pill switch, blue when on.
- **Slider** — thin track with a filled portion and a white handle dot; used for priors, strength, adstock.
- **Field** — uppercase label above a bordered inset box showing a value (read-only in the wireframe).
- **Placeholder chart (`Skel`)** — dashed-border box with a diagonal-hatch fill and a centred mono label like `[ contribution — chart ]`.
- **Table row** — used for channels, runs, versions; consistent grid columns, `line` dividers, hover highlight.
- **Section header** — display-font heading with an optional right-aligned action.
- **Nav item** — sidebar link with icon, active state (highlight + blue left border).
- **Progress bar** — thin rounded track; blue→mint gradient fill, solid mint at 100%.
- **Lifecycle / stage strip** — connected step blocks with arrows between them.

Use icons from a standard icon set (e.g. Lucide) — line-weight, ~14–16px, tinted `faint` when inactive and `sky` when active.

---

# Part F — Key Flows (navigation that must work)

1. **Login → Dashboard** — "Sign in" leads into the app shell on the Dashboard.
2. **Dashboard → Client** — clicking a client card enters that client's modules.
3. **Sidebar navigation** — every nav item switches the main content; active state updates.
4. **Model Studio tabs** — switching the five internal tabs swaps content; selecting a channel row updates the detail panel.
5. **Model Library → Model Studio** — "Use template" lands in Model Studio (as a new model version).
6. **Settings tabs** and **Results tabs** — internal tab switching works.
7. **Sign out** — returns to the Login screen.

---

# Part G — Output Instructions

- Deliver as **one self-contained React artifact** (single file, default export).
- Manage screen state in React state; no router needed.
- Use inline styles or a single injected `<style>` block with CSS variables for the palette. No external chart libraries — charts are placeholders.
- Load the three Google Fonts named in B.3.
- No `localStorage` or browser storage.
- Make navigation genuinely interactive per Part F.
- Keep it a **wireframe**: structural clarity over visual richness, data viz as labelled placeholders, but forms and navigation fully rendered.
- Include the "Wireframe · v1.0" badge in the top bar and a faint footer line: "Design blueprint · navigable wireframe · fictional data."

---

# Part H — Out of Scope (do not design)

- The client-facing experience itself (only the operator console; show where client access is *configured*).
- Real charts, real data, or real model computation.
- The build/engineering architecture, data schemas, or APIs — those belong in the separate engineering PRD.
- Onboarding flows, empty states, and error pages beyond what is specified above.

---

*End of brief. This document defines the design scope only. Once the wireframe is approved, a separate engineering PRD will govern the build.*
