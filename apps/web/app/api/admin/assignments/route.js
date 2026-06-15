// /api/admin/assignments — scope a user to a client (and at what role), or remove it.
// Writes go through the operator's session; RLS (uc_admin_write) gates to in-house.
import { requireInHouse, json, ROLES } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req) {
  const ctx = await requireInHouse();
  if (ctx.error) return ctx.error;
  const { user_id, client_id, role } = await req.json();
  if (!user_id || !client_id) return json({ error: 'user_id and client_id required' }, 400);
  if (role && !ROLES.includes(role)) return json({ error: 'invalid role' }, 400);
  const { data, error } = await ctx.supabase
    .from('user_clients')
    .upsert({ user_id, client_id, role: role || 'client_signal' }, { onConflict: 'user_id,client_id' })
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ assignment: data }, 201);
}

export async function DELETE(req) {
  const ctx = await requireInHouse();
  if (ctx.error) return ctx.error;
  const { user_id, client_id } = await req.json();
  if (!user_id || !client_id) return json({ error: 'user_id and client_id required' }, 400);
  const { error } = await ctx.supabase
    .from('user_clients')
    .delete()
    .eq('user_id', user_id)
    .eq('client_id', client_id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}
