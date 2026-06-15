// Shared guard for the in-house admin API (Phase 1 · M2).
// Every /api/admin/* handler calls requireInHouse() first: it resolves the caller's
// Supabase session, loads their profile, and refuses anyone who isn't an `in_house`
// operator. Reads/writes then go through the caller's own session so row-level
// security still applies (defence in depth) — only creating brand-new auth users
// needs the service/secret key (getSupabaseAdmin).
import { NextResponse } from 'next/server';
import { getSupabaseServer, getSupabaseAdmin } from '@/lib/supabase/server';

export const ROLES = ['in_house', 'expert', 'client_upload', 'client_signal'];

export function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export async function requireInHouse() {
  const supabase = getSupabaseServer();
  if (!supabase) return { error: json({ error: 'Supabase not configured' }, 500) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: json({ error: 'Not authenticated' }, 401) };
  const { data: profile, error } = await supabase
    .from('users')
    .select('id, tenant_id, role, can_sign_off')
    .eq('id', user.id)
    .single();
  if (error || !profile) return { error: json({ error: 'No profile for this user' }, 403) };
  if (profile.role !== 'in_house') {
    return { error: json({ error: 'Forbidden — in-house operators only' }, 403) };
  }
  return { supabase, user, profile };
}

// Lighter guard for surfaces beyond in-house (e.g. ingestion, which T3 client-upload
// users drive for their own client). Just resolves the authenticated user + profile;
// per-client authorization is left to row-level security on the table.
export async function requireUser() {
  const supabase = getSupabaseServer();
  if (!supabase) return { error: json({ error: 'Supabase not configured' }, 500) };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: json({ error: 'Not authenticated' }, 401) };
  const { data: profile } = await supabase
    .from('users').select('id, tenant_id, role').eq('id', user.id).single();
  return { supabase, user, profile };
}

export { getSupabaseAdmin };
