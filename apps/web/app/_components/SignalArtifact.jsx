'use client';
// Inline chat artifact: renders a live chart for an MCP tool result and offers
// CSV / JSON export. Driven by the structured data the Trifecta MCP tools return.
// Every export goes through the export-integrity chokepoint (brief v4.0 §2): a chart
// or file may not leave without its credible interval, as-of date and model version.
import React from 'react';
import {
  ExportIntegrityError,
  assertProvenance,
  provenanceCaption,
  toProvenancedCSV,
  toProvenancedJSON,
} from '../../lib/exportIntegrity';
import { chartSvgToPng, sharePng } from '../../lib/shareCard';

// Pure diagnostics (model health) carry no per-figure credible interval, so they are
// exempt from the interval requirement — they still carry as-of + version.
const NON_ESTIMATE = new Set(['get_model_health']);

const COLORS = { Meta: '#4f6ef2', YouTube: '#7d9bff', TV: '#e6b052', 'Paid Search': '#37d39b', TikTok: '#c773d6' };
const FALLBACK = ['#4f6ef2', '#7d9bff', '#e6b052', '#37d39b', '#c773d6', '#c98568', '#b07e3d'];
const colorFor = (name, i) => COLORS[name] || FALLBACK[i % FALLBACK.length];

const money = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
  return '$' + n.toFixed(0);
};
const xN = (n, d = 2) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(d));
const niceMax = (v) => {
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const mag = Math.pow(10, Math.floor(Math.log10(v || 1)));
  for (const s of steps) if (s * mag >= v) return s * mag;
  return 10 * mag;
};

// ---- export helpers ----
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj || {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? JSON.stringify(v) : v;
  }
  return out;
}
function toCSV(rows) {
  if (!rows || !rows.length) return '';
  const flat = rows.map((r) => flatten(r));
  const cols = [...new Set(flat.flatMap((r) => Object.keys(r)))];
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return [cols.join(','), ...flat.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
function download(name, text, type) {
  const blob = new Blob([text], { type: type || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const TITLES = {
  get_channel_contribution: 'Channel contribution',
  get_marginal_roi: 'Marginal ROI',
  get_response_curve: 'Response curve',
  optimize_budget: 'Budget optimiser',
  run_budget_scenario: 'Budget scenario',
  get_model_health: 'Model health',
};

// Presentational toolbar — all handlers + state live in SignalArtifact.
function Toolbar({ hasRows, canShare, sharing, copied, err, onCSV, onJSON, onShare }) {
  return (
    <div className="row-h" style={{ gap: 6, marginLeft: 'auto' }}>
      {err ? <span className="tag amber" style={{ fontSize: 9.5 }} title={err}>⚠ interval required</span> : null}
      {canShare ? (
        <button className="btn ghost small" onClick={onShare} disabled={sharing} title="Share this chart as an image — interval, date and model version baked in">
          {sharing ? '…' : 'Share'}
        </button>
      ) : null}
      {hasRows ? <button className="btn ghost small" onClick={onCSV}>CSV</button> : null}
      <button className="btn ghost small" onClick={onJSON}>{copied ? 'Copied' : 'JSON'}</button>
    </div>
  );
}

// ---- shared bar chart ----
function HBars({ items, max, unit }) {
  const W = 560, rowH = 26, padL = 96, padR = 56, padT = 6, padB = 6;
  const H = items.length * rowH + padT + padB;
  const iw = W - padL - padR;
  const xT = (v) => padL + (Math.max(0, v) / max) * iw;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} fontFamily="var(--f-mono)" fontSize="10" fill="var(--faint)">
      {items.map((d, i) => {
        const y = padT + i * rowH + 5;
        return (
          <g key={d.label}>
            <text x={padL - 8} y={y + 12} textAnchor="end" fill="var(--text)" fontFamily="var(--f-body)" fontSize="11.5">{d.label}</text>
            <rect x={padL} y={y} width={Math.max(0, (d.value / max) * iw)} height="13" fill={d.color} opacity="0.82" rx="2" />
            {d.lo != null && d.hi != null ? (
              <g stroke="var(--text)" strokeWidth="1" opacity="0.65">
                <line x1={xT(d.lo)} x2={xT(d.hi)} y1={y + 6.5} y2={y + 6.5} />
                <line x1={xT(d.lo)} x2={xT(d.lo)} y1={y + 3} y2={y + 10} />
                <line x1={xT(d.hi)} x2={xT(d.hi)} y1={y + 3} y2={y + 10} />
              </g>
            ) : null}
            <text x={Math.min(xT(d.hi != null ? d.hi : d.value) + 5, W - 4)} y={y + 11} fill="var(--text)" fontSize="9.5">{d.valueLabel ?? (unit === 'x' ? xN(d.value, 1) + 'x' : money(d.value))}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ---- per-tool renderers ----
function Contribution({ data }) {
  const rows = [...(data.channels || [])].sort((a, b) => (b.incremental_outcome?.median || 0) - (a.incremental_outcome?.median || 0));
  const max = niceMax(Math.max(...rows.map((r) => r.incremental_outcome?.ci_hi || r.incremental_outcome?.median || 0)));
  const items = rows.map((r, i) => ({
    label: r.channel, color: colorFor(r.channel, i),
    value: r.incremental_outcome?.median, lo: r.incremental_outcome?.ci_lo, hi: r.incremental_outcome?.ci_hi,
    valueLabel: `${money(r.incremental_outcome?.median)} · ${xN(r.contribution_pct, 0)}%`,
  }));
  return <><HBars items={items} max={max} /><Caption>Incremental revenue · 90% credible interval · ROI in the model</Caption></>;
}

function ROIBars({ data, unit = 'x' }) {
  const rows = data.channels || [];
  const max = niceMax(Math.max(1, ...rows.map((r) => r.ci_hi || r.median || r.roi?.median || 0)));
  const items = rows.map((r, i) => ({
    label: r.channel, color: colorFor(r.channel, i),
    value: r.median ?? r.roi?.median, lo: r.ci_lo ?? r.roi?.ci_lo, hi: r.ci_hi ?? r.roi?.ci_hi,
  }));
  return <><HBars items={items} max={max} unit={unit} /><Caption>Return per $1 · 90% credible interval</Caption></>;
}

function ResponseCurve({ data }) {
  const pts = (data.points || []).filter((p) => p.incremental_outcome != null).sort((a, b) => a.spend - b.spend);
  if (!pts.length) return <div className="dim">No curve points.</div>;
  const W = 560, H = 200, pad = { t: 12, r: 16, b: 26, l: 56 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const xmax = Math.max(...pts.map((p) => p.spend)) || 1;
  const ymax = niceMax(Math.max(...pts.map((p) => p.ci_hi ?? p.incremental_outcome)));
  const color = colorFor(data.channel, 4);
  const px = (s) => (s / xmax) * iw, py = (v) => (1 - v / ymax) * ih;
  const line = (key) => pts.map((p, i) => `${i ? 'L' : 'M'} ${px(p.spend)} ${py(p[key] ?? p.incremental_outcome)}`).join(' ');
  const band = line('ci_hi') + ' ' + pts.slice().reverse().map((p) => `L ${px(p.spend)} ${py(p.ci_lo ?? p.incremental_outcome)}`).join(' ') + ' Z';
  const op = pts.find((p) => Math.abs(p.spend_multiplier - 1) < 1e-6);
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--faint)">
        {[0, 0.5, 1].map((t) => (
          <g key={t}><line x1={pad.l} x2={W - pad.r} y1={pad.t + (1 - t) * ih} y2={pad.t + (1 - t) * ih} stroke="var(--line)" strokeDasharray="2 3" />
            <text x={pad.l - 6} y={pad.t + (1 - t) * ih + 3} textAnchor="end">{money(t * ymax)}</text></g>
        ))}
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + ih} stroke="var(--line2)" />
        <g transform={`translate(${pad.l} ${pad.t})`}>
          <path d={band} fill={color} opacity="0.14" />
          <path d={line('incremental_outcome')} fill="none" stroke={color} strokeWidth="2" />
          {op ? <g><line x1={px(op.spend)} x2={px(op.spend)} y1={0} y2={ih} stroke="var(--sky)" strokeDasharray="3 3" opacity="0.7" /><circle cx={px(op.spend)} cy={py(op.incremental_outcome)} r="4" fill="var(--sky)" /></g> : null}
        </g>
        <text x={pad.l} y={H - 6}>spend →</text>
        <text x={W - pad.r} y={H - 6} textAnchor="end" fill="var(--sky)">current spend {money(op?.spend)}</text>
      </svg>
      <Caption>{data.channel} saturation · incremental revenue vs spend (90% band)</Caption>
    </>
  );
}

function Optimiser({ data }) {
  const alloc = data.allocation || [];
  const lift = data.expected_lift;
  const max = niceMax(Math.max(1, ...alloc.map((r) => Math.max(r.optimal_spend || r.spend || 0, r.current_spend || 0))));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lift ? (
        <div className="row-h" style={{ gap: 10 }}>
          <Stat label="Current" value={money(lift.current)} />
          <Stat label="Optimised" value={money(lift.optimized)} tone="mint" />
          <Stat label="Lift" value={`+${xN(lift.delta_pct, 1)}%`} sub={`+${money(lift.delta)}`} tone="mint" />
        </div>
      ) : data.projected_incremental_outcome ? (
        <Stat label="Projected incremental" value={money(data.projected_incremental_outcome.median)} tone="mint" />
      ) : null}
      <table className="tbl">
        <thead><tr><th>Channel</th><th>Current</th><th>Optimal</th><th>Δ</th><th>ROI</th></tr></thead>
        <tbody>
          {alloc.map((r, i) => {
            const cur = r.current_spend, opt = r.optimal_spend ?? r.spend, d = (opt ?? 0) - (cur ?? 0);
            return (
              <tr key={r.channel || i}>
                <td><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: colorFor(r.channel, i), marginRight: 8 }} />{r.channel}</td>
                <td className="mono">{cur != null ? money(cur) : '—'}</td>
                <td className="mono">{money(opt)}</td>
                <td className="mono" style={{ color: d >= 0 ? 'var(--mint)' : 'var(--red)' }}>{cur != null ? (d >= 0 ? '+' : '') + money(d) : '—'}</td>
                <td className="mono">{xN(r.optimal_roi ?? r.roi, 1)}x</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <Caption>{data.mode === 'response_curve_approximation' ? 'Approximate (response-curve) allocation' : "Meridian's optimal allocation vs current"} · {Math.round((data.confidence_level || 0.9) * 100)}% CI</Caption>
    </div>
  );
}

function Scenario({ data }) {
  const base = data.baseline_incremental_outcome || {}, scen = data.scenario_incremental_outcome || {};
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row-h" style={{ gap: 10 }}>
        <Stat label="Baseline" value={money(base.median)} />
        <Stat label="Scenario" value={money(scen.median)} tone={data.delta >= 0 ? 'mint' : 'amber'} />
        <Stat label="Change" value={`${data.delta >= 0 ? '+' : ''}${xN(data.delta_pct, 1)}%`} sub={`${data.delta >= 0 ? '+' : ''}${money(data.delta)}`} tone={data.delta >= 0 ? 'mint' : 'amber'} />
      </div>
      {(data.changes || []).length ? (
        <table className="tbl">
          <thead><tr><th>Channel</th><th>Current spend</th><th>New spend</th><th>Incremental</th></tr></thead>
          <tbody>
            {data.changes.map((c, i) => (
              <tr key={c.channel || i}>
                <td>{c.channel}</td>
                <td className="mono">{money(c.current_spend)}</td>
                <td className="mono">{money(c.new_spend)}</td>
                <td className="mono">{money(c.incremental_outcome?.median)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <Caption>Projected from posterior response curves · 90% CI</Caption>
    </div>
  );
}

function Health({ data }) {
  const tw = data.training_window || {};
  const tone = data.max_rhat == null ? undefined : data.max_rhat <= 1.1 ? 'mint' : data.max_rhat <= 1.2 ? 'amber' : 'red';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="grid g4" style={{ gap: 10 }}>
        <Stat label="Max R-hat" value={xN(data.max_rhat, 3)} sub={data.converged ? 'converged' : 'check'} tone={tone} />
        <Stat label="Holdout MAPE" value={data.holdout_mape == null ? '—' : (data.holdout_mape * 100).toFixed(1) + '%'} />
        <Stat label="Holdout R² (geo)" value={xN(data.holdout_r2_geo)} />
        <Stat label="Training" value={tw.n_weeks ? tw.n_weeks + ' wks' : '—'} sub={tw.start ? `${tw.start}→${tw.end}` : ''} />
      </div>
      {data.verdict ? <Caption>{data.verdict}</Caption> : null}
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  const color = tone === 'mint' ? 'var(--mint)' : tone === 'amber' ? 'var(--amber)' : tone === 'red' ? 'var(--red)' : 'var(--text)';
  return (
    <div className="tile" style={{ flex: 1, padding: '10px 12px' }}>
      <div className="lbl">{label}</div>
      <div className="v" style={{ color, fontSize: 18 }}>{value}</div>
      {sub ? <div className="dim" style={{ fontSize: 11 }}>{sub}</div> : null}
    </div>
  );
}
function Caption({ children }) {
  return <div className="faint mono" style={{ fontSize: 10, marginTop: 6, letterSpacing: '0.04em' }}>{children}</div>;
}

export default function SignalArtifact({ name, data, provenance }) {
  const bodyRef = React.useRef(null);
  const [copied, setCopied] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [canShare, setCanShare] = React.useState(false);
  const [err, setErr] = React.useState(null);

  // A chart is shareable-as-image only if it rendered an <svg> (bar/curve tools);
  // table tools (optimiser/scenario/health) still export via CSV/JSON.
  React.useEffect(() => {
    setCanShare(!!bodyRef.current && !!bodyRef.current.querySelector('svg'));
  }, [name, data]);

  if (!data) return null;
  const rows = {
    get_channel_contribution: data.channels,
    get_marginal_roi: data.channels,
    get_response_curve: data.points,
    optimize_budget: data.allocation,
    run_budget_scenario: data.changes,
    get_model_health: [data],
  }[name];

  let body = null;
  if (name === 'get_channel_contribution') body = <Contribution data={data} />;
  else if (name === 'get_marginal_roi') body = <ROIBars data={data} unit="x" />;
  else if (name === 'get_response_curve') body = <ResponseCurve data={data} />;
  else if (name === 'optimize_budget') body = <Optimiser data={data} />;
  else if (name === 'run_budget_scenario') body = <Scenario data={data} />;
  else if (name === 'get_model_health') body = <Health data={data} />;
  else return null;

  const requireInterval = !NON_ESTIMATE.has(name);
  const stamp = provenance ? provenanceCaption(provenance) : null;

  const flash = (e) => {
    // Export integrity blocked the action — surface why instead of shipping a bare number.
    setErr(e instanceof ExportIntegrityError ? e.message : 'Export failed.');
    setTimeout(() => setErr(null), 4000);
  };
  const onCSV = () => {
    try { download(`${name}.csv`, toProvenancedCSV(toCSV(rows), provenance, { rows, requireInterval }), 'text/csv'); }
    catch (e) { flash(e); }
  };
  const onJSON = () => {
    try {
      navigator.clipboard?.writeText(toProvenancedJSON(data, provenance));
      setCopied(true); setTimeout(() => setCopied(false), 1200);
    } catch (e) { flash(e); }
  };
  const onShare = async () => {
    setSharing(true);
    try {
      assertProvenance(provenance);  // an image must carry interval + date + version too
      const svg = bodyRef.current && bodyRef.current.querySelector('svg');
      if (!svg) throw new Error('no chart to share');
      const blob = await chartSvgToPng(svg, { title: TITLES[name] || name, stamp });
      await sharePng(blob, `trifecta-${name}.png`, `${TITLES[name] || name} — Trifecta Signal`);
    } catch (e) { flash(e); }
    finally { setSharing(false); }
  };

  return (
    <div className="card" style={{ marginTop: 8 }}>
      <div className="card-head" style={{ padding: '10px 14px' }}>
        <h3 style={{ fontSize: 13 }}>{TITLES[name] || name}</h3>
        <Toolbar
          hasRows={!!(rows && rows.length)} canShare={canShare} sharing={sharing}
          copied={copied} err={err} onCSV={onCSV} onJSON={onJSON} onShare={onShare}
        />
      </div>
      <div className="card-pad signal-artifact-scroll" style={{ padding: 14 }} ref={bodyRef}>{body}</div>
      {stamp ? (
        <div className="faint mono" style={{ fontSize: 9.5, padding: '0 14px 10px', letterSpacing: '0.04em' }}>
          {stamp}
        </div>
      ) : null}
    </div>
  );
}
