// /api/admin/users — list / update / invite users (in-house only).
import { requireInHouse, json, getSupabaseAdmin, ROLES } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET — every user in the tenant with their client assignments.
export async function GET() {
  const ctx = await requireInHouse();
  if (ctx.error) return ctx.error;
  const { data, error } = await ctx.supabase
    .from('users')
    .select('id, email, full_name, role, can_sign_off, created_at, user_clients(client_id, role)')
    .order('created_at', { ascending: true });
  if (error) return json({ error: error.message }, 400);
  return json({ users: data });
}

// PATCH — change a user's role / can_sign_off / full_name. RLS (users_admin_update)
// already restricts this to in-house operators in the same tenant.
export async function PATCH(req) {
  const ctx = await requireInHouse();
  if (ctx.error) return ctx.error;
  const { supabase, user } = ctx;
  const { id, role, can_sign_off, full_name } = await req.json();
  if (!id) return json({ error: 'id required' }, 400);
  if (role !== undefined && !ROLES.includes(role)) return json({ error: 'invalid role' }, 400);
  // Guardrail: an operator can't demote themselves out of in_house (avoids self-lockout).
  if (id === user.id && role !== undefined && role !== 'in_house') {
    return json({ error: 'You cannot change your own in-house role' }, 400);
  }
  const patch = {};
  if (role !== undefined) patch.role = role;
  if (can_sign_off !== undefined) patch.can_sign_off = !!can_sign_off;
  if (full_name !== undefined) patch.full_name = full_name;
  if (!Object.keys(patch).length) return json({ error: 'nothing to update' }, 400);

  const { data, error } = await supabase.from('users').update(patch).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ user: data });
}

// POST — invite a brand-new user. Creating an auth user needs the secret key.
export async function POST(req) {
  const ctx = await requireInHouse();
  if (ctx.error) return ctx.error;
  const { profile } = ctx;
  const admin = getSupabaseAdmin();
  if (!admin) {
    return json({ error: 'Inviting users needs the Supabase secret key. Set SUPABASE_SECRET_KEY to enable invites.' }, 501);
  }
  const body = await req.json();
  const { email, role = 'client_signal', can_sign_off = false, full_name, client_id, password } = body;
  if (!email) return json({ error: 'email required' }, 400);
  if (!ROLES.includes(role)) return json({ error: 'invalid role' }, 400);

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password: password || undefined,
    user_metadata: { full_name: full_name || null },
  });
  if (cErr) return json({ error: cErr.message }, 400);
  const uid = created.user.id;

  // Ensure the profile is in the operator's tenant with the requested role
  // (handle_new_user may or may not have created it depending on tenant count).
  const { error: pErr } = await admin.from('users').upsert(
    { id: uid, tenant_id: profile.tenant_id, email, role, can_sign_off: !!can_sign_off, full_name: full_name || null },
    { onConflict: 'id' }
  );
  if (pErr) return json({ error: pErr.message }, 400);

  if (client_id) {
    await admin.from('user_clients').upsert(
      { user_id: uid, client_id, role },
      { onConflict: 'user_id,client_id' }
    );
  }
  return json({ user: { id: uid, email, role, can_sign_off: !!can_sign_off } }, 201);
}
