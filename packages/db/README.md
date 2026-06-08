# `packages/db` — Trifecta Platform app database

Supabase / Postgres schema for **platform state only** — tenants, clients, users and
role joins. Marketing data lives in BigQuery; fitted models in GCS (see
`docs/technical-architecture.md` §4.2). Multi-tenancy is enforced by **row-level
security on every table**, not by application code.

## Files
- `schema.sql` — tables, helper functions, the signup trigger, RLS policies, grants. Idempotent.
- `seed.sql` — the Trifecta tenant + demo client portfolio, plus a one-time operator bootstrap block.
- `test/rls.test.sql` — proves no cross-tenant leakage. Runs in a transaction and rolls back.

## Apply (one-time, per Supabase project)

1. Create the Supabase project; copy the project URL + anon key + service-role key
   into `apps/web/.env.local` (see `apps/web/.env.local.example`) and Vercel.
2. Apply the schema and seed (Supabase SQL editor, or `psql`):
   ```bash
   psql "$SUPABASE_DB_URL" -f packages/db/schema.sql
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
psql "$SUPABASE_DB_URL" -f packages/db/test/rls.test.sql   # prints "RLS TEST PASSED"
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
