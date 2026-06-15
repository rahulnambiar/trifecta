# `packages/db` — Trifecta Platform app database

Supabase / Postgres schema for **platform state only** — tenants, clients, users and
role joins. Marketing data lives in BigQuery; fitted models in GCS (see
`docs/technical-architecture.md` §4.2). Multi-tenancy is enforced by **row-level
security on every table**, not by application code.

## Files
- `schema.sql` — M1 tables (tenants/clients/users/user_clients), helper functions, the signup
  trigger, RLS policies, grants. Idempotent.
- `model_schema.sql` — M4/M5 tables (`model_configs`, `model_versions`, `training_runs`,
  `model_lineage`) + the in-database **sign-off gate**. Apply AFTER `schema.sql`. Idempotent.
- `seed.sql` — the Trifecta tenant + demo client portfolio, plus a one-time operator bootstrap block.
- `test/rls.test.sql` — proves no cross-tenant leakage. Runs in a transaction and rolls back.
- `test/signoff.test.sql` — proves the sign-off gate (fitter ≠ reviewer, seniors-only sign-off,
  promote-gated-on-sign-off, one-live-per-client, and that T3/T4 users can't see model internals).

## The sign-off gate (`model_versions`)

`model_versions.status` flows **draft → fitting → in_review → signed_off → live** (then `archived`),
enforced by a trigger so the rule lives in the database, not just the app:
- Promote-to-Live is an **illegal transition** before `signed_off` — no model reaches Results/Signal unsigned.
- A `reviewer` can **never** be the `fitter` (table CHECK + trigger).
- Only a **senior** (`users.can_sign_off`) may sign off, and the sign-off must be performed **by that
  reviewer themselves** (anti-spoof on `auth.uid()`).
- At most **one live version per client** (partial unique index).
- Model internals (`model_configs`/`model_versions`/`training_runs`/`model_lineage`) are visible to
  **in_house + assigned experts only** (`can_operate_client()`), never to T3/T4 client users.
- `model_lineage` is append-only (select + insert grants only).

## Apply (one-time, per Supabase project)

1. Create the Supabase project; copy the project URL + anon key + service-role key
   into `apps/web/.env.local` (see `apps/web/.env.local.example`) and Vercel.
2. Apply the schema and seed (Supabase SQL editor, or `psql`):
   ```bash
   psql "$SUPABASE_DB_URL" -f packages/db/schema.sql        # M1 — auth & tenancy
   psql "$SUPABASE_DB_URL" -f packages/db/model_schema.sql  # M4/M5 — model + sign-off
   psql "$SUPABASE_DB_URL" -f packages/db/seed.sql
   ```
3. Create the operator auth user `rajeev@trifecta.sg` via Supabase Auth
   (Dashboard → Authentication → Add user, or the app's Login once configured).
   The `handle_new_user` trigger creates a least-privileged `client_signal` profile
   attached to the single tenant.
4. Promote that user to `in_house` operator (+ `can_sign_off`) and join them to every
   client: uncomment and run the bootstrap block at the bottom of `seed.sql`.

## Test

```bash
psql "$SUPABASE_DB_URL" -f packages/db/test/rls.test.sql      # prints "RLS TEST PASSED"
psql "$SUPABASE_DB_URL" -f packages/db/test/signoff.test.sql  # prints "SIGN-OFF TEST PASSED"
```

## User types (brief v4.0 §3b) — `users.role`
- `in_house` (T1) — Trifecta operator/admin. Every client in the tenant; user mgmt,
  onboarding, billing. The only type that creates clients/users.
- `expert` (T2) — fractional DS bench. Scoped to assigned clients; fits models.
- `client_upload` (T3) — client marketing-ops. Own client, ingestion only.
- `client_signal` (T4) — the CMO / decision-maker. Own client's Signal chat ONLY.
  Highest-risk isolation surface — covered by `test/rls.test.sql` TEST 2/3.

`can_sign_off` is an orthogonal flag (only seniors hold it); the M5 sign-off workflow
enforces fitter ≠ reviewer. `clients.lead_ds` names each client's lead data scientist.

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — server-side provisioning only (M2). Never ship it to the browser.
