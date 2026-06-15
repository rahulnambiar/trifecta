// Browser-side Supabase client (Phase 1 · M1).
// Lazily created and memoised so it is never constructed during the static build
// or when env vars are absent — getSupabaseBrowser() returns null if Supabase
// isn't configured yet (the "scaffold now, creds later" state), letting the UI
// fall back gracefully instead of throwing.
import { createBrowserClient } from '@supabase/ssr';

let _client = null;

// Accept both the new Supabase key scheme (sb_publishable_…) and the legacy anon JWT.
const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && PUBLISHABLE_KEY);
}

export function getSupabaseBrowser() {
  if (!isSupabaseConfigured()) return null;
  if (_client) return _client;
  _client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, PUBLISHABLE_KEY);
  return _client;
}
