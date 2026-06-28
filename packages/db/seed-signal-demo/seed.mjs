// Seed demo Signal chat history into Supabase, and create the demo CMO-style users
// that own it. Idempotent: skips users / conversations that already exist.
//
//   cd <repo> && node --env-file=apps/web/.env.local packages/db/seed-signal-demo/seed.mjs
//
// Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (service key — bypasses RLS).
// Apply packages/db/schema.sql and packages/db/m6_signal_history.sql first.
//
// What it does, for each user in DEMO_USERS:
//   1. creates the Supabase auth user if missing (password = SIGNAL_DEMO_PASSWORD),
//   2. sets role=client_signal (Signal surface ONLY) + joins them to the Aeon client
//      via user_clients (mirrors a real CMO login),
//   3. inserts the 10 sessions from sessions.json as their saved chats, with stored
//      tool results so charts re-render, timestamps spread over the last ~5 weeks.
import { createClient } from '../../../apps/web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (e.g. --env-file=apps/web/.env.local)'); process.exit(1); }
const sb = createClient(URL_, KEY, { auth: { persistSession: false } });

const CLIENT_SLUG = process.env.SIGNAL_DEMO_CLIENT || 'aeon';
const PASSWORD = process.env.SIGNAL_DEMO_PASSWORD || 'TrifectaDemo2026!';
const DRY = process.env.DRY === '1';

// The demo CMO-style logins. Add/remove here as needed.
const DEMO_USERS = [
  { email: 'anwesh@trifecta.sg', full_name: 'Anwesh' },
  { email: 'rahul@trifecta.sg',  full_name: 'Rahul' },
  { email: 'ven@trifecta.sg',    full_name: 'Ven' },
];

const sessions = JSON.parse(readFileSync(new URL('./sessions.json', import.meta.url), 'utf8'))
  .filter((s) => s.turns.every((t) => t.answer && t.answer.length));
if (!sessions.length) { console.error('sessions.json has no usable sessions — run generate.mjs'); process.exit(1); }

// resolve the demo client + its tenant by slug (no hard-coded UUIDs)
const { data: client, error: ce } = await sb.from('clients').select('id, tenant_id, name').eq('slug', CLIENT_SLUG).single();
if (ce || !client) { console.error(`client "${CLIENT_SLUG}" not found:`, ce?.message); process.exit(1); }
console.log(`Client: ${client.name} (${client.id}). Sessions: ${sessions.length}. DRY=${DRY}`);

async function ensureUser(u) {
  let { data: prof } = await sb.from('users').select('id, role').eq('email', u.email).maybeSingle();
  if (!prof) {
    if (DRY) { console.log(`DRY: would create ${u.email}`); return `DRY-${u.email}`; }
    const { data: created, error } = await sb.auth.admin.createUser({
      email: u.email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: u.full_name },
    });
    if (error) throw new Error(`createUser ${u.email}: ${error.message}`);
    prof = { id: created.user.id, role: null };
    await sb.from('users').upsert({ id: prof.id, tenant_id: client.tenant_id, email: u.email, full_name: u.full_name, role: 'client_signal' });
    console.log(`created ${u.email} (${prof.id})`);
  }
  if (!DRY) {
    await sb.from('users').update({ role: 'client_signal' }).eq('id', prof.id);
    await sb.from('user_clients').upsert({ user_id: prof.id, client_id: client.id, role: 'client_signal' }, { onConflict: 'user_id,client_id' });
  }
  return prof.id;
}

const MIN = 60 * 1000, DAY = 24 * 60 * MIN;
async function seedFor(userId, label) {
  let made = 0, skipped = 0;
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const { data: existing } = await sb.from('signal_conversations')
      .select('id').eq('user_id', userId).eq('client_id', client.id).eq('title', s.title).maybeSingle();
    if (existing) { skipped++; continue; }
    const startedAt = new Date(Date.now() - (sessions.length - i) * 3.4 * DAY - 5 * MIN);
    let cursor = new Date(startedAt);
    const msgs = [];
    for (const t of s.turns) {
      msgs.push({ role: 'user', content: t.q, artifacts: null, created_at: new Date(cursor).toISOString() });
      cursor = new Date(cursor.getTime() + MIN);
      msgs.push({ role: 'assistant', content: t.answer, artifacts: t.artifacts.length ? t.artifacts : null, created_at: new Date(cursor).toISOString() });
      cursor = new Date(cursor.getTime() + 4 * MIN);
    }
    if (DRY) { console.log(`DRY: ${label} <- "${s.title}" (${msgs.length} msgs)`); made++; continue; }
    const { data: conv, error: cce } = await sb.from('signal_conversations')
      .insert({ client_id: client.id, user_id: userId, title: s.title, created_at: startedAt.toISOString(), updated_at: msgs[msgs.length - 1].created_at })
      .select('id').single();
    if (cce) { console.error('conv insert failed:', s.title, cce.message); continue; }
    const { error: me } = await sb.from('signal_messages').insert(msgs.map((m) => ({ conversation_id: conv.id, ...m })));
    if (me) { console.error('msg insert failed:', s.title, me.message); continue; }
    made++;
  }
  console.log(`  ${label}: ${made} conversations seeded, ${skipped} already existed`);
}

for (const u of DEMO_USERS) {
  const id = await ensureUser(u);
  if (!DRY) await seedFor(id, u.email);
}
console.log(DRY ? 'DRY RUN complete.' : `DONE. Logins: ${DEMO_USERS.map((u) => u.email).join(', ')} — password ${PASSWORD} (Signal-only, scoped to ${client.name}).`);
