// NeuGenM white-label demo accounts: two CMO (client_signal) logins, one per client,
// with seeded Signal chats. Idempotent.
import { createClient } from '/Users/lucy-server/trifecta/apps/web/node_modules/@supabase/supabase-js/dist/index.mjs';
import { readFileSync } from 'node:fs';
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const TENANT = '00000000-0000-0000-0000-000000000001';
const PASSWORD = 'NeuGenMDemo2026!';
const MIN = 60000, DAY = 24 * 60 * MIN;

async function clientBySlug(slug) {
  const { data } = await sb.from('clients').select('id, name').eq('slug', slug).single();
  return data;
}
async function ensureCmo(email, full_name, clientId) {
  let { data: prof } = await sb.from('users').select('id').eq('email', email).maybeSingle();
  if (!prof) {
    const { data: created, error } = await sb.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true, user_metadata: { full_name } });
    if (error) throw new Error(`createUser ${email}: ${error.message}`);
    prof = { id: created.user.id };
    await sb.from('users').upsert({ id: prof.id, tenant_id: TENANT, email, full_name, role: 'client_signal' });
    console.log(`created ${email} (${prof.id})`);
  } else { console.log(`exists ${email} (${prof.id})`); }
  await sb.from('users').update({ role: 'client_signal' }).eq('id', prof.id);
  await sb.from('user_clients').upsert({ user_id: prof.id, client_id: clientId, role: 'client_signal' }, { onConflict: 'user_id,client_id' });
  return prof.id;
}

// Seed Aeon chats from the committed curated sessions.json
async function seedFromJson(userId, clientId, jsonPath) {
  const sessions = JSON.parse(readFileSync(jsonPath, 'utf8')).filter(s => s.turns.every(t => t.answer));
  let made = 0, skip = 0;
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const { data: ex } = await sb.from('signal_conversations').select('id').eq('user_id', userId).eq('client_id', clientId).eq('title', s.title).maybeSingle();
    if (ex) { skip++; continue; }
    const started = new Date(Date.now() - (sessions.length - i) * 3.4 * DAY - 5 * MIN);
    let cur = new Date(started); const msgs = [];
    for (const t of s.turns) {
      msgs.push({ role: 'user', content: t.q, artifacts: null, created_at: new Date(cur).toISOString() });
      cur = new Date(cur.getTime() + MIN);
      msgs.push({ role: 'assistant', content: t.answer, artifacts: t.artifacts?.length ? t.artifacts : null, created_at: new Date(cur).toISOString() });
      cur = new Date(cur.getTime() + 4 * MIN);
    }
    const { data: conv } = await sb.from('signal_conversations').insert({ client_id: clientId, user_id: userId, title: s.title, created_at: started.toISOString(), updated_at: msgs.at(-1).created_at }).select('id').single();
    await sb.from('signal_messages').insert(msgs.map(m => ({ conversation_id: conv.id, ...m })));
    made++;
  }
  console.log(`  seeded ${made}, skipped ${skip}`);
}

// Copy an existing user's conversations for a client to the new user
async function copyChats(srcUserId, destUserId, clientId) {
  const { data: convs } = await sb.from('signal_conversations').select('id, title, created_at, updated_at').eq('user_id', srcUserId).eq('client_id', clientId).order('created_at');
  let made = 0, skip = 0;
  for (const c of convs) {
    const { data: ex } = await sb.from('signal_conversations').select('id').eq('user_id', destUserId).eq('client_id', clientId).eq('title', c.title).maybeSingle();
    if (ex) { skip++; continue; }
    const { data: nc } = await sb.from('signal_conversations').insert({ client_id: clientId, user_id: destUserId, title: c.title, created_at: c.created_at, updated_at: c.updated_at }).select('id').single();
    const { data: msgs } = await sb.from('signal_messages').select('role, content, artifacts, created_at').eq('conversation_id', c.id).order('created_at');
    if (msgs?.length) await sb.from('signal_messages').insert(msgs.map(m => ({ conversation_id: nc.id, ...m })));
    made++;
  }
  console.log(`  copied ${made}, skipped ${skip}`);
}

const aeon = await clientBySlug('aeon');
const claritin = await clientBySlug('claritin');
console.log('clients:', aeon.name, aeon.id, '|', claritin.name, claritin.id);

const aeonUser = await ensureCmo('aeon.cmo@neugenm.ai', 'Aeon CMO', aeon.id);
await seedFromJson(aeonUser, aeon.id, '/Users/lucy-server/trifecta/packages/db/seed-signal-demo/sessions.json');

const bayerUser = await ensureCmo('bayer.cmo@neugenm.ai', 'Bayer CMO', claritin.id);
// copy the Claritin demo chats from an existing user (rahul@trifecta.sg)
const { data: rahul } = await sb.from('users').select('id').eq('email', 'rahul@trifecta.sg').single();
await copyChats(rahul.id, bayerUser, claritin.id);

console.log(`DONE. Logins: aeon.cmo@neugenm.ai, bayer.cmo@neugenm.ai — password ${PASSWORD}`);
