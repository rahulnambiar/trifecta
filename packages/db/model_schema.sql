-- Trifecta Platform — model configuration, versioning & sign-off schema
-- Phase 1 · M4/M5. Apply AFTER schema.sql (depends on its tenants/clients/users/
-- user_clients tables, current_tenant_id()/is_admin()/can_sign_off() helpers, and RLS).
--
--   psql "$SUPABASE_DB_URL" -f packages/db/schema.sql        # M1 first
--   psql "$SUPABASE_DB_URL" -f packages/db/model_schema.sql  # then this
-- Idempotent — safe to re-run.
--
-- The sign-off gate (brief v4.0 §3c) is enforced in the DATABASE, not just the app:
--   model_versions.status : draft → fitting → in_review → signed_off → live  (→ archived)
--   * Promote-to-Live is impossible before signed_off (illegal transition).
--   * The reviewer can NEVER be the fitter (table CHECK + trigger).
--   * Only a senior (can_sign_off) may sign off, and the sign-off must be performed
--     by that reviewer themselves (anti-spoof).
--   * At most one live version per client.
-- A lineage table records every event (who/what/when). See test/signoff.test.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- Access helper: who may see/operate a client's model internals.
-- Model Studio / configs / versions / runs are in_house + ASSIGNED EXPERTS only
-- (brief §3b access matrix) — NOT client-upload (T3) or client-signal (T4) users,
-- even though those are joined to the client. So this is stricter than clients_select.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_operate_client(cid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clients c
    where c.id = cid
      and c.tenant_id = public.current_tenant_id()
      and (
        public.is_admin()  -- in_house operator: every client in the tenant
        or exists (
          select 1 from public.user_clients uc
          where uc.client_id = c.id and uc.user_id = auth.uid() and uc.role = 'expert'
        )
      )
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

-- A named, editable configuration for a client's model (the Model Studio inputs:
-- channels, priors, controls, calibrations, settings). `config` is the canonical
-- JSON the runner's translation layer consumes (services/meridian-runner/translation.py).
create table if not exists public.model_configs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  name        text not null,
  config      jsonb not null default '{}'::jsonb,
  created_by  uuid references public.users(id) on delete set null,
  updated_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists model_configs_client_idx on public.model_configs(client_id);

-- An immutable-ish fitted instance: one trained model with a status, who fit it, who
-- reviewed it, its posterior location and diagnostics. The status drives the gate.
create table if not exists public.model_versions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients(id) on delete cascade,
  config_id     uuid references public.model_configs(id) on delete set null,
  label         text,                                   -- "v3"
  status        text not null default 'draft'
                  check (status in ('draft','fitting','in_review','signed_off','live','archived')),
  fitted_by     uuid references public.users(id) on delete set null,
  reviewed_by   uuid references public.users(id) on delete set null,
  signed_off_at timestamptz,
  gcs_posterior_path text,                              -- where the posterior bundle lives
  diagnostics   jsonb,                                  -- max_rhat, mape, r2 … (from the run)
  -- two ratings, recorded only (brief §3c) — not yet driving anything
  client_satisfaction_rating int check (client_satisfaction_rating between 1 and 5),
  technical_quality_rating   int check (technical_quality_rating between 1 and 5),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- the fitter is never the sole judge: a reviewer can never be the fitter.
  constraint mv_reviewer_not_fitter check (reviewed_by is null or reviewed_by <> fitted_by)
);
create index if not exists model_versions_client_idx on public.model_versions(client_id);
create index if not exists model_versions_status_idx on public.model_versions(client_id, status);
-- At most one LIVE version per client.
create unique index if not exists model_versions_one_live
  on public.model_versions(client_id) where status = 'live';

-- Each Vertex training job execution for a version.
create table if not exists public.training_runs (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null references public.model_versions(id) on delete cascade,
  status       text not null default 'queued'
                 check (status in ('queued','running','completed','failed','cancelled')),
  vertex_job_id text,
  started_at   timestamptz,
  finished_at  timestamptz,
  diagnostics  jsonb,
  error        text,
  created_at   timestamptz not null default now()
);
create index if not exists training_runs_version_idx on public.training_runs(version_id);

-- Append-only event log: every decision-relevant event for a client/version.
create table if not exists public.model_lineage (
  id          bigint generated always as identity primary key,
  client_id   uuid not null references public.clients(id) on delete cascade,
  version_id  uuid references public.model_versions(id) on delete set null,
  actor       uuid references public.users(id) on delete set null,
  event       text not null,   -- data_loaded|config_changed|fit_started|fit_completed|
                                -- submitted_for_review|signed_off|promoted_to_live|archived|rated
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists model_lineage_client_idx on public.model_lineage(client_id, created_at);
create index if not exists model_lineage_version_idx on public.model_lineage(version_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- The sign-off gate, enforced in-database.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_model_version_rules()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reviewer_senior boolean;
begin
  new.updated_at := now();

  -- A reviewer can never be the fitter (defence in depth; also a table CHECK).
  if new.reviewed_by is not null and new.reviewed_by = new.fitted_by then
    raise exception 'sign-off invalid: the reviewer cannot be the fitter';
  end if;

  -- Invariants that must hold for the target status itself.
  if new.status = 'signed_off' then
    if new.reviewed_by is null then
      raise exception 'cannot sign off without a reviewer';
    end if;
    select can_sign_off into reviewer_senior from public.users where id = new.reviewed_by;
    if not coalesce(reviewer_senior, false) then
      raise exception 'reviewer is not authorised to sign off (no can_sign_off)';
    end if;
    if new.signed_off_at is null then
      new.signed_off_at := now();
    end if;
  elsif new.status = 'live' then
    if new.signed_off_at is null or new.reviewed_by is null then
      raise exception 'cannot promote to live before sign-off';
    end if;
  end if;

  -- New versions always begin as a draft.
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'a new model version must start as draft (got %)', new.status;
  end if;

  -- Status transitions must follow the allowed DAG; this is what makes
  -- Promote-to-Live impossible without passing through signed_off.
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if not (
      (old.status = 'draft'      and new.status in ('fitting','archived')) or
      (old.status = 'fitting'    and new.status in ('in_review','draft','archived')) or
      (old.status = 'in_review'  and new.status in ('signed_off','draft','archived')) or
      (old.status = 'signed_off' and new.status in ('live','in_review','archived')) or
      (old.status = 'live'       and new.status in ('archived'))
    ) then
      raise exception 'illegal status transition: % -> %', old.status, new.status;
    end if;

    -- The act of signing off must be performed by the reviewer themselves.
    if new.status = 'signed_off' and (auth.uid() is null or new.reviewed_by <> auth.uid()) then
      raise exception 'sign-off must be performed by the named reviewer';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists model_versions_rules on public.model_versions;
create trigger model_versions_rules
  before insert or update on public.model_versions
  for each row execute function public.enforce_model_version_rules();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-level security — every model table scoped by can_operate_client().
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.model_configs  enable row level security;
alter table public.model_versions enable row level security;
alter table public.training_runs  enable row level security;
alter table public.model_lineage  enable row level security;

drop policy if exists model_configs_rw on public.model_configs;
create policy model_configs_rw on public.model_configs
  for all using (public.can_operate_client(client_id))
          with check (public.can_operate_client(client_id));

drop policy if exists model_versions_rw on public.model_versions;
create policy model_versions_rw on public.model_versions
  for all using (public.can_operate_client(client_id))
          with check (public.can_operate_client(client_id));

-- training_runs hang off a version; scope via the parent version's client.
drop policy if exists training_runs_rw on public.training_runs;
create policy training_runs_rw on public.training_runs
  for all using (
    exists (select 1 from public.model_versions v
            where v.id = training_runs.version_id and public.can_operate_client(v.client_id))
  ) with check (
    exists (select 1 from public.model_versions v
            where v.id = training_runs.version_id and public.can_operate_client(v.client_id))
  );

-- model_lineage is append-only: read + insert for operators, never update/delete.
drop policy if exists model_lineage_select on public.model_lineage;
create policy model_lineage_select on public.model_lineage
  for select using (public.can_operate_client(client_id));

drop policy if exists model_lineage_insert on public.model_lineage;
create policy model_lineage_insert on public.model_lineage
  for insert with check (public.can_operate_client(client_id));

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants (RLS gates rows; the role still needs table privileges).
-- ─────────────────────────────────────────────────────────────────────────────
grant select, insert, update, delete on public.model_configs  to authenticated;
grant select, insert, update, delete on public.model_versions to authenticated;
grant select, insert, update, delete on public.training_runs  to authenticated;
grant select, insert on public.model_lineage to authenticated;  -- append-only
grant usage on sequence public.model_lineage_id_seq to authenticated;

grant execute on function public.can_operate_client(uuid) to authenticated;
