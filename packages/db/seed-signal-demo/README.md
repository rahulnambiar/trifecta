# Signal demo chat history seed

Seeds a set of demo **CMO-style Signal logins** with realistic saved chat history, so
the platform can be demoed with lived-in conversations (genuine Aeon Skincare Meridian
outputs, with charts that re-render on reopen).

## Files

- `sessions.json` — the demo content: 10 sessions / 13 turns, each assistant answer with
  its stored MCP tool results (so charts re-render). **Committed**, so seeding needs no
  Anthropic usage.
- `generate.mjs` — re-generates `sessions.json` by calling the real model + Trifecta MCP
  server. Only needed to refresh the content.
- `seed.mjs` — creates the demo users and inserts the history. Idempotent.

## Prerequisites

- `apps/web` deps installed (`cd apps/web && npm install`) — the scripts import the
  Supabase / Anthropic SDKs from there.
- DB schema applied: `packages/db/schema.sql` then `packages/db/m6_signal_history.sql`.
- Env in `apps/web/.env.local`:
  - seed: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY` (service key, bypasses RLS)
  - generate (optional): `ANTHROPIC_API_KEY`, `MCP_SERVER_URL`

## Run (from the repo root)

```bash
# Dry run — prints what it would do, writes nothing
DRY=1 node --env-file=apps/web/.env.local packages/db/seed-signal-demo/seed.mjs

# Seed for real
node --env-file=apps/web/.env.local packages/db/seed-signal-demo/seed.mjs

# (optional) refresh the demo content first
node --env-file=apps/web/.env.local packages/db/seed-signal-demo/generate.mjs
```

## What `seed.mjs` does

For each user in `DEMO_USERS` (edit the list at the top of the file):

1. Creates the Supabase auth user if missing (password `SIGNAL_DEMO_PASSWORD`, default
   `TrifectaDemo2026!`).
2. Sets `role = client_signal` (the Signal-only CMO surface, no console) and joins them
   to the demo client via `user_clients` — mirroring a real CMO login.
3. Inserts the 10 sessions as their saved chats, timestamps spread over the last ~5 weeks.

History is per-user (`signal_conversations.user_id = auth.uid()` RLS), so each user gets
its own copy and can independently reopen and continue any chat.

## Notes / overrides

- `SIGNAL_DEMO_CLIENT` (default `aeon`) — which client slug the history attaches to. The
  deployed Signal backend is single-tenant (answers as Aeon), so keep this `aeon` unless
  the backend becomes multi-tenant.
- `SIGNAL_DEMO_PASSWORD` — override the demo password.
- Re-running is safe: existing users and existing `(user, title)` conversations are skipped.
