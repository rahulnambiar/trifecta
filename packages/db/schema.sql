-- Trifecta Platform — app database schema (Supabase / Postgres)
-- Phase 1 · M1 — Auth & multi-tenancy foundation.
--
-- Platform state ONLY (tenants, clients, users, roles). Marketing data lives in
-- BigQuery; fitted models live in GCS. Never mix the two (see technical-architecture.md §4.2).
--
-- Row-level security is enabled on every table and is the spine of multi-tenancy:
--   * an operator (role 'admin') sees every client in their tenant
--   * a 'client-viewer' sees only the clients they are explicitly joined to
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

-- 1:1 profile for each Supabase auth user. role is the workspace-level role.
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'client-viewer'
                check (role in ('admin', 'client-viewer')),
  created_at  timestamptz not null default now()
);
create index if not exists users_tenant_idx on public.users(tenant_id);

create table if not exists public.clients (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  name           text not null,
  slug           text not null unique,
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

-- role join: which users can see which clients (and at what role for that client)
create table if not exists public.user_clients (
  user_id    uuid not null references public.users(id) on delete cascade,
  client_id  uuid not null references public.clients(id) on delete cascade,
  role       text not null default 'client-viewer'
               check (role in ('admin', 'client-viewer')),
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions (SECURITY DEFINER so RLS policies can read public.users
-- without recursing into its own policy)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.current_tenant_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from public.users where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  )
$$;

-- Auto-create a bare profile when a new auth user signs up. Tenant assignment:
-- if exactly one tenant exists, attach to it (Phase 1 single-workspace reality);
-- otherwise leave tenant unset for an operator to assign. Default role is the
-- least-privileged 'client-viewer' — promote to 'admin' explicitly (see seed.sql).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  only_tenant uuid;
begin
  select id into only_tenant from public.tenants limit 2;  -- detect "exactly one"
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

-- users: read self always; admins read every profile in their tenant
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

-- clients: must be in the same tenant AND (admin, OR explicitly joined)
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

-- clients: only admins write, only within their tenant
drop policy if exists clients_admin_write on public.clients;
create policy clients_admin_write on public.clients
  for all using (public.is_admin() and tenant_id = public.current_tenant_id())
          with check (public.is_admin() and tenant_id = public.current_tenant_id());

-- user_clients: read own joins; admins read/manage all joins in their tenant
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
grant select on public.users        to authenticated;
grant select, update on public.users        to authenticated;
grant select, insert, update, delete on public.clients      to authenticated;
grant select, insert, update, delete on public.user_clients to authenticated;

grant execute on function public.current_tenant_id() to authenticated;
grant execute on function public.is_admin()          to authenticated;
