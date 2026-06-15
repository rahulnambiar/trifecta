-- Trifecta Platform — Signal chat history (Phase 1 · M6 CMO MVP). Apply AFTER schema.sql.
--   psql "$SUPABASE_DB_URL" -f packages/db/m6_signal_history.sql   (idempotent)
--
-- Persistent per-user conversations so a CMO can scroll back and revisit past chats
-- (tool results are stored so charts re-render on reopen). Each user sees ONLY their
-- own conversations — the isolation is user_id = auth.uid() on every row.

create table if not exists public.signal_conversations (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists signal_conv_user_idx on public.signal_conversations(user_id, client_id, updated_at desc);

create table if not exists public.signal_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.signal_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text,
  artifacts       jsonb,   -- [{name, data}] stored MCP tool results, for chart re-render
  created_at      timestamptz not null default now()
);
create index if not exists signal_msg_conv_idx on public.signal_messages(conversation_id, created_at);

alter table public.signal_conversations enable row level security;
alter table public.signal_messages      enable row level security;

drop policy if exists signal_conv_owner on public.signal_conversations;
create policy signal_conv_owner on public.signal_conversations
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists signal_msg_owner on public.signal_messages;
create policy signal_msg_owner on public.signal_messages
  for all using (
    exists (select 1 from public.signal_conversations c
            where c.id = signal_messages.conversation_id and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.signal_conversations c
            where c.id = signal_messages.conversation_id and c.user_id = auth.uid())
  );

grant select, insert, update, delete on public.signal_conversations to authenticated;
grant select, insert, update, delete on public.signal_messages      to authenticated;
