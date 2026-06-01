// GET /api/results — the Meridian posterior bundle the Results screen renders.
//
// Phase 0: the model is trained once, so the bundle is imported from the repo
// (bundled with the function — works on Vercel with zero credentials). The seam
// is deliberate: in Phase 1 this route fetches the live object from GCS
// (gs://$GCS_BUCKET/$RESULTS_ARTIFACT_PATH) so a re-train shows up without a
// redeploy — add `@google-cloud/storage` and read it here.
import { NextResponse } from 'next/server';
import bundled from '@/data/results.json';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(bundled);
}
