'use client';
// Claritin demo "Overview" hero: top-line stats, the reported-ROAS vs incremental-ROI
// story, and a US geo bubble map (high-fidelity geo is the retail-media pitch).
// Reads the bundle from /api/results (channel_contribution, geo, hero, model_health).
import React from 'react';

const money = (v) => {
  if (v == null) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  if (a >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const heatColor = (t) => `rgb(${lerp(74, 232, t)}, ${lerp(127, 115, t)}, ${lerp(208, 79, t)})`; // blue -> coral

function Tile({ label, value, sub, tone }) {
  return (
    <div style={{ flex: '1 1 150px', minWidth: 140, background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '12px 14px' }}>
      <div className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: tone || 'var(--text)', marginTop: 2 }}>{value}</div>
      {sub ? <div className="dim" style={{ fontSize: 11, marginTop: 1 }}>{sub}</div> : null}
    </div>
  );
}

function ReportedVsIncremental({ channels }) {
  const rows = [...channels].filter((c) => c.roi?.median != null)
    .sort((a, b) => (b.roi.median) - (a.roi.median));
  const max = Math.max(...rows.map((r) => r.reported_roas || r.roi.median)) * 1.05;
  const W = (v) => `${Math.max(0, (v / max) * 100)}%`;
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>Reported ROAS vs true incremental ROI</div>
      <div className="dim" style={{ fontSize: 12, marginBottom: 12 }}>
        What the ad platforms claim (last-click) versus what the Meridian model says is actually incremental. The gap is demand you would capture anyway.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((c, i) => {
          const inc = c.roi.median, rep = c.reported_roas || inc;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10, alignItems: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'right', color: 'var(--text)' }}>{c.channel}</div>
              <div>
                <div style={{ position: 'relative', height: 12, marginBottom: 3 }}>
                  <div style={{ position: 'absolute', height: 12, width: W(rep), background: 'rgba(140,150,170,0.30)', borderRadius: 3 }} />
                  <span className="dim mono" style={{ position: 'absolute', left: `calc(${W(rep)} + 6px)`, fontSize: 9.5, lineHeight: '12px' }}>{rep.toFixed(1)}x reported</span>
                </div>
                <div style={{ position: 'relative', height: 12 }}>
                  <div style={{ position: 'absolute', height: 12, width: W(inc), background: 'var(--blue)', borderRadius: 3 }} />
                  <span className="mono" style={{ position: 'absolute', left: `calc(${W(inc)} + 6px)`, fontSize: 9.5, lineHeight: '12px', color: 'var(--text)' }}>{inc.toFixed(2)}x incremental</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GeoMap({ geo }) {
  const W = 660, H = 300, PAD = 14;
  const LON0 = -125, LON1 = -66, LAT0 = 24, LAT1 = 49.5;
  const px = (lng) => PAD + ((lng - LON0) / (LON1 - LON0)) * (W - 2 * PAD);
  const py = (lat) => PAD + ((LAT1 - lat) / (LAT1 - LAT0)) * (H - 2 * PAD);
  const maxU = Math.max(...geo.map((g) => g.annual_units));
  const r = (u) => 5 + 26 * Math.sqrt(u / maxU);
  const idxs = geo.map((g) => g.per_capita_index);
  const lo = Math.min(...idxs), hi = Math.max(...idxs);
  const t = (g) => (g.per_capita_index - lo) / (hi - lo || 1);
  const labelled = [...geo].sort((a, b) => b.annual_units - a.annual_units).slice(0, 6)
    .concat([...geo].sort((a, b) => b.per_capita_index - a.per_capita_index).slice(0, 2));
  const showLabel = new Set(labelled.map((g) => g.dma));
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>Demand by US market (DMA)</div>
      <div className="dim" style={{ fontSize: 12, marginBottom: 8 }}>
        Bubble size = sales volume · colour = allergy intensity (per-capita demand). High-fidelity geo is what makes the model trustworthy market by market.
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: 'var(--panel)', borderRadius: 8 }}>
        {[...geo].sort((a, b) => b.annual_units - a.annual_units).map((g, i) => (
          <g key={i}>
            <circle cx={px(g.lng)} cy={py(g.lat)} r={r(g.annual_units)} fill={heatColor(t(g))} fillOpacity="0.7" stroke="var(--panel)" strokeWidth="1" />
            {showLabel.has(g.dma) ? (
              <text x={px(g.lng)} y={py(g.lat) - r(g.annual_units) - 3} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text)', fontWeight: 600 }}>{g.dma}</text>
            ) : null}
          </g>
        ))}
      </svg>
      <div className="row-h" style={{ gap: 14, marginTop: 8, fontSize: 11 }}>
        <span className="dim">Allergy intensity:</span>
        <span className="row-h" style={{ gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: heatColor(0), display: 'inline-block' }} /> lower</span>
        <span className="row-h" style={{ gap: 5 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: heatColor(1), display: 'inline-block' }} /> higher (Wichita, OKC, New Orleans…)</span>
      </div>
    </div>
  );
}

export default function ClaritinHero({ bundle }) {
  const h = bundle.hero || {};
  const mh = bundle.model_health || {};
  const acc = mh.predictive_accuracy || [];
  const mape = acc.find((p) => p.metric === 'MAPE' && p.evaluation_set === 'Test' && p.geo_granularity === 'national')?.value;
  const geo = bundle.geo || [];
  const contrib = bundle.channel_contribution || [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="row-h" style={{ gap: 10, flexWrap: 'wrap' }}>
        <Tile label="Annual revenue" value={money(h.annual_revenue_usd)} sub="modeled, all channels" />
        <Tile label="Media investment" value={`${money(h.media_spend_usd)}/yr`} sub={`${h.media_driven_share_pct}% media-driven`} />
        <Tile label="Base vs media" value={`${h.baseline_share_pct}/${h.media_driven_share_pct}`} sub="baseline / incremental %" />
        <Tile label="Coverage" value={`${h.n_markets} DMAs`} sub={`${h.n_weeks} weeks · weekly`} />
        <Tile label="Model trust" value={`R̂ ${mh.max_rhat?.toFixed(2)}`} sub={mape != null ? `${(mape * 100).toFixed(0)}% holdout MAPE` : 'converged'} tone="var(--mint)" />
        <Tile label="Optimiser headroom" value={`+${h.optimizer_lift_pct}%`} sub="same budget, reallocated" tone="var(--mint)" />
      </div>
      <ReportedVsIncremental channels={contrib} />
      {geo.length ? <GeoMap geo={geo} /> : null}
      <div className="dim mono" style={{ fontSize: 10 }}>Representative data calibrated to public US benchmarks (allergy seasonality, AAFA regional severity, Census). Genuine Meridian engine. Not Bayer data.</div>
    </div>
  );
}
