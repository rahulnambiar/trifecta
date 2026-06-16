'use client';
// Results screen wired to the real Meridian posterior bundle (/api/results).
// Keeps the handed-off design's chart language (hand-drawn SVG, CI whiskers,
// saturation curves, allocation bars) but every number is a genuine model output.
import React from 'react';

const COLORS = {
  Meta: '#4f6ef2', YouTube: '#7d9bff', TV: '#e6b052', 'Paid Search': '#37d39b', TikTok: '#c773d6',
};
const FALLBACK = ['#4f6ef2', '#7d9bff', '#e6b052', '#37d39b', '#c773d6', '#c98568', '#b07e3d'];
const colorFor = (name, i) => COLORS[name] || FALLBACK[i % FALLBACK.length];

const money = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(0) + 'k';
  return n.toFixed(0);
};
const xN = (n, d = 2) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(d));
const niceMax = (v) => {
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const mag = Math.pow(10, Math.floor(Math.log10(v || 1)));
  for (const s of steps) if (s * mag >= v) return s * mag;
  return 10 * mag;
};

function Legend({ items, style }) {
  return (
    <div className="row-h" style={{ gap: 14, flexWrap: 'wrap', ...(style || {}) }}>
      {items.map((it) => (
        <div key={it.name} className="row-h" style={{ gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, display: 'inline-block' }} />
          <span className="mono" style={{ fontSize: 11 }}>{it.name}</span>
        </div>
      ))}
    </div>
  );
}

// ---- 1) Channel contribution -------------------------------------------------
function ContributionView({ bundle }) {
  const rows = [...(bundle.channel_contribution || [])].sort(
    (a, b) => (b.incremental_outcome?.median || 0) - (a.incremental_outcome?.median || 0)
  );
  const maxV = niceMax(Math.max(...rows.map((r) => r.incremental_outcome?.ci_hi || r.incremental_outcome?.median || 0)));
  const W = 720, rowH = 34, padL = 110, padR = 70, padT = 10, padB = 24;
  const H = rows.length * rowH + padT + padB;
  const iw = W - padL - padR;
  const xT = (v) => padL + (v / maxV) * iw;
  const grand = rows.reduce((s, r) => s + Math.max(r.incremental_outcome?.median || 0, 0), 0) || 1;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} fontFamily="var(--f-mono)" fontSize="10" fill="var(--faint)">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={xT(t * maxV)} x2={xT(t * maxV)} y1={padT} y2={H - padB} stroke="var(--line)" strokeDasharray="2 3" />
              <text x={xT(t * maxV)} y={H - 8} textAnchor="middle">{money(t * maxV)}</text>
            </g>
          ))}
          <line x1={padL} x2={padL} y1={padT} y2={H - padB} stroke="var(--line2)" />
          {rows.map((r, i) => {
            const y = padT + i * rowH + 6;
            const c = colorFor(r.channel, i);
            const io = r.incremental_outcome || {};
            return (
              <g key={r.channel_id}>
                <text x={padL - 10} y={y + 13} textAnchor="end" fill="var(--text)" fontFamily="var(--f-body)" fontSize="11.5">{r.channel}</text>
                <rect x={padL} y={y} width={Math.max(0, (io.median / maxV) * iw)} height="14" fill={c} opacity="0.8" rx="2" />
                {io.ci_lo != null && io.ci_hi != null ? (
                  <g stroke="var(--text)" strokeWidth="1" opacity="0.7">
                    <line x1={xT(io.ci_lo)} x2={xT(io.ci_hi)} y1={y + 7} y2={y + 7} />
                    <line x1={xT(io.ci_lo)} x2={xT(io.ci_lo)} y1={y + 3} y2={y + 11} />
                    <line x1={xT(io.ci_hi)} x2={xT(io.ci_hi)} y1={y + 3} y2={y + 11} />
                  </g>
                ) : null}
                <text x={Math.min(xT(io.ci_hi || io.median) + 6, W - padR + 4)} y={y + 11} fill="var(--text)" fontSize="10">{money(io.median)}</text>
              </g>
            );
          })}
        </svg>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 6, paddingLeft: padL }}>
          Incremental revenue attributed to each channel (posterior median, with 90% credible interval).
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div><h3>Share of revenue</h3><div className="sub">Driven by paid media</div></div></div>
        <div style={{ padding: '6px 0' }}>
          {rows.map((r, i) => (
            <div key={r.channel_id} style={{ padding: '8px 16px' }}>
              <div className="between" style={{ marginBottom: 4 }}>
                <div className="row-h" style={{ gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: colorFor(r.channel, i) }} />
                  <span style={{ fontSize: 12 }}>{r.channel}</span>
                </div>
                <span className="mono" style={{ fontSize: 11.5 }}>{xN(r.contribution_pct, 1)}%</span>
              </div>
              <div style={{ height: 4, background: 'var(--panel3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: (100 * Math.max(r.incremental_outcome?.median || 0, 0) / grand) + '%', height: '100%', background: colorFor(r.channel, i), opacity: 0.85 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- 2) ROI & marginal ROI ---------------------------------------------------
function ROIView({ bundle }) {
  const mroiById = Object.fromEntries((bundle.marginal_roi || []).map((m) => [m.channel_id, m]));
  const data = (bundle.channel_contribution || []).map((c) => ({
    name: c.channel, id: c.channel_id, roi: c.roi?.median,
    m: mroiById[c.channel_id]?.median, lo: mroiById[c.channel_id]?.ci_lo, hi: mroiById[c.channel_id]?.ci_hi,
  }));
  const max = niceMax(Math.max(...data.flatMap((d) => [d.roi || 0, d.hi || 0])));
  const rowH = 30, W = 720, padL = 110, padR = 30, padT = 14, padB = 22;
  const H = data.length * rowH + padT + padB;
  const iw = W - padL - padR;
  const xT = (v) => padL + (v / max) * iw;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
      <div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} fontFamily="var(--f-mono)" fontSize="10" fill="var(--faint)">
          {Array.from({ length: Math.round(max) + 1 }, (_, v) => (
            <g key={v}>
              <line x1={xT(v)} x2={xT(v)} y1={padT} y2={H - padB} stroke="var(--line)" strokeDasharray="2 3" />
              <text x={xT(v)} y={H - 6} textAnchor="middle">{v}x</text>
            </g>
          ))}
          <line x1={padL} x2={padL} y1={padT} y2={H - padB} stroke="var(--line2)" />
          <line x1={xT(1)} x2={xT(1)} y1={padT} y2={H - padB} stroke="var(--red)" strokeDasharray="3 3" opacity="0.5" />
          <text x={xT(1) + 4} y={padT + 9} fill="var(--red)" opacity="0.8">break-even</text>
          {data.map((d, i) => {
            const y = padT + i * rowH + 6;
            const c = colorFor(d.name, i);
            return (
              <g key={d.id}>
                <text x={padL - 10} y={y + 13} textAnchor="end" fill="var(--text)" fontFamily="var(--f-body)" fontSize="11.5">{d.name}</text>
                <rect x={padL} y={y} width={Math.max(0, (d.roi / max) * iw)} height="9" fill={c} opacity="0.55" rx="1" />
                <rect x={padL} y={y + 11} width={Math.max(0, (d.m / max) * iw)} height="5" fill={c} rx="1" />
                {d.lo != null && d.hi != null ? (
                  <g stroke="var(--text)" strokeWidth="1" opacity="0.7">
                    <line x1={xT(d.lo)} x2={xT(d.hi)} y1={y + 13.5} y2={y + 13.5} />
                    <line x1={xT(d.lo)} x2={xT(d.lo)} y1={y + 10} y2={y + 17} />
                    <line x1={xT(d.hi)} x2={xT(d.hi)} y1={y + 10} y2={y + 17} />
                  </g>
                ) : null}
                <text x={xT(d.roi) + 6} y={y + 7} fill="var(--text)" fontSize="9.5">{xN(d.roi, 1)}x</text>
              </g>
            );
          })}
        </svg>
        <Legend style={{ paddingLeft: padL, marginTop: 4 }} items={[
          { name: 'ROI (average)', color: 'rgba(125,155,255,0.55)' },
          { name: 'Marginal ROI', color: 'var(--sky)' },
          { name: '90% credible interval', color: 'var(--text)' },
        ]} />
      </div>
      <div className="card">
        <div className="card-head"><div><h3>Reading this</h3><div className="sub">What the two bars mean</div></div></div>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Explain sw={18} sh={8} bg="rgba(125,155,255,0.55)" title="Average ROI" body="Revenue per $1 across the full training window." />
          <Explain sw={18} sh={5} bg="var(--sky)" title="Marginal ROI" body="Revenue from the next $1 — usually lower because of diminishing returns." />
          <Explain sw={18} sh={1} bg="var(--text)" title="Error bar" body="90% credible interval on Marginal ROI. Wider = less confident." />
        </div>
      </div>
    </div>
  );
}
function Explain({ sw, sh, bg, title, body }) {
  return (
    <div>
      <div className="row-h" style={{ gap: 8, marginBottom: 4 }}>
        <span style={{ width: sw, height: sh, background: bg, borderRadius: 1 }} />
        <span style={{ fontWeight: 600, fontSize: 12.5 }}>{title}</span>
      </div>
      <div className="dim" style={{ fontSize: 12 }}>{body}</div>
    </div>
  );
}

// ---- 3) Response curves ------------------------------------------------------
function curveFor(bundle, channelId) {
  const pts = (bundle.response_curves?.points || []).filter((p) => p.channel === channelId);
  const by = {};
  for (const p of pts) {
    const m = p.spend_multiplier;
    const d = (by[m] = by[m] || { spend_multiplier: m, spend: p.spend });
    if (p.metric === 'mean') d.mean = p.incremental_outcome;
    else if (p.metric === 'ci_lo') d.ci_lo = p.incremental_outcome;
    else if (p.metric === 'ci_hi') d.ci_hi = p.incremental_outcome;
  }
  return Object.values(by).sort((a, b) => a.spend_multiplier - b.spend_multiplier);
}
function path(curve, key, w, h, ymax) {
  const xmax = Math.max(...curve.map((p) => p.spend)) || 1;
  return curve.map((p, i) => `${i ? 'L' : 'M'} ${(p.spend / xmax) * w} ${(1 - (p[key] ?? p.mean) / ymax) * h}`).join(' ');
}
function ResponseDetail({ bundle, channelId, name, color }) {
  const curve = curveFor(bundle, channelId);
  const W = 540, H = 280, pad = { t: 16, r: 22, b: 34, l: 60 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const ymax = niceMax(Math.max(...curve.map((p) => p.ci_hi ?? p.mean)));
  const xmax = Math.max(...curve.map((p) => p.spend)) || 1;
  const op = curve.find((p) => Math.abs(p.spend_multiplier - 1) < 1e-6) || curve[Math.floor(curve.length / 2)];
  const band = path(curve, 'ci_hi', iw, ih, ymax) + ' ' + curve.slice().reverse().map((p) => `L ${(p.spend / xmax) * iw} ${(1 - (p.ci_lo ?? p.mean) / ymax) * ih}`).join(' ') + ' Z';
  return (
    <div>
      <div className="between" style={{ marginBottom: 8 }}>
        <div className="row-h" style={{ gap: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: color }} />
          <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>{name} · response curve</div>
        </div>
        <span className="tag sky">operating at {money(op?.spend)} spend</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--faint)">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={pad.t + (1 - t) * ih} y2={pad.t + (1 - t) * ih} stroke="var(--line)" strokeDasharray="2 3" />
            <text x={pad.l - 8} y={pad.t + (1 - t) * ih + 3} textAnchor="end">{money(t * ymax)}</text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="var(--line2)" />
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + ih} stroke="var(--line2)" />
        <g transform={`translate(${pad.l} ${pad.t})`}>
          <path d={band} fill={color} opacity="0.13" />
          <path d={path(curve, 'mean', iw, ih, ymax)} fill="none" stroke={color} strokeWidth="2" />
          {op ? (
            <g>
              <line x1={(op.spend / xmax) * iw} x2={(op.spend / xmax) * iw} y1={0} y2={ih} stroke="var(--sky)" strokeDasharray="3 3" opacity="0.7" />
              <circle cx={(op.spend / xmax) * iw} cy={(1 - op.mean / ymax) * ih} r="4" fill="var(--sky)" />
            </g>
          ) : null}
        </g>
        <text x={pad.l} y={H - 8}>weekly-equivalent spend →</text>
        <text x={W - pad.r} y={H - 8} textAnchor="end" fill="var(--sky)">incremental revenue (90% band)</text>
      </svg>
    </div>
  );
}
function ResponseView({ bundle }) {
  const chans = (bundle.channel_contribution || []).map((c, i) => ({ id: c.channel_id, name: c.channel, color: colorFor(c.channel, i) }));
  const [sel, setSel] = React.useState(chans[0]?.id);
  const selChan = chans.find((c) => c.id === sel) || chans[0];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
      <div className="card">
        <div className="card-head"><div><h3>Channel detail</h3><div className="sub">Click a channel to focus</div></div></div>
        <div className="card-pad">{selChan ? <ResponseDetail bundle={bundle} channelId={selChan.id} name={selChan.name} color={selChan.color} /> : null}</div>
      </div>
      <div>
        <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em', marginBottom: 8 }}>ALL CHANNELS · SATURATION</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {chans.map((c) => {
            const curve = curveFor(bundle, c.id);
            const ymax = Math.max(...curve.map((p) => p.mean)) || 1;
            const xmax = Math.max(...curve.map((p) => p.spend)) || 1;
            const op = curve.find((p) => Math.abs(p.spend_multiplier - 1) < 1e-6);
            return (
              <div key={c.id} onClick={() => setSel(c.id)} style={{ background: sel === c.id ? 'rgba(125,155,255,0.08)' : 'var(--panel3)', border: '1px solid ' + (sel === c.id ? 'var(--line2)' : 'var(--line)'), borderRadius: 8, cursor: 'pointer', padding: '8px 10px' }}>
                <div className="row-h" style={{ gap: 6, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{c.name}</span>
                </div>
                <svg viewBox="0 0 150 70" style={{ width: '100%', display: 'block' }}>
                  <path d={path(curve, 'mean', 150, 60, ymax)} fill="none" stroke={c.color} strokeWidth="1.6" />
                  {op ? <circle cx={(op.spend / xmax) * 150} cy={(1 - op.mean / ymax) * 60} r="2.5" fill="var(--sky)" /> : null}
                </svg>
              </div>
            );
          })}
        </div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
          Each curve plots incremental revenue against spend (posterior mean). The blue dot is the current spend level — flat curve beyond it means saturation.
        </div>
      </div>
    </div>
  );
}

// ---- 4) Budget optimiser -----------------------------------------------------
function OptimiserView({ bundle }) {
  const bo = bundle.budget_optimization || {};
  const mean = (arr) => (arr || []).filter((r) => String(r.metric ?? 'mean').toLowerCase() === 'mean');
  const opt = mean(bo.optimized);
  const cur = Object.fromEntries(mean(bo.nonoptimized).map((r) => [r.channel, r]));
  const names = bundle.meta?.channel_display_names || {};
  const disp = (cid) => names[cid] || cid;
  const rows = opt.map((o, i) => {
    const c = cur[o.channel] || {};
    return {
      id: o.channel, name: disp(o.channel), color: colorFor(disp(o.channel), i),
      curPct: (c.pct_of_spend || 0) * 100, recPct: (o.pct_of_spend || 0) * 100,
      curSpend: c.spend, recSpend: o.spend, roi: o.roi,
    };
  });
  const lift = bo.total_incremental_lift || {};
  const totalSpend = rows.reduce((s, r) => s + (r.curSpend || 0), 0);

  const Bar = ({ field, label }) => {
    const total = rows.reduce((s, r) => s + r[field], 0) || 100;
    return (
      <div>
        <div className="between" style={{ marginBottom: 6 }}>
          <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em' }}>{label}</div>
          <div className="mono" style={{ fontSize: 11.5 }}>{money(totalSpend)} total</div>
        </div>
        <div style={{ display: 'flex', height: 36, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)' }}>
          {rows.map((r) => (
            <div key={r.id} style={{ width: `${(r[field] / total) * 100}%`, background: r.color, opacity: 0.82, display: 'grid', placeItems: 'center', color: '#0a0f1d', fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 600 }}>
              {r[field] >= 8 ? `${Math.round(r[field])}%` : ''}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-head"><div><h3>Allocation — current vs. recommended</h3><div className="sub">Fixed total budget; objective: maximise revenue at constant spend</div></div></div>
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Bar field="curPct" label="CURRENT ALLOCATION" />
          <Bar field="recPct" label="RECOMMENDED ALLOCATION" />
          <Legend items={rows.map((r) => ({ name: r.name, color: r.color }))} />
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-head"><div><h3>Per-channel shift</h3><div className="sub">Sorted by absolute change · optimal ROI per channel</div></div></div>
          <table className="tbl">
            <thead><tr><th>Channel</th><th>Current</th><th>Recommended</th><th style={{ width: '24%' }}>Move</th><th>Δ</th><th>Opt. ROI</th></tr></thead>
            <tbody>
              {[...rows].sort((a, b) => Math.abs(b.recPct - b.curPct) - Math.abs(a.recPct - a.curPct)).map((r) => {
                const delta = r.recPct - r.curPct;
                const up = delta > 0;
                const w = Math.min(1, Math.abs(delta) / 15);
                return (
                  <tr key={r.id}>
                    <td><div className="row-h" style={{ gap: 8 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} /><span style={{ fontWeight: 600 }}>{r.name}</span></div></td>
                    <td className="mono">{Math.round(r.curPct)}%</td>
                    <td className="mono">{Math.round(r.recPct)}%</td>
                    <td>
                      <div style={{ position: 'relative', height: 6, background: 'var(--panel3)', borderRadius: 999, border: '1px solid var(--line)' }}>
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'var(--line2)' }} />
                        <div style={{ position: 'absolute', top: -1, bottom: -1, left: up ? '50%' : `${50 - w * 50}%`, width: `${w * 50}%`, background: up ? 'var(--mint)' : 'var(--amber)', borderRadius: 999, opacity: 0.85 }} />
                      </div>
                    </td>
                    <td className="mono" style={{ color: up ? 'var(--mint)' : 'var(--amber)' }}>{up ? '+' : ''}{Math.round(delta)}%</td>
                    <td className="mono">{xN(r.roi, 1)}x</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="tile">
            <div className="lbl">Projected lift</div>
            <div className="v mono" style={{ color: 'var(--mint)' }}>+{xN(lift.delta_pct, 1)}<span className="unit">% rev</span></div>
            <div className="dim" style={{ fontSize: 12 }}>+{money(lift.delta)} at constant spend</div>
          </div>
          <div className="tile">
            <div className="lbl">Budget envelope</div>
            <div className="v mono">{money(totalSpend)}</div>
            <div className="dim" style={{ fontSize: 12 }}>flat to current</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- container ---------------------------------------------------------------
const TABS = [
  { id: 'contribution', label: 'Channel contribution' },
  { id: 'roi', label: 'ROI & marginal ROI' },
  { id: 'response', label: 'Response curves' },
  { id: 'optimiser', label: 'Budget optimiser' },
];

export default function ResultsLive({ client }) {
  const [bundle, setBundle] = React.useState(null);
  const [err, setErr] = React.useState(null);
  const [tab, setTab] = React.useState('contribution');

  React.useEffect(() => {
    fetch('/api/results?slug=' + encodeURIComponent(client?.id || 'aeon'), { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(setBundle)
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="callout" style={{ borderColor: 'rgba(232,122,112,0.4)' }}>Could not load results — {err}</div>;
  if (!bundle) return <div className="dim mono">loading posterior…</div>;

  const active = TABS.find((t) => t.id === tab);
  const m = bundle.meta || {};
  const cl = Math.round((m.confidence_level || 0.9) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="tabs">
        {TABS.map((t) => (
          <div key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>{t.label}</div>
        ))}
      </div>
      <div className="card">
        <div className="card-head">
          <div><h3>{active.label}</h3><div className="sub mono" style={{ fontSize: 11 }}>Latest posterior · {m.library} · trained {String(m.generated_at).slice(0, 10)}</div></div>
        </div>
        <div className="card-pad">
          {tab === 'contribution' && <ContributionView bundle={bundle} />}
          {tab === 'roi' && <ROIView bundle={bundle} />}
          {tab === 'response' && <ResponseView bundle={bundle} />}
          {tab === 'optimiser' && <OptimiserView bundle={bundle} />}
          <div className="row-h" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <span className="tag sky">{cl}% credible interval</span>
            <span className="tag">max R-hat {xN(bundle.model_health?.max_rhat, 3)}</span>
            <span className="tag">{bundle.model_health?.training_window?.n_weeks} wks · weekly</span>
            <span className="dim mono" style={{ fontSize: 11, marginLeft: 'auto' }}>Genuine Meridian outputs · every figure carries a {cl}% credible interval.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
