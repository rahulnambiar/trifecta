// /api/admin/clients — list / create clients, set the lead data scientist (in-house only).
import { requireInHouse, json } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const slugify = (s) =>
  String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

export async function GET() {
  const ctx = await requireInHouse();
  if (ctx.error) return ctx.error;
  const { data, error } = await ctx.supabase
    .from('clients')
    .select('id, name, slug, lead_ds, state, status, version, readiness, created_at')
    .order('created_at', { ascending: true });
  if (error) return json({ error: error.message }, 400);
  return json({ clients: data });
}

// POST — stand up a new client. Per-client GCP provisioning is manual for clients 1–2
// (brief §6); this records the client row (RLS clients_admin_write gates to in-house).
export async function POST(req) {
  const ctx = await requireInHouse();
  if (ctx.error) return ctx.error;
  const { supabase, profile } = ctx;
  const { name } = await req.json();
  if (!name || !name.trim()) return json({ error: 'name required' }, 400);
  const slug = slugify(name);
  if (!slug) return json({ error: 'could not derive a slug from name' }, 400);

  const { data, error } = await supabase
    .from('clients')
    .insert({ tenant_id: profile.tenant_id, name: name.trim(), slug, state: 'onboarding', status: 'Onboarding' })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') return json({ error: `a client with slug "${slug}" already exists` }, 409);
    return json({ error: error.message }, 400);
  }
  return json({ client: data }, 201);
}

// PATCH — set the lead data scientist (or other client fields).
export async function PATCH(req) {
  const ctx = await requireInHouse();
  if (ctx.error) return ctx.error;
  const { id, lead_ds } = await req.json();
  if (!id) return json({ error: 'id required' }, 400);
  const { data, error } = await ctx.supabase
    .from('clients')
    .update({ lead_ds: lead_ds || null })
    .eq('id', id)
    .select()
    .single();
  if (error) return json({ error: error.message }, 400);
  return json({ client: data });
}
