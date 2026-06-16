// /api/model-versions — the model lifecycle + sign-off gate (Phase 1 · M4/M5).
// Status flow draft → fitting → in_review → signed_off → live (→ archived) is enforced
// in the DATABASE (model_versions trigger): fitter ≠ reviewer, only a senior may sign
// off and must be the reviewer, promote-gated-on-sign-off, one live per client. This
// route performs the requested transition and lets the DB accept or reject it, and
// records each event in model_lineage.
import { requireUser, json } from '@/lib/adminAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function lineage(supabase, client_id, version_id, actor, event, detail) {
  try { await supabase.from('model_lineage').insert({ client_id, version_id, actor, event, detail: detail || null }); }
  catch { /* lineage is best-effort; never block the action */ }
}

export async function GET(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const clientId = new URL(req.url).searchParams.get('client_id');
  let q = ctx.supabase
    .from('model_versions')
    .select('id, client_id, config_id, label, status, fitted_by, reviewed_by, signed_off_at, diagnostics, review_notes, client_satisfaction_rating, technical_quality_rating, created_at, updated_at, model_configs(name), model_reviews(verdict, reason, technical_quality_rating, created_at)')
    .order('created_at', { ascending: false });
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) return json({ error: error.message }, 400);
  return json({ versions: data });
}

// POST — create a new draft version (optionally snapshotting a config inline).
export async function POST(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const { supabase, user } = ctx;
  const b = await req.json();
  if (!b.client_id) return json({ error: 'client_id required' }, 400);

  let configId = b.config_id || null;
  if (!configId && b.config) {
    const { data: cfg, error: cErr } = await supabase
      .from('model_configs')
      .insert({ client_id: b.client_id, name: b.config_name || `${b.label || 'config'} snapshot`, config: b.config, created_by: user.id, updated_by: user.id })
      .select().single();
    if (cErr) return json({ error: cErr.message }, 400);
    configId = cfg.id;
  }

  const { data, error } = await supabase
    .from('model_versions')
    .insert({ client_id: b.client_id, config_id: configId, label: b.label || null, status: 'draft', fitted_by: user.id })
    .select().single();
  if (error) return json({ error: error.message }, 400);
  await lineage(supabase, b.client_id, data.id, user.id, 'created', { label: b.label });
  return json({ version: data }, 201);
}

// PATCH — drive a lifecycle transition. { id, action, ... }
export async function PATCH(req) {
  const ctx = await requireUser();
  if (ctx.error) return ctx.error;
  const { supabase, user } = ctx;
  const b = await req.json();
  const { id, action } = b;
  if (!id || !action) return json({ error: 'id and action required' }, 400);

  // fetch the version (RLS-scoped) so we know its client + current state
  const { data: v, error: vErr } = await supabase.from('model_versions').select('*').eq('id', id).single();
  if (vErr || !v) return json({ error: 'version not found' }, 404);

  let patch = null, event = null, runQueued = false, review = null;
  switch (action) {
    case 'start_fit': patch = { status: 'fitting' }; event = 'fit_started'; runQueued = true; break;
    case 'complete_fit':
      patch = { status: 'in_review' };
      if (b.diagnostics) patch.diagnostics = b.diagnostics;
      if (b.gcs_posterior_path) patch.gcs_posterior_path = b.gcs_posterior_path;
      event = 'fit_completed'; break;
    case 'reject': {
      // Send back with a REASON the fitter must rework against; record it durably.
      const reason = (b.reason || '').trim();
      if (!reason) return json({ error: 'a reason is required to send a model back' }, 400);
      patch = { status: 'draft', review_notes: reason };
      review = { verdict: 'changes_requested', reason, technical_quality_rating: Number.isInteger(b.technical_quality_rating) ? b.technical_quality_rating : null };
      event = 'changes_requested';
      break;
    }
    case 'sign_off':
      patch = { status: 'signed_off', reviewed_by: user.id, review_notes: null };
      review = { verdict: 'approved', reason: (b.reason || '').trim() || null, technical_quality_rating: Number.isInteger(b.technical_quality_rating) ? b.technical_quality_rating : null };
      if (review.technical_quality_rating) patch.technical_quality_rating = review.technical_quality_rating;
      event = 'signed_off'; break;
    case 'archive': patch = { status: 'archived' }; event = 'archived'; break;
    case 'rate':
      patch = {};
      if (Number.isInteger(b.client_satisfaction_rating)) patch.client_satisfaction_rating = b.client_satisfaction_rating;
      if (Number.isInteger(b.technical_quality_rating)) patch.technical_quality_rating = b.technical_quality_rating;
      event = 'rated'; break;
    case 'promote': {
      // one live per client: demote the current live first (live → archived is legal).
      await supabase.from('model_versions').update({ status: 'archived' }).eq('client_id', v.client_id).eq('status', 'live');
      patch = { status: 'live' }; event = 'promoted_to_live'; break;
    }
    default: return json({ error: `unknown action "${action}"` }, 400);
  }

  const { data, error } = await supabase.from('model_versions').update(patch).eq('id', id).select().single();
  if (error) {
    // surface the DB gate's reason (fitter≠reviewer, sign-off authority, illegal transition…)
    return json({ error: error.message.replace(/^.*?:\s*/, '') }, 400);
  }
  await lineage(supabase, v.client_id, id, user.id, event, { action, reason: review?.reason || undefined });

  // Durable review record (the learning log) on approve / changes-requested.
  if (review) {
    await supabase.from('model_reviews').insert({
      version_id: id, client_id: v.client_id, reviewer: user.id,
      verdict: review.verdict, reason: review.reason, technical_quality_rating: review.technical_quality_rating,
    });
  }

  if (runQueued) {
    // Record a training run. Submitting the actual Vertex job is the GCP step (M4 wiring).
    await supabase.from('training_runs').insert({ version_id: id, status: 'queued' });
  }
  return json({ version: data });
}
