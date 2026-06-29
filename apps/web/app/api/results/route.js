// GET /api/results?slug=<client> — the Meridian posterior the Results/Signal screens read.
//
// Phase 1: serves the client's LIVE posterior from GCS (gs://$GCS_BUCKET/<slug>/live/
// results.json) — which Promote-to-Live points at the chosen version. Falls back to the
// bundled Phase 0 file when GCP isn't configured or the client has no live posterior yet,
// so the demo always renders.
import { NextResponse } from 'next/server';
import bundled from '@/data/results.json';
import claritin from '@/data/claritin-results.json';
import { gcpConfigured, gcsReadJson } from '@/lib/gcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Per-client bundled posteriors — the Phase-0 fallback when a live GCS posterior
// isn't available. Each is a genuine Meridian output on representative data.
const BUNDLES = { aeon: bundled, claritin };

export async function GET(req) {
  const slug = (new URL(req.url).searchParams.get('slug') || 'aeon').replace(/[^a-z0-9-]/gi, '');
  if (gcpConfigured()) {
    try {
      const live = await gcsReadJson(`${slug}/live/results.json`);
      if (live) return NextResponse.json(live);
    } catch {
      // no live posterior for this client yet → fall back to the bundle
    }
  }
  return NextResponse.json(BUNDLES[slug] || bundled);
}
