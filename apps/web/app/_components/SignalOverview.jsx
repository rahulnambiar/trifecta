'use client';
// Signal Overview — a model-driven snapshot the CMO sees when Signal opens, before they
// start asking. 3–4 executive charts derived from the live Meridian posterior
// (/api/results): what's driving revenue, return per $1, the budget opportunity, and how
// trustworthy the model is. Tableau shows the data; this shows the decision.
import React from 'react';

const COLORS = { Meta: '#4f6ef2', YouTube: '#7d9bff', TV: '#e6b052', 'Paid Search': '#37d39b', TikTok: '#c773d6' };
const FALLBACK = ['#4f6ef2', '#7d9bff', '#e6b052', '#37d39b', '#c773d6', '#c98568', '#b07e3d'];
const colorFor = (n, i) => COLORS[n] || FALLBACK[i % FALLBACK.length];

const money = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'k';
  return '$' + Math.round(n);
};
const xN = (n, d = 1) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(d));

function MiniBars({ items }) {
  const [sel, setSel] = React.useState(null);
  const max = Math.max(0.0001, ...items.map((i) => i.hi ?? i.value ?? 0));
  return (
    <div className="ov-bars">
      {items.map((it, i) => (
        <div key={i} className="ov-bar-row" style={{ cursor: 'pointer' }} title={it.ci || ''}
          onClick={() => setSel(sel === i ? null : i)}>
          <div className="ov-bar-label">{it.label}</div>
          <div className="ov-bar-track">
            <div className="ov-bar-fill" style={{ width: Math.max(2, (Math.max(0, it.value) / max) * 100) + '%', background: it.color, opacity: sel != null && sel !== i ? 0.45 : 1 }} />
          </div>
          <div className="ov-bar-val">{sel === i && it.ci ? it.ci : it.valueLabel}</div>
        </div>
      ))}
    </div>
  );
}

function Card({ title, sub, children }) {
  return (
    <div className="ov-card">
      <div className="ov-card-head">
        <div className="ov-card-title">{title}</div>
        {sub ? <div className="ov-card-sub">{sub}</div> : null}
      </div>
      {children}
    </div>
  );
}

export default function SignalOverview({ clientName }) {
  const [r, setR] = React.useState(null);
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    let on = true;
    fetch('/api/results').then((x) => (x.ok ? x.json() : null)).then((j) => { if (on) (j ? setR(j) : setFailed(true)); }).catch(() => on && setFailed(true));
    return () => { on = false; };
  }, []);

  if (failed) return null;
  if (!r) return <div className="ov-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="ov-card ov-skeleton" />)}</div>;

  const contrib = [...(r.channel_contribution || [])].sort((a, b) => (b.incremental_outcome?.median || 0) - (a.incremental_outcome?.median || 0));
  const contribItems = contrib.map((c, i) => {
    const io = c.incremental_outcome || {};
    return {
      label: c.channel, color: colorFor(c.channel, i), value: io.median, lo: io.ci_lo, hi: io.ci_hi,
      valueLabel: `${money(io.median)} · ${xN(c.contribution_pct, 0)}%`,
      ci: io.ci_lo != null ? `${money(io.ci_lo)}–${money(io.ci_hi)}` : null,
    };
  });
  const roiItems = [...contrib].sort((a, b) => (b.roi?.median || 0) - (a.roi?.median || 0)).map((c, i) => {
    const ro = c.roi || {};
    return {
      label: c.channel, color: colorFor(c.channel, i), value: ro.median, lo: ro.ci_lo, hi: ro.ci_hi,
      valueLabel: `${xN(ro.median, 1)}x`, ci: ro.ci_lo != null ? `${xN(ro.ci_lo, 1)}–${xN(ro.ci_hi, 1)}x` : null,
    };
  });

  // budget opportunity
  const opt = (r.budget_optimization?.optimized || []).filter((x) => x.metric === 'mean');
  const cur = (r.budget_optimization?.nonoptimized || []).filter((x) => x.metric === 'mean');
  const optTotal = opt.reduce((s, x) => s + (x.incremental_outcome || 0), 0);
  const curTotal = cur.reduce((s, x) => s + (x.incremental_outcome || 0), 0);
  const lift = curTotal ? ((optTotal - curTotal) / curTotal) * 100 : null;

  // model trust
  const mh = r.model_health || {};
  const rhats = (mh.rhat || []).map((x) => x.max_rhat).filter((v) => typeof v === 'number');
  const maxRhat = typeof mh.max_rhat === 'number' ? mh.max_rhat : (rhats.length ? Math.max(...rhats) : null);
  const acc = mh.predictive_accuracy || r.predictive_accuracy || [];
  const mape = acc.find((p) => p.metric === 'MAPE' && p.evaluation_set === 'Test' && p.geo_granularity === 'national')?.value;
  const tone = maxRhat == null ? '' : maxRhat <= 1.1 ? 'mint' : maxRhat <= 1.2 ? 'amber' : 'red';
  const asOf = r.meta?.generated_at ? new Date(r.meta.generated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div className="signal-overview">
      <div className="ov-title">{clientName} · marketing snapshot</div>
      <div className="ov-grid">
        <Card title="What's driving revenue" sub="incremental · 90% CI">
          <MiniBars items={contribItems} />
        </Card>
        <Card title="Return on each $1" sub="ROI by channel">
          <MiniBars items={roiItems} />
        </Card>
        <Card title="Budget opportunity" sub="optimal vs current mix">
          <div className="ov-stat">
            <div className={'ov-stat-big ' + (lift > 0 ? 'mint' : '')}>{lift != null ? `${lift > 0 ? '+' : ''}${xN(lift, 0)}%` : '—'}</div>
            <div className="ov-stat-sub">more revenue at the same spend, by reallocating budget to where it works hardest.</div>
            <div className="ov-stat-row"><span>Current</span><b>{money(curTotal)}</b></div>
            <div className="ov-stat-row"><span>Optimised</span><b className="mint">{money(optTotal)}</b></div>
          </div>
        </Card>
        <Card title="Model trust" sub="convergence & accuracy">
          <div className="ov-stat">
            <div className="ov-tiles">
              <div className="ov-tile"><div className="t-lbl">Convergence</div><div className={'t-val ' + tone}>R̂ {xN(maxRhat, 2)}</div><div className="t-sub">{maxRhat != null && maxRhat <= 1.1 ? 'healthy' : 'review'}</div></div>
              <div className="ov-tile"><div className="t-lbl">Holdout error</div><div className="t-val">{mape != null ? (mape * 100).toFixed(0) + '%' : '—'}</div><div className="t-sub">national MAPE</div></div>
            </div>
            {asOf ? <div className="ov-stat-sub">Trained on {asOf}. Every figure carries its 90% credible interval.</div> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
