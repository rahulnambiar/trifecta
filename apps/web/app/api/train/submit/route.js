// POST /api/train/submit — launch a real Vertex AI training job for a model version.
// The job (meridian_runner.run_version) reads the config from Supabase, fits Meridian,
// writes the posterior to GCS, and writes status back. Falls back with 501 if GCP isn't
// configured, so the UI can use the simulate path instead.
import { requireUser, json } from '@/lib/adminAuth';
import { gcpConfigured, submitTrainingJob } from '@/lib/gcp';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  if (!gcpConfigured()) {
    return json({ error: 'GCP training is not configured (set GCP_PROJECT / GCP_REGION / GCS_BUCKET / GCP_SA_KEY_B64).' }, 501);
  }
  const { version_id, smoke } = await req.json();
  if (!version_id) return json({ error: 'version_id required' }, 400);

  // RLS check: the caller must be able to see this version (in-house / assigned expert).
  const { data: v, error } = await ctx.supabase
    .from('model_versions').select('id, status').eq('id', version_id).single();
  if (error || !v) return json({ error: 'version not found' }, 404);
  if (v.status !== 'draft') return json({ error: `version is "${v.status}", can only fit from draft` }, 400);

  let job;
  try {
    job = await submitTrainingJob({ versionId: version_id, smoke: !!smoke });
  } catch (e) {
    return json({ error: 'Could not submit Vertex job: ' + e.message }, 502);
  }

  // Move to fitting and record a queued run the runner will pick up.
  await ctx.supabase.from('model_versions').update({ status: 'fitting' }).eq('id', version_id).eq('status', 'draft');
  await ctx.supabase.from('training_runs').insert({ version_id, status: 'queued', vertex_job_id: job.name });
  return json({ ok: true, job: job.name, smoke: !!smoke }, 201);
}
