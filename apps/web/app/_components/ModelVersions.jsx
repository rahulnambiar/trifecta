'use client';
// Model versions & the sign-off workflow (Phase 1 · M4/M5).
// Drives the lifecycle the database enforces: draft → fitting → in_review →
// signed_off → live (→ archived). The fitter can't sign off their own model; only a
// senior (can_sign_off) reviewer can. Promote-to-Live is gated on sign-off.
import React from 'react';
import { getSupabaseBrowser } from '../../lib/supabase/client';

const FLOW = ['draft', 'fitting', 'in_review', 'signed_off', 'live'];
const STATUS = {
  draft: { tag: 'default', label: 'DRAFT' },
  fitting: { tag: 'sky', label: 'FITTING' },
  in_review: { tag: 'amber', label: 'IN REVIEW' },
  signed_off: { tag: 'mint', label: 'SIGNED OFF' },
  live: { tag: 'mint', label: 'LIVE' },
  archived: { tag: 'default', label: 'ARCHIVED' },
};

async function api(path, method, body) {
  const r = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function ModelVersions({ client, config, configId }) {
  const clientUuid = client?.dbId;
  const [versions, setVersions] = React.useState([]);
  const [me, setMe] = React.useState(null); // { id, can_sign_off }
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [confirmTrain, setConfirmTrain] = React.useState(false);

  React.useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      sb.from('users').select('id, can_sign_off').eq('id', data.user.id).single().then(({ data: p }) => p && setMe(p));
    });
  }, []);

  const load = React.useCallback(async () => {
    if (!clientUuid) { setLoading(false); return; }
    setLoading(true);
    try { const j = await api(`/api/model-versions?client_id=${clientUuid}`, 'GET'); setVersions(j.versions || []); setErr(null); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [clientUuid]);
  React.useEffect(() => { load(); }, [load]);

  async function act(fn) {
    setBusy(true); setErr(null);
    try { await fn(); await load(); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const train = () => act(async () => {
    const n = versions.length + 1;
    const body = { client_id: clientUuid, label: `v${n}` };
    if (configId) body.config_id = configId;                 // use the saved working config
    else { body.config = config || { settings: { holdout_weeks: 8 } }; body.config_name = `v${n} config`; }
    await api('/api/model-versions', 'POST', body);
    setConfirmTrain(false);
  });

  if (!clientUuid) return <Card><div className="card-pad dim">This client isn’t backed by the live database yet.</div></Card>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {err ? <Banner>{err}</Banner> : null}
      <Card>
        <div className="card-head">
          <div>
            <h3>Model versions · {client.name}</h3>
            <div className="sub">Every decision-grade model is signed off by a senior who did not fit it.</div>
          </div>
          <div className="actions"><button className="btn primary small" disabled={busy} onClick={() => setConfirmTrain(true)}>Train new version</button></div>
        </div>
        {loading ? <div className="card-pad dim">Loading…</div> : versions.length === 0 ? (
          <div className="card-pad dim" style={{ fontSize: 13 }}>No versions yet. “Train new version” creates a draft from the current configuration.</div>
        ) : versions.map((v) => (
          <VersionRow key={v.id} v={v} me={me} busy={busy} onAct={act} />
        ))}
      </Card>

      {confirmTrain ? (
        <Modal onClose={() => setConfirmTrain(false)}>
          <h3 style={{ marginTop: 0 }}>Train a new version?</h3>
          <p className="dim" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
            This creates a new draft version and queues a Meridian training run on Vertex AI (GPU).
            A full posterior fit is a paid compute job — typically a few dollars per run. The new version
            stays in <b>draft</b> until you start the fit, and can’t go live until a senior signs it off.
          </p>
          <div className="row-h" style={{ gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn ghost" onClick={() => setConfirmTrain(false)}>Cancel</button>
            <button className="btn primary" disabled={busy} onClick={train}>Confirm &amp; create draft</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function VersionRow({ v, me, busy, onAct }) {
  const st = STATUS[v.status] || { tag: 'default', label: v.status };
  const isFitter = me && v.fitted_by === me.id;
  const canSignThis = me && me.can_sign_off && !isFitter; // fitter ≠ reviewer (DB also enforces)
  const patch = (action, extra) => onAct(() => api('/api/model-versions', 'PATCH', { id: v.id, action, ...(extra || {}) }));
  // Real Vertex fit; fall back to the simulate transition if GCP isn't wired.
  const startFit = () => onAct(async () => {
    try { await api('/api/train/submit', 'POST', { version_id: v.id, smoke: false }); }
    catch (e) {
      if (String(e.message).includes('not configured')) await api('/api/model-versions', 'PATCH', { id: v.id, action: 'start_fit' });
      else throw e;
    }
  });

  return (
    <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line)' }}>
      <div className="between">
        <div className="row-h" style={{ gap: 12 }}>
          <span className="mono" style={{ fontWeight: 700 }}>{v.label || '—'}</span>
          <span className={'tag ' + st.tag} style={{ fontSize: 9.5 }}>{st.label}</span>
          {v.model_configs?.name ? <span className="faint mono" style={{ fontSize: 10.5 }}>{v.model_configs.name}</span> : null}
        </div>
        <div className="row-h" style={{ gap: 6 }}>
          {v.status === 'draft' && <button className="btn ghost small" disabled={busy} onClick={startFit}>Start fit</button>}
          {v.status === 'fitting' && <span className="tag sky" style={{ fontSize: 9.5 }}>training on Vertex…</span>}
          {v.status === 'in_review' && canSignThis && <button className="btn mint small" disabled={busy} onClick={() => patch('sign_off')}>Sign off</button>}
          {v.status === 'in_review' && <button className="btn ghost small" disabled={busy} onClick={() => patch('reject')}>Send back</button>}
          {v.status === 'signed_off' && <button className="btn primary small" disabled={busy} onClick={() => patch('promote')}>Promote to Live</button>}
          {(v.status === 'live' || v.status === 'signed_off') && <button className="btn ghost small" disabled={busy} onClick={() => patch('archive')}>Archive</button>}
        </div>
      </div>

      {/* flow + provenance */}
      <div className="row-h" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        {FLOW.map((s, i) => {
          const reached = FLOW.indexOf(v.status) >= i || v.status === 'archived';
          return <span key={s} className="mono" style={{ fontSize: 9.5, color: reached ? 'var(--mint)' : 'var(--faint)' }}>{i ? '→ ' : ''}{s}</span>;
        })}
      </div>
      <div className="faint mono" style={{ fontSize: 10, marginTop: 8 }}>
        fitted by {isFitter ? 'you' : (v.fitted_by ? v.fitted_by.slice(0, 8) : '—')}
        {v.reviewed_by ? ` · reviewed by ${me && v.reviewed_by === me.id ? 'you' : v.reviewed_by.slice(0, 8)}` : ''}
        {v.signed_off_at ? ` · signed ${new Date(v.signed_off_at).toISOString().slice(0, 10)}` : ''}
      </div>
      {v.status === 'in_review' && isFitter && !me?.can_sign_off
        ? <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>Awaiting a senior reviewer — you can’t sign off your own fit.</div>
        : null}
      {v.status === 'in_review' && isFitter && me?.can_sign_off
        ? <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>You fitted this version, so it must be signed off by another senior.</div>
        : null}
    </div>
  );
}

function Card({ children }) { return <div className="card">{children}</div>; }
function Banner({ children }) {
  return <div style={{ background: 'rgba(229,72,77,0.12)', border: '1px solid rgba(229,72,77,0.4)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{children}</div>;
}
function Modal({ children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: 22 }}>{children}</div>
      </div>
    </div>
  );
}
