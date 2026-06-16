-- Trifecta Platform — model review feedback loop (Phase 1 · M5). Apply AFTER model_schema.sql.
--   psql "$SUPABASE_DB_URL" -f packages/db/m5_model_reviews.sql   (idempotent)
--
-- When a reviewer sends a model back, the REASON is captured, shown to the fitter to
-- rework against, and recorded durably. model_reviews is the append-only learning log —
-- every review decision (approve / changes-requested) with its reason + quality rating,
-- queryable across versions and clients for patterns ("the recurring reasons fits fail").

-- latest reviewer feedback, surfaced to the fitter on the draft they need to rework
alter table public.model_versions add column if not exists review_notes text;

create table if not exists public.model_reviews (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.model_versions(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  reviewer    uuid references public.users(id) on delete set null,
  verdict     text not null check (verdict in ('approved', 'changes_requested')),
  reason      text,
  technical_quality_rating int check (technical_quality_rating between 1 and 5),
  created_at  timestamptz not null default now()
);
create index if not exists model_reviews_version_idx on public.model_reviews(version_id, created_at);
create index if not exists model_reviews_client_idx  on public.model_reviews(client_id, created_at);

alter table public.model_reviews enable row level security;

-- visible to in_house + assigned experts (the people who fit/review) — same gate as
-- the model tables; a reviewer can only file a review as themselves.
drop policy if exists model_reviews_select on public.model_reviews;
create policy model_reviews_select on public.model_reviews
  for select using (public.can_operate_client(client_id));

drop policy if exists model_reviews_insert on public.model_reviews;
create policy model_reviews_insert on public.model_reviews
  for insert with check (public.can_operate_client(client_id) and reviewer = auth.uid());

grant select, insert on public.model_reviews to authenticated;
