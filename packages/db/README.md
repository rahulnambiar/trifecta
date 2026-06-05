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
   The `handle_new_user` trigger creates a `client-viewer` profile attached to the
   single tenant.
4. Promote that user to operator + join them to every client: uncomment and run the
   bootstrap block at the bottom of `seed.sql`.

## Test

```bash
psql "$SUPABASE_DB_URL" -f packages/db/test/rls.test.sql   # prints "RLS TEST PASSED"
```

## Roles
- `admin` (operator) — sees/manages every client in their tenant.
- `client-viewer` — sees only the clients listed in `user_clients`.

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS — server-side provisioning only (M2). Never ship it to the browser.
