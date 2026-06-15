// /api/model-config — saved model configurations per client (Phase 1 · M4).
// The `config` JSON is what the runner's translation layer consumes
// (services/meridian-runner/translation.py). RLS (can_operate_client) limits this to
// in-house operators and assigned experts.
import { requireUser, json } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const clientId = new URL(req.url).searchParams.get('client_id');
  let q = ctx.supabase
    .from('model_configs')
    .select('id, client_id, name, config, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json({ configs: data });
}

export async function POST(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const b = await req.json();
  if (!b.client_id) return json({ error: 'client_id required' }, 400);
  if (!b.name) return json({ error: 'name required' }, 400);
  const { data, error } = await ctx.supabase
    .from('model_configs')
    .insert({ client_id: b.client_id, name: String(b.name).slice(0, 120), config: b.config || {}, created_by: ctx.user.id, updated_by: ctx.user.id })
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ config: data }, 201);
}

export async function PATCH(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const { id, name, config } = await req.json();
  if (!id) return json({ error: 'id required' }, 400);
  const patch = { updated_by: ctx.user.id, updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = String(name).slice(0, 120);
  if (config !== undefined) patch.config = config;
  const { data, error } = await ctx.supabase.from('model_configs').update(patch).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ config: data });
}
