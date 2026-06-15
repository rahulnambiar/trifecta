// Server-side Supabase clients (Phase 1 · M1) — for API routes / server code.
//
//  - getSupabaseServer():  acts AS the signed-in user (anon key + their cookies),
//    so row-level security applies. Use this for any tenant-scoped read/write.
//  - getSupabaseAdmin():   service-role key, BYPASSES RLS. Use only for trusted
//    server-side provisioning (e.g. M2 client onboarding). Never expose to the client.
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// New Supabase key scheme (sb_publishable_… / sb_secret_…) with legacy fallback.
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && PUBLISHABLE_KEY);
}

export function getSupabaseServer() {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll from a Server Component — safe to ignore; middleware refreshes the session.
          }
        },
      },
    }
  );
}

export function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !SECRET_KEY) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
