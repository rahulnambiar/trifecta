'use client';
// Temporary Results preview — renders a Meridian results.json in the Trifecta
// theme so the artifact can be eyeballed in the browser. Reads /results.json
// from public/ (overwritten with the real GCS artifact after each run).
// This is a scratch viewer for M1 validation; M4 wires the real Results screen.
import React from 'react';

const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return n.toFixed(0);
};
const fmtNum = (n, d = 2) => (n == null || isNaN(n) ? '—' : Number(n).toFixed(d));
const ci = (lo, hi, d = 2) =>
  lo == null || hi == null ? '' : `[${fmtNum(lo, d)} – ${fmtNum(hi, d)}]`;
// optimizer xarray carries a `metric` dim (mean / median / ci bounds) — keep the point estimate.
const meanRows = (a) => (a || []).filter((r) => String(r?.metric ?? 'mean').toLowerCase() === 'mean');

function Bar({ pct, color = 'var(--blue)' }) {
  return (
    <div style={{ height: 8, background: 'var(--panel3)', borderRadius: 999, border: '1px solid var(--line)', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', background: color }} />
    </div>
  );
}

function Tile({ label, value, sub, tone }) {
  const color = tone === 'mint' ? 'var(--mint)' : tone === 'amber' ? 'var(--amber)' : tone === 'red' ? 'var(--red)' : 'var(--text)';
  return (
    <div className="tile">
      <div className="lbl">{label}</div>
      <div className="v" style={{ color, fontSize: 22 }}>{value}</div>
      {sub ? <div className="dim" style={{ fontSize: 11.5 }}>{sub}</div> : null}
    </div>
  );
}

export default function ResultsPreview() {
  const [data, setData] = React.useState(null);
  const [err, setErr] = React.useState(null);

  const load = React.useCallback(() => {
    fetch('/results.json', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);
  React.useEffect(load, [load]);

  if (err) return <Shell><div className="callout" style={{ borderColor: 'rgba(232,122,112,0.4)' }}>Could not load results.json — {err}</div></Shell>;
  if (!data) return <Shell><div className="dim mono">loading results.json…</div></Shell>;

  const m = data.meta || {};
  const isSample = m.source === 'sample-placeholder';
  const isSmoke = m.source === 'smoke';
  const cl = Math.round((m.confidence_level || 0.9) * 100);
  const health = data.model_health || {};
  const tw = health.training_window || {};
  const contrib = data.channel_contribution || [];
  const mroi = data.marginal_roi || [];
  const opt = data.budget_optimization || {};
  const lift = opt.total_incremental_lift || {};

  const maxRoi = Math.max(1, ...contrib.map((c) => c.roi?.ci_hi || c.roi?.median || 0));
  const maxMroi = Math.max(1, ...mroi.map((c) => c.ci_hi || c.median || 0));
  const rhatTone = health.max_rhat == null ? undefined : health.max_rhat <= 1.1 ? 'mint' : health.max_rhat <= 1.2 ? 'amber' : 'red';

  return (
    <Shell>
      {/* banner */}
      {isSample ? (
        <div className="callout" style={{ borderColor: 'rgba(230,176,82,0.4)', background: 'rgba(230,176,82,0.06)', marginBottom: 16 }}>
          <span className="ic" style={{ color: 'var(--amber)' }}>●</span>
          <div><strong>Sample placeholder</strong> — not from a model run yet. This shows the layout; it’s replaced by the real <span className="mono">results.json</span> once the Meridian job finishes.</div>
        </div>
      ) : isSmoke ? (
        <div className="callout" style={{ borderColor: 'rgba(230,176,82,0.4)', background: 'rgba(230,176,82,0.06)', marginBottom: 16 }}>
          <span className="ic" style={{ color: 'var(--amber)' }}>●</span>
          <div><strong>Smoke run — real Meridian, junk numbers.</strong> This is a genuine <span className="mono">results.json</span> from a live training job, so the <em>structure</em> is real — but the sampler was tiny (2 chains · 50 draws), so R-hat ≈ {fmtNum(health.max_rhat, 0)} and the values are meaningless. The real run replaces these with trustworthy numbers.</div>
        </div>
      ) : (
        <div className="callout" style={{ marginBottom: 16 }}>
          <div><strong>Live Meridian output.</strong> Generated <span className="mono">{m.generated_at}</span> · {cl}% credible intervals. {m.disclaimer}</div>
        </div>
      )}

      {/* header */}
      <div className="between" style={{ marginBottom: 16 }}>
        <div>
          <div className="display" style={{ fontWeight: 700, fontSize: 22 }}>{m.client || 'Results'} — Meridian outputs</div>
          <div className="dim mono" style={{ fontSize: 11.5, marginTop: 4 }}>
            {m.library} · {m.dataset} · sampler {m.sampler?.method} {m.sampler?.n_chains}×{m.sampler?.n_keep}
          </div>
        </div>
        <button className="btn ghost small" onClick={load}>Reload</button>
      </div>

      {/* model health */}
      <div className="grid g4" style={{ marginBottom: 22 }}>
        <Tile label="Max R-hat" value={fmtNum(health.max_rhat)} sub={rhatTone === 'mint' ? 'converged' : 'check convergence'} tone={rhatTone} />
        <Tile label="Holdout MAPE" value={health.mape == null ? '—' : Math.round(health.mape * 100) + '%'} sub={`last ${tw.holdout_weeks ?? '—'} wks held out`} />
        <Tile label="R²" value={fmtNum(health.r_squared)} />
        <Tile label="Training window" value={tw.n_weeks ? tw.n_weeks + ' wks' : '—'} sub={tw.start ? `${tw.start} → ${tw.end}` : ''} />
      </div>

      {/* channel contribution */}
      <Section title="Channel contribution" sub={`Incremental revenue & ROI per channel · ${cl}% credible interval`}>
        <table className="tbl">
          <thead><tr><th>Channel</th><th>Contribution</th><th style={{ width: 220 }}>Share</th><th>Incremental (median)</th><th>ROI (median · CI)</th></tr></thead>
          <tbody>
            {contrib.map((c) => (
              <tr key={c.channel_id}>
                <td style={{ fontWeight: 600 }}>{c.channel}</td>
                <td className="mono">{fmtNum(c.contribution_pct, 1)}%</td>
                <td><Bar pct={c.contribution_pct} color="linear-gradient(90deg,var(--blue),var(--sky))" /></td>
                <td className="mono">{fmtMoney(c.incremental_outcome?.median)} <span className="faint" style={{ fontSize: 10.5 }}>{ci(c.incremental_outcome?.ci_lo, c.incremental_outcome?.ci_hi, 0).replace(/(\d{4,})/g, (x) => fmtMoney(+x))}</span></td>
                <td className="mono">{fmtNum(c.roi?.median)}x <span className="faint" style={{ fontSize: 10.5 }}>{ci(c.roi?.ci_lo, c.roi?.ci_hi)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ROI & marginal ROI bars */}
      <div className="grid g2" style={{ marginBottom: 22 }}>
        <Section title="ROI by channel" sub="Return per $1, full window">
          {contrib.map((c) => (
            <BarRow key={c.channel_id} label={c.channel} value={`${fmtNum(c.roi?.median)}x`} pct={(c.roi?.median / maxRoi) * 100} lo={(c.roi?.ci_lo / maxRoi) * 100} hi={(c.roi?.ci_hi / maxRoi) * 100} />
          ))}
        </Section>
        <Section title="Marginal ROI" sub="Return on the next $1">
          {mroi.map((c) => (
            <BarRow key={c.channel_id} label={c.channel} value={`${fmtNum(c.median)}x`} pct={(c.median / maxMroi) * 100} lo={(c.ci_lo / maxMroi) * 100} hi={(c.ci_hi / maxMroi) * 100} color="var(--mint)" />
          ))}
        </Section>
      </div>

      {/* budget optimiser */}
      <Section title="Budget optimiser" sub="Meridian's optimal allocation vs. the current plan">
        <div className="grid g3" style={{ marginBottom: 14 }}>
          <Tile label="Current incremental" value={fmtMoney(lift.current)} />
          <Tile label="Optimised incremental" value={fmtMoney(lift.optimized)} tone="mint" />
          <Tile label="Lift" value={lift.delta_pct == null ? '—' : '+' + fmtNum(lift.delta_pct, 1) + '%'} sub={lift.delta ? `+${fmtMoney(lift.delta)} revenue` : ''} tone="mint" />
        </div>
        {Array.isArray(opt.optimized) && opt.optimized.length ? (
          <table className="tbl">
            <thead><tr><th>Channel</th><th>Current spend</th><th>Optimised spend</th><th>Δ</th><th>Optimised ROI</th></tr></thead>
            <tbody>
              {meanRows(opt.optimized).map((o, i) => {
                const n = meanRows(opt.nonoptimized).find((x) => x.channel === o.channel) || {};
                const d = (o.spend ?? 0) - (n.spend ?? 0);
                return (
                  <tr key={o.channel || i}>
                    <td style={{ fontWeight: 600 }}>{o.channel}</td>
                    <td className="mono">{fmtMoney(n.spend)}</td>
                    <td className="mono">{fmtMoney(o.spend)}</td>
                    <td className="mono" style={{ color: d >= 0 ? 'var(--mint)' : 'var(--red)' }}>{d >= 0 ? '+' : ''}{fmtMoney(d)}</td>
                    <td className="mono">{fmtNum(o.roi)}x</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <div className="dim">No optimiser records.</div>}
      </Section>

      <div className="faint mono" style={{ fontSize: 10.5, marginTop: 8 }}>
        response curves: {(data.response_curves?.points || []).length} points · this is a temporary M1 preview route.
      </div>
    </Shell>
  );
}

function BarRow({ label, value, pct, lo, hi, color = 'var(--blue)' }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="between" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 12.5 }}>{label}</span>
        <span className="mono" style={{ fontSize: 12 }}>{value}</span>
      </div>
      <div style={{ position: 'relative' }}>
        <Bar pct={pct} color={color} />
        {lo != null && hi != null && !isNaN(lo) && !isNaN(hi) ? (
          <div style={{ position: 'absolute', top: -2, left: `${lo}%`, width: `${Math.max(0, hi - lo)}%`, height: 12, borderLeft: '1px solid var(--faint)', borderRight: '1px solid var(--faint)', opacity: 0.6 }} />
        ) : null}
      </div>
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <div className="card" style={{ marginBottom: 22 }}>
      <div className="card-head"><div><h3>{title}</h3>{sub ? <div className="sub">{sub}</div> : null}</div></div>
      <div className="card-pad">{children}</div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '28px 22px' }}>
      <div className="row-h" style={{ gap: 10, marginBottom: 18 }}>
        <span className="logomark" />
        <span className="display" style={{ fontWeight: 800, letterSpacing: '0.06em' }}>TRIFECTA</span>
        <span className="wf-badge" style={{ marginLeft: 8 }}>RESULTS PREVIEW</span>
      </div>
      {children}
    </div>
  );
}
