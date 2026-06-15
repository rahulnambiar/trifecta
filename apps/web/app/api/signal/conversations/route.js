// /api/signal/conversations — the CMO's saved Signal chats (Phase 1 · M6).
// RLS scopes every row to the signed-in user (user_id = auth.uid()).
import { requireUser, json } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const clientId = new URL(req.url).searchParams.get('client_id');
  let q = ctx.supabase
    .from('signal_conversations')
    .select('id, client_id, title, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json({ conversations: data });
}

export async function POST(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const { client_id, title } = await req.json();
  if (!client_id) return json({ error: 'client_id required' }, 400);
  const { data, error } = await ctx.supabase
    .from('signal_conversations')
    .insert({ client_id, user_id: ctx.user.id, title: (title || 'New chat').slice(0, 120) })
    .select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ conversation: data }, 201);
}

export async function PATCH(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const { id, title } = await req.json();
  if (!id) return json({ error: 'id required' }, 400);
  const { data, error } = await ctx.supabase
    .from('signal_conversations').update({ title: String(title || '').slice(0, 120), updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ conversation: data });
}

export async function DELETE(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);
  const { error } = await ctx.supabase.from('signal_conversations').delete().eq('id', id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}
