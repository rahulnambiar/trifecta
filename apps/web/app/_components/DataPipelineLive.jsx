'use client';
// Data ingestion — Path C (file upload + column mapping), Phase 1 · M3.
// Upload a CSV (parsed in the browser), map its columns to the canonical schema
// (time/geo/kpi/population/channels/controls), and persist a reusable mapping in
// Supabase. The saved mapping is exactly the shape packages/harmonisation/harmonise.py
// consumes to build the canonical weekly table for Meridian.
import React from 'react';

const REQUIRED = ['date', 'geo', 'kpi', 'channel', 'spend'];
const FIELDS = [
  { k: 'date', label: 'Week / date', help: 'the time column', req: true },
  { k: 'geo', label: 'Geography', help: 'region / DMA', req: true },
  { k: 'kpi', label: 'Outcome (KPI)', help: 'conversions or revenue', req: true },
  { k: 'population', label: 'Population', help: 'per-geo scale (optional)' },
  { k: 'revenue_per_kpi', label: 'Revenue / KPI', help: 'optional' },
  { k: 'channel', label: 'Channel column', help: 'the column holding channel names', req: true },
  { k: 'spend', label: 'Spend', help: 'media spend', req: true },
  { k: 'impressions', label: 'Impressions', help: 'optional' },
];

// ---- tiny CSV parser (handles quoted fields) ----
function parseCSV(text, maxRows = 100000) {
  const rows = [];
  let i = 0, field = '', row = [], inQ = false;
  const pushF = () => { row.push(field); field = ''; };
  const pushR = () => { rows.push(row); row = []; };
  while (i < text.length && rows.length <= maxRows) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { inQ = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQ = true; i++; continue; }
    if (ch === ',') { pushF(); i++; continue; }
    if (ch === '\n') { pushF(); pushR(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length) { pushF(); pushR(); }
  return rows.filter((r) => r.length && !(r.length === 1 && r[0] === ''));
}

function detectSchema(text) {
  const rows = parseCSV(text);
  if (!rows.length) return { columns: [], rowCount: 0 };
  const headers = rows[0].map((h) => h.trim());
  const body = rows.slice(1);
  const columns = headers.map((name, c) => {
    const vals = body.map((r) => (r[c] ?? '').trim()).filter((v) => v !== '');
    const distinct = [...new Set(vals)];
    return { name, sample: vals[0] ?? '', distinct: distinct.length <= 50 ? distinct : undefined };
  });
  return { columns, rowCount: body.length };
}

async function api(path, method, body) {
  const r = await fetch(path, {
    method, headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

const emptyForm = () => ({
  date: '', geo: '', kpi: '', population: '', revenue_per_kpi: '',
  channel: '', spend: '', impressions: '', channels: [], controls: [],
});

function formFromMapping(m) {
  if (!m) return emptyForm();
  return {
    date: m.media?.date || m.kpi?.date || '',
    geo: m.media?.geo || m.kpi?.geo || '',
    kpi: m.kpi?.kpi || '',
    population: m.kpi?.population || '',
    revenue_per_kpi: m.kpi?.revenue_per_kpi || '',
    channel: m.media?.channel || '',
    spend: m.media?.spend || '',
    impressions: m.media?.impressions || '',
    channels: m.channels || [],
    controls: Object.entries(m.controls?.columns || {}).map(([canon, raw]) => ({ canon, raw })),
  };
}

function mappingFromForm(src, f) {
  const table = src.label;
  const m = {
    source_id: src.id, source_label: src.label,
    media: { table, date: f.date, geo: f.geo, channel: f.channel, spend: f.spend },
    kpi: { table, date: f.date, geo: f.geo, kpi: f.kpi },
    channels: f.channels,
  };
  if (f.impressions) m.media.impressions = f.impressions;
  if (f.population) m.kpi.population = f.population;
  if (f.revenue_per_kpi) m.kpi.revenue_per_kpi = f.revenue_per_kpi;
  const ctrls = f.controls.filter((c) => c.canon && c.raw);
  if (ctrls.length) m.controls = { table, date: f.date, geo: f.geo, columns: Object.fromEntries(ctrls.map((c) => [c.canon, c.raw])) };
  return m;
}

export default function DataPipelineLive({ client }) {
  const clientUuid = client?.dbId;
  const [sources, setSources] = React.useState([]);
  const [selId, setSelId] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState(null);
  const [note, setNote] = React.useState(null);
  const fileRef = React.useRef(null);

  const load = React.useCallback(async () => {
    if (!clientUuid) { setLoading(false); return; }
    setLoading(true);
    try {
      const j = await api(`/api/ingest/sources?client_id=${clientUuid}`, 'GET');
      setSources(j.sources || []);
      setErr(null);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }, [clientUuid]);
  React.useEffect(() => { load(); }, [load]);

  const selected = sources.find((s) => s.id === selId) || null;

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null); setNote(null);
    try {
      const text = await file.text();
      const { columns, rowCount } = detectSchema(text);
      if (!columns.length) throw new Error('No columns detected — is this a CSV with a header row?');
      const j = await api('/api/ingest/sources', 'POST', {
        client_id: clientUuid, label: file.name, kind: 'upload',
        raw_schema: columns, row_count: rowCount,
      });
      await load();
      setSelId(j.source.id);
      setNote(`Uploaded "${file.name}" — ${rowCount} rows, ${columns.length} columns. Now map them below.`);
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function saveMapping(src, form) {
    setBusy(true); setErr(null); setNote(null);
    try {
      const complete = REQUIRED.every((k) => form[k]) && form.channels.length > 0;
      const mapping = mappingFromForm(src, form);
      await api('/api/ingest/sources', 'PATCH', { id: src.id, mapping, status: complete ? 'mapped' : 'mapping' });
      await load();
      setNote(complete ? 'Mapping saved — this source is ready for harmonisation.' : 'Mapping saved as draft (some required fields are unmapped).');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function remove(src) {
    if (!confirm(`Remove source "${src.label}"?`)) return;
    setBusy(true);
    try { await api(`/api/ingest/sources?id=${src.id}`, 'DELETE'); if (selId === src.id) setSelId(null); await load(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }

  if (!clientUuid) return <Card><div className="card-pad dim">This client isn’t backed by the live database yet.</div></Card>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 920 }}>
      {err ? <Banner kind="red">{err}</Banner> : null}
      {note ? <Banner kind="mint">{note}</Banner> : null}

      <Card>
        <div className="card-head">
          <h3>Data sources · {client.name}</h3>
          <div className="actions">
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFile} />
            <button className="btn primary small" disabled={busy} onClick={() => fileRef.current?.click()}>Upload CSV</button>
          </div>
        </div>
        {loading ? <div className="card-pad dim">Loading…</div> : sources.length === 0 ? (
          <div className="card-pad dim" style={{ fontSize: 13 }}>
            No sources yet. Upload a CSV (spend, KPI and controls in a weekly or daily long format) to begin mapping.
          </div>
        ) : sources.map((s) => (
          <div key={s.id} className="between selectable" style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', cursor: 'pointer', background: s.id === selId ? 'rgba(79,110,242,0.06)' : 'transparent' }}
            onClick={() => setSelId(s.id)}>
            <div>
              <div style={{ fontWeight: 600 }}>{s.label}</div>
              <div className="dim mono" style={{ fontSize: 11 }}>{s.kind} · {s.row_count ?? '—'} rows · {(s.raw_schema || []).length} cols</div>
            </div>
            <div className="row-h" style={{ gap: 8 }}>
              <StatusTag s={s.status} />
              <button className="btn ghost small" onClick={(e) => { e.stopPropagation(); remove(s); }}>Remove</button>
            </div>
          </div>
        ))}
      </Card>

      {selected ? <Mapper key={selected.id} src={selected} busy={busy} onSave={saveMapping} /> : null}
    </div>
  );
}

function Mapper({ src, busy, onSave }) {
  const cols = (src.raw_schema || []).map((c) => c.name);
  const [f, setF] = React.useState(() => formFromMapping(src.mapping));
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const channelDistinct = (src.raw_schema || []).find((c) => c.name === f.channel)?.distinct || [];
  const missing = REQUIRED.filter((k) => !f[k]).concat(f.channels.length ? [] : ['channels']);

  const toggleChannel = (v) => setF((s) => ({ ...s, channels: s.channels.includes(v) ? s.channels.filter((x) => x !== v) : [...s.channels, v] }));
  const addControl = () => setF((s) => ({ ...s, controls: [...s.controls, { canon: '', raw: '' }] }));
  const setControl = (i, key) => (e) => setF((s) => ({ ...s, controls: s.controls.map((c, j) => j === i ? { ...c, [key]: e.target.value } : c) }));
  const rmControl = (i) => setF((s) => ({ ...s, controls: s.controls.filter((_, j) => j !== i) }));

  return (
    <Card>
      <div className="card-head">
        <h3>Map columns → canonical schema</h3>
        <div className="actions">
          {missing.length
            ? <span className="tag amber" style={{ fontSize: 10 }}>{missing.length} required unmapped</span>
            : <span className="tag mint" style={{ fontSize: 10 }}>✓ ready for harmonisation</span>}
        </div>
      </div>
      <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {FIELDS.map((fld) => (
          <label key={fld.k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="faint mono" style={{ fontSize: 10, letterSpacing: '0.1em' }}>
              {fld.label.toUpperCase()}{fld.req ? ' *' : ''}
            </span>
            <select className="input" value={f[fld.k]} onChange={set(fld.k)} disabled={busy}
              style={{ borderColor: fld.req && !f[fld.k] ? 'var(--amber)' : undefined }}>
              <option value="">— {fld.help} —</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        ))}
      </div>

      {/* Channels to include */}
      <div className="card-pad" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="faint mono" style={{ fontSize: 10, letterSpacing: '0.1em', marginBottom: 8 }}>CHANNELS TO INCLUDE *</div>
        {f.channel ? (
          channelDistinct.length ? (
            <div className="row-h" style={{ gap: 6, flexWrap: 'wrap' }}>
              {channelDistinct.map((v) => (
                <button key={v} className={'tag ' + (f.channels.includes(v) ? 'sky' : 'default')} style={{ cursor: 'pointer', border: 'none' }}
                  disabled={busy} onClick={() => toggleChannel(v)}>{f.channels.includes(v) ? '✓ ' : ''}{v}</button>
              ))}
            </div>
          ) : <div className="dim" style={{ fontSize: 12 }}>“{f.channel}” has too many distinct values to list — pick a categorical channel column.</div>
        ) : <div className="dim" style={{ fontSize: 12 }}>Choose a channel column above to pick which channels to model.</div>}
      </div>

      {/* Controls */}
      <div className="card-pad" style={{ borderTop: '1px solid var(--line)' }}>
        <div className="between" style={{ marginBottom: 8 }}>
          <span className="faint mono" style={{ fontSize: 10, letterSpacing: '0.1em' }}>CONTROL VARIABLES (OPTIONAL)</span>
          <button className="btn ghost small" onClick={addControl} disabled={busy}>+ Add control</button>
        </div>
        {f.controls.map((c, i) => (
          <div key={i} className="row-h" style={{ gap: 8, marginBottom: 6 }}>
            <input className="input" placeholder="canonical name (e.g. sentiment)" value={c.canon} onChange={setControl(i, 'canon')} disabled={busy} style={{ flex: 1 }} />
            <select className="input" value={c.raw} onChange={setControl(i, 'raw')} disabled={busy} style={{ flex: 1 }}>
              <option value="">— column —</option>
              {cols.map((col) => <option key={col} value={col}>{col}</option>)}
            </select>
            <button className="btn ghost small" onClick={() => rmControl(i)} disabled={busy}>×</button>
          </div>
        ))}
      </div>

      <div className="card-pad" style={{ borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn primary" disabled={busy} onClick={() => onSave(src, f)}>Save mapping</button>
      </div>
    </Card>
  );
}

function StatusTag({ s }) {
  const map = { uploaded: 'sky', mapping: 'amber', mapped: 'mint', harmonised: 'mint', error: 'red' };
  const label = { uploaded: 'UPLOADED', mapping: 'NEEDS MAPPING', mapped: 'MAPPED', harmonised: 'HARMONISED', error: 'ERROR' };
  return <span className={'tag ' + (map[s] || 'default')} style={{ fontSize: 9.5 }}>{label[s] || s}</span>;
}
function Card({ children }) { return <div className="card">{children}</div>; }
function Banner({ kind, children }) {
  const bg = kind === 'red' ? 'rgba(229,72,77,0.12)' : 'rgba(55,211,155,0.12)';
  const bd = kind === 'red' ? 'rgba(229,72,77,0.4)' : 'rgba(55,211,155,0.4)';
  return <div style={{ background: bg, border: '1px solid ' + bd, borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>{children}</div>;
}
