-- Trifecta Platform — seed data (Phase 1 · M1)
-- Seeds the Trifecta tenant + the demo client portfolio so the console renders
-- real, tenant-scoped data. The operator auth user is created via Supabase Auth
-- (it cannot be inserted directly into auth.users from SQL) — see the bootstrap
-- block at the bottom to run ONCE after that user has signed up.
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f packages/db/seed.sql   (after schema.sql)
-- Idempotent.

-- The single Phase 1 workspace tenant.
insert into public.tenants (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Trifecta')
on conflict (id) do nothing;

-- Demo portfolio (mirrors the Phase 0 TRIFECTA_DATA.clients). Aeon Skincare is
-- the live demo client backed by the real Meridian posterior.
insert into public.clients (tenant_id, name, slug, version, state, readiness, actions, run_label, status, data_residency, gcs_prefix)
values
  ('00000000-0000-0000-0000-000000000001', 'Aeon Skincare',    'aeon',      'v3', 'live',       78, 3, 'Next run 01 Jun', 'Action needed', 'asia-southeast1', 'aeon'),
  ('00000000-0000-0000-0000-000000000001', 'Northwind Coffee', 'northwind', 'v5', 'live',      100, 0, 'Trained 12 May',  'Healthy',       'asia-southeast1', null),
  ('00000000-0000-0000-0000-000000000001', 'Lumio Home',       'lumio',     'v2', 'draft',      64, 6, 'Onboarding',      'Onboarding',    'asia-southeast1', null),
  ('00000000-0000-0000-0000-000000000001', 'Vega Mobility',    'vega',      'v4', 'live',       92, 1, 'Next run 28 May', 'Healthy',       'asia-southeast1', null)
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- BOOTSTRAP — run ONCE after rajeev@trifecta.sg has signed up via Supabase Auth.
-- The handle_new_user() trigger will have created a 'client-viewer' profile
-- attached to the single tenant; this promotes that profile to operator (admin)
-- and joins them to every demo client. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- update public.users
--   set role = 'admin', full_name = 'Rajeev Bala'
--   where email = 'rajeev@trifecta.sg';
--
-- insert into public.user_clients (user_id, client_id, role)
--   select u.id, c.id, 'admin'
--   from public.users u
--   cross join public.clients c
--   where u.email = 'rajeev@trifecta.sg'
--     and c.tenant_id = u.tenant_id
--   on conflict (user_id, client_id) do nothing;
