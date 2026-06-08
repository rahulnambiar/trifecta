-- Trifecta Platform — app database schema (Supabase / Postgres)
-- Phase 1 · M1 — Auth, four user types & multi-tenancy foundation.
--
-- Platform state ONLY (tenants, clients, users, roles). Marketing data lives in
-- BigQuery; fitted models live in GCS. Never mix the two (see technical-architecture.md §4.2).
--
-- FOUR USER TYPES (brief v4.0 §3b) live on users.role:
--   * in_house      (T1) — Trifecta operator/admin. All clients in tenant, user mgmt,
--                          onboarding, billing. The only type that creates clients/users.
--   * expert        (T2) — fractional DS bench. Scoped to assigned clients; fits models.
--   * client_upload (T3) — client marketing-ops. Own client, ingestion only.
--   * client_signal (T4) — the CMO / decision-maker. Own client's Signal chat ONLY.
--   `can_sign_off` is an orthogonal permission flag — only seniors hold it, and the
--   sign-off workflow (M5) enforces fitter ≠ reviewer. No model goes Live unsigned.
--
-- Row-level security is enabled on every table and is the spine of multi-tenancy:
--   * an in_house operator sees every client in their tenant
--   * every other type sees ONLY the clients they are explicitly joined to
--   * no path exists for cross-tenant reads (see test/rls.test.sql)
--
-- Apply with:  psql "$SUPABASE_DB_URL" -f packages/db/schema.sql
-- (or paste into the Supabase SQL editor). Idempotent — safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- 1:1 profile for each Supabase auth user. role is the workspace-level user type.
create table if not exists public.users (
  id           uuid primary key references auth.users(id) on delete cascade,
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  email        text not null,
  full_name    text,
  role         text not null default 'client_signal'
                 check (role in ('in_house', 'expert', 'client_upload', 'client_signal')),
  -- only seniors may sign off a model; the fitter is never the sole judge (brief §3c).
  can_sign_off boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists users_tenant_idx on public.users(tenant_id);

create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  name           text not null,
  slug           text not null unique,
  -- the named lead data scientist the client knows and can talk to (brief §3a).
  lead_ds        uuid references public.users(id) on delete set null,
  -- demo / status surface (drives Dashboard cards + sidebar)
  version        text default 'v1',
  state          text default 'draft',          -- live / draft / onboarding
  readiness      int  default 0 check (readiness between 0 and 100),
  actions        int  default 0,
  run_label      text,                           -- "Next run 01 Jun" / "Trained 12 May"
  status         text default 'Onboarding',      -- Healthy / Action needed / Stale / Onboarding
  -- per-client GCP isolation (M2 fills these; nullable until provisioned)
  gcp_project    text,
  bq_dataset     text,
  gcs_prefix     text,
  data_residency text default 'asia-southeast1',
  created_at     timestamptz not null default now()
);
create index if not exists clients_tenant_idx on public.clients(tenant_id);
create index if not exists clients_lead_ds_idx on public.clients(lead_ds);

-- membership join: which users are scoped to which clients, and as what type for
-- that client (mirrors users.role for single-type users; future-proofs mixed cases).
create table if not exists public.user_clients (
  user_id    uuid not null references public.users(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  role       text not null default 'client_signal'
               check (role in ('in_house', 'expert', 'client_upload', 'client_signal')),
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
create index if not exists user_clients_client_idx on public.user_clients(client_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions (SECURITY DEFINER so RLS policies can read public.users
-- without recursing into its own policy)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.current_tenant_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.users where id = auth.uid()
$$;

-- in_house operator (T1) — the only type with tenant-wide reach + write power.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'in_house'
  )
$$;

-- holds the sign-off permission (a senior reviewer). Used by the M5 workflow.
create or replace function public.can_sign_off()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users where id = auth.uid() and can_sign_off = true
  )
$$;

-- Auto-create a bare profile when a new auth user signs up. Tenant assignment:
-- if exactly one tenant exists, attach to it (Phase 1 single-workspace reality);
-- otherwise leave tenant unset for an operator to assign. Default role is the
-- least-privileged 'client_signal' (sees nothing until joined to a client) —
-- promote explicitly (see seed.sql bootstrap, or the M2 onboarding screen).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  only_tenant uuid;
begin
  select id into only_tenant from public.tenants limit 1;
  if (select count(*) from public.tenants) = 1 then
    insert into public.users (id, tenant_id, email, full_name)
    values (new.id, only_tenant, new.email, new.raw_user_meta_data->>'full_name')
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.tenants      enable row level security;
alter table public.users        enable row level security;
alter table public.clients      enable row level security;
alter table public.user_clients enable row level security;

-- tenants: members can read their own tenant only
drop policy if exists tenants_member_select on public.tenants;
create policy tenants_member_select on public.tenants
  for select using (id = public.current_tenant_id());

-- users: read self always; in_house operators read every profile in their tenant
drop policy if exists users_self_select on public.users;
create policy users_self_select on public.users
  for select using (
    id = auth.uid()
    or (public.is_admin() and tenant_id = public.current_tenant_id())
  );

-- users: a user may update their own profile (not their role/tenant — guarded in app)
drop policy if exists users_self_update on public.users;
create policy users_self_update on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- clients: must be in the same tenant AND (in_house, OR explicitly joined).
-- This single policy is what stops a Type 2/3/4 user reaching an unassigned client.
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select using (
    tenant_id = public.current_tenant_id()
    and (
      public.is_admin()
      or exists (
        select 1 from public.user_clients uc
        where uc.client_id = clients.id and uc.user_id = auth.uid()
      )
    )
  );

-- clients: only in_house operators write, only within their tenant
drop policy if exists clients_admin_write on public.clients;
create policy clients_admin_write on public.clients
  for all using (public.is_admin() and tenant_id = public.current_tenant_id())
          with check (public.is_admin() and tenant_id = public.current_tenant_id());

-- user_clients: read own joins; in_house operators read/manage all joins
drop policy if exists uc_self_select on public.user_clients;
create policy uc_self_select on public.user_clients
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists uc_admin_write on public.user_clients;
create policy uc_admin_write on public.user_clients
  for all using (public.is_admin()) with check (public.is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants — RLS gates the rows, but the role still needs table privileges.
-- (anon can do nothing; authenticated is constrained by the policies above.)
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;

grant select on public.tenants      to authenticated;
grant select, update on public.users        to authenticated;
grant select, insert, update, delete on public.clients      to authenticated;
grant select, insert, update, delete on public.user_clients to authenticated;

grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_admin()          to authenticated;
grant execute on function public.can_sign_off()      to authenticated;
