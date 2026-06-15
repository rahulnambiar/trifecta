-- Trifecta Platform — M3 data ingestion. Apply AFTER schema.sql.
--   psql "$SUPABASE_DB_URL" -f packages/db/m3_ingestion.sql   (idempotent)
--
-- A data_source is one ingested input for a client (an uploaded file, or a
-- BigQuery table). It records the detected raw schema and the column→canonical
-- mapping (the shape packages/harmonisation/harmonise.py consumes). Mappings persist
-- here and are reusable across refreshes (brief §6 M3).
--
-- Access differs from the model tables: client-UPLOAD users (T3) drive ingestion for
-- their OWN client, so can_ingest_client() includes them — but NOT client-signal (T4),
-- who only ever see Signal.

create or replace function public.can_ingest_client(cid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.clients c
    where c.id = cid
      and c.tenant_id = public.current_tenant_id()
      and (
        public.is_admin()  -- in_house operator
        or exists (
          select 1 from public.user_clients uc
          where uc.client_id = c.id and uc.user_id = auth.uid()
            and uc.role in ('expert', 'client_upload')
        )
      )
  )
$$;

create table if not exists public.data_sources (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  kind        text not null default 'upload' check (kind in ('upload', 'bigquery')),
  label       text not null,
  status      text not null default 'mapping'
                check (status in ('uploaded', 'mapping', 'mapped', 'harmonised', 'error')),
  raw_schema  jsonb,    -- [{ name, sample, distinct? }] detected columns
  row_count   int,
  mapping     jsonb,    -- canonical mapping spec (harmonise.py shape)
  storage_path text,    -- GCS / Supabase Storage ref (set when the file path lands)
  created_by  uuid references public.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists data_sources_client_idx on public.data_sources(client_id);

alter table public.data_sources enable row level security;

drop policy if exists data_sources_rw on public.data_sources;
create policy data_sources_rw on public.data_sources
  for all using (public.can_ingest_client(client_id))
          with check (public.can_ingest_client(client_id));

grant select, insert, update, delete on public.data_sources to authenticated;
grant execute on function public.can_ingest_client(uuid) to authenticated;
