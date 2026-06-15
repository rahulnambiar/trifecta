// /api/ingest/sources — data sources + their column mappings (Phase 1 · M3).
// Writes go through the caller's session; RLS (data_sources_rw / can_ingest_client)
// scopes them to in-house, assigned experts, and the client's own upload users.
import { requireUser, json } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/ingest/sources?client_id=...
export async function GET(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const clientId = new URL(req.url).searchParams.get('client_id');
  let q = ctx.supabase
    .from('data_sources')
    .select('id, client_id, kind, label, status, raw_schema, row_count, mapping, created_at, updated_at')
    .order('created_at', { ascending: false });
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json({ sources: data });
}

// POST — register an uploaded source (schema detected client-side).
export async function POST(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const { user } = ctx;
  const b = await req.json();
  if (!b.client_id) return json({ error: 'client_id required' }, 400);
  if (!b.label) return json({ error: 'label required' }, 400);
  const row = {
    client_id: b.client_id,
    kind: b.kind === 'bigquery' ? 'bigquery' : 'upload',
    label: String(b.label).slice(0, 200),
    status: 'mapping',
    raw_schema: Array.isArray(b.raw_schema) ? b.raw_schema : null,
    row_count: Number.isInteger(b.row_count) ? b.row_count : null,
    storage_path: b.storage_path || null,
    created_by: user.id,
  };
  const { data, error } = await ctx.supabase.from('data_sources').insert(row).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ source: data }, 201);
}

// PATCH — save/update the column mapping and status for a source.
export async function PATCH(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const { id, mapping, status, label } = await req.json();
  if (!id) return json({ error: 'id required' }, 400);
  const patch = { updated_at: new Date().toISOString() };
  if (mapping !== undefined) patch.mapping = mapping;
  if (label !== undefined) patch.label = String(label).slice(0, 200);
  if (status !== undefined) {
    const ok = ['uploaded', 'mapping', 'mapped', 'harmonised', 'error'];
    if (!ok.includes(status)) return json({ error: 'invalid status' }, 400);
    patch.status = status;
  }
  const { data, error } = await ctx.supabase.from('data_sources').update(patch).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ source: data });
}

// DELETE /api/ingest/sources?id=...
export async function DELETE(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);
  const { error } = await ctx.supabase.from('data_sources').delete().eq('id', id);
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true });
}
