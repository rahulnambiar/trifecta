// /api/signal/messages — messages within a saved Signal conversation (Phase 1 · M6).
// Stores tool results too, so charts re-render when a chat is reopened. RLS scopes to
// the owning conversation's user.
import { requireUser, json } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const conversationId = new URL(req.url).searchParams.get('conversation_id');
  if (!conversationId) return json({ error: 'conversation_id required' }, 400);
  const { data, error } = await ctx.supabase
    .from('signal_messages')
    .select('id, role, content, artifacts, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) return json({ error: error.message }, 400);
  return json({ messages: data });
}

export async function POST(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const { conversation_id, role, content, artifacts } = await req.json();
  if (!conversation_id || !role) return json({ error: 'conversation_id and role required' }, 400);
  if (!['user', 'assistant'].includes(role)) return json({ error: 'invalid role' }, 400);
  const { data, error } = await ctx.supabase
    .from('signal_messages')
    .insert({ conversation_id, role, content: content || '', artifacts: artifacts || null })
    .select().single();
  if (error) return json({ error: error.message }, 400);
  // bump the conversation so it sorts to the top of the history list
  await ctx.supabase.from('signal_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversation_id);
  return json({ message: data }, 201);
}
