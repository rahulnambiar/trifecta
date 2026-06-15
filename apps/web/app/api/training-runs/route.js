// /api/training-runs — Vertex training run records (Phase 1 · M4).
// Creating a row records the run; submitting the actual Vertex custom job is the GCP
// step the meridian-runner refactor performs (it reads the config from Supabase by
// model_version_id). Status here mirrors the job: queued → running → completed/failed.
import { requireUser, json } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const url = new URL(req.url);
  const versionId = url.searchParams.get('version_id');
  let q = ctx.supabase
    .from('training_runs')
    .select('id, version_id, status, vertex_job_id, started_at, finished_at, diagnostics, error, created_at')
    .order('created_at', { ascending: false });
  if (versionId) q = q.eq('version_id', versionId);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json({ runs: data });
}

export async function POST(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const { version_id } = await req.json();
  if (!version_id) return json({ error: 'version_id required' }, 400);
  const { data, error } = await ctx.supabase
    .from('training_runs')
    .insert({ version_id, status: 'queued' })
    .select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ run: data, note: 'Run recorded. Vertex submission is the GCP wiring step.' }, 201);
}

export async function PATCH(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const { id, status, vertex_job_id, diagnostics, error: runErr } = await req.json();
  if (!id) return json({ error: 'id required' }, 400);
  const ok = ['queued', 'running', 'completed', 'failed', 'cancelled'];
  const patch = {};
  if (status !== undefined) {
    if (!ok.includes(status)) return json({ error: 'invalid status' }, 400);
    patch.status = status;
    if (status === 'running') patch.started_at = new Date().toISOString();
    if (status === 'completed' || status === 'failed') patch.finished_at = new Date().toISOString();
  }
  if (vertex_job_id !== undefined) patch.vertex_job_id = vertex_job_id;
  if (diagnostics !== undefined) patch.diagnostics = diagnostics;
  if (runErr !== undefined) patch.error = runErr;
  const { data, error } = await ctx.supabase.from('training_runs').update(patch).eq('id', id).select().single();
  if (error) return json({ error: error.message }, 400);
  return json({ run: data });
}
