'use client';
// Training Runs (Phase 1 · M4/M5) — the run monitor. Lists the Vertex training runs
// for a client's model versions and their status (queued → running → completed/failed).
// Until the Vertex submission is wired (next session, GCP), a run can be advanced here
// to simulate the job; completing a run moves its version fitting → in_review so the
// sign-off flow can proceed.
import React from 'react';

const RUN_TAG = { queued: 'amber', running: 'sky', completed: 'mint', failed: 'red', cancelled: 'default' };

async function api(path, method, body) {
  const r = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function TrainingRunsLive({ client }) {
  const clientUuid = client?.dbId;
  const [runs, setRuns] = React.useState([]);
  const [versions, setVersions] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);

  const load = React.useCallback(async () => {
    if (!clientUuid) { setLoading(false); return; }
    setLoading(true);
    try {
      const [r, v] = await Promise.all([
        api(`/api/training-runs?client_id=${clientUuid}`, 'GET'),
        api(`/api/model-versions?client_id=${clientUuid}`, 'GET'),
      ]);
      setRuns(r.runs || []); setVersions(v.versions || []); setErr(null);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [clientUuid]);
  React.useEffect(() => { load(); }, [load]);

  async function act(fn) {
    setBusy(true); setErr(null);
    try { await fn(); await load(); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  // Simulate the next step of a Vertex job (stand-in until GCP wiring lands).
  const advance = (run) => act(async () => {
    if (run.status === 'queued') {
      await api('/api/training-runs', 'PATCH', { id: run.id, status: 'running' });
    } else if (run.status === 'running') {
      await api('/api/training-runs', 'PATCH', { id: run.id, status: 'completed', diagnostics: { max_rhat: 1.06, holdout_mape: 0.16 } });
      // move the version into review if it was fitting
      const v = versions.find((x) => x.id === run.version_id);
      if (v && v.status === 'fitting') {
        await api('/api/model-versions', 'PATCH', { id: v.id, action: 'complete_fit', diagnostics: { max_rhat: 1.06, holdout_mape: 0.16 } });
      }
    }
  });

  if (!clientUuid) return <Card><div className="card-pad dim">This client isn’t backed by the live database yet.</div></Card>;
  const vlabel = (id) => versions.find((v) => v.id === id)?.label || id?.slice(0, 8) || '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {err ? <Banner>{err}</Banner> : null}
      <Card>
        <div className="card-head">
          <div>
            <h3>Training runs · {client.name}</h3>
            <div className="sub">Meridian fits on Vertex AI. Posteriors feed Results &amp; Signal once a version is signed off.</div>
          </div>
        </div>
        {loading ? <div className="card-pad dim">Loading…</div> : runs.length === 0 ? (
          <div className="card-pad dim" style={{ fontSize: 13 }}>
            No runs yet. In <b>Model Studio → Versions</b>, “Train new version” then “Start fit” queues a run here.
          </div>
        ) : (
          <table className="tbl">
            <thead><tr><th>Version</th><th>Status</th><th>Started</th><th>Finished</th><th>R̂</th><th></th></tr></thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="mono" style={{ fontWeight: 600 }}>{run.model_versions?.label || vlabel(run.version_id)}</td>
                  <td><span className={'tag ' + (RUN_TAG[run.status] || 'default')} style={{ fontSize: 9.5 }}>{run.status.toUpperCase()}</span></td>
                  <td className="mono dim" style={{ fontSize: 11.5 }}>{run.started_at ? run.started_at.slice(0, 16).replace('T', ' ') : '—'}</td>
                  <td className="mono dim" style={{ fontSize: 11.5 }}>{run.finished_at ? run.finished_at.slice(0, 16).replace('T', ' ') : '—'}</td>
                  <td className="mono">{run.diagnostics?.max_rhat != null ? Number(run.diagnostics.max_rhat).toFixed(3) : '—'}</td>
                  <td>{run.vertex_job_id ? <span className="faint mono" style={{ fontSize: 9.5 }}>{run.vertex_job_id.split('/').pop()}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function Card({ children }) { return <div className="card">{children}</div>; }
function Banner({ children }) {
  return <div style={{ background: 'rgba(229,72,77,0.12)', border: '1px solid rgba(229,72,77,0.4)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{children}</div>;
}
