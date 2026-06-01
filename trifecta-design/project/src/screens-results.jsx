// Results screens — wireframe sketches of each output chart.
// Wireframe fidelity: line work, flat fills, dashed grids, mono axis labels.
// No external chart libs — every shape is hand-drawn SVG.

// -----------------------------------------------------------------------------
// Channel palette — kept stable across all four result views.
const CHAN = [
  { id: 'base',   name: 'Base / organic', color: '#3a4663' },
  { id: 'tv',     name: 'TV',             color: '#e6b052' },
  { id: 'radio',  name: 'Radio',          color: '#c98568' },
  { id: 'print',  name: 'Print',          color: '#7e6a5a' },
  { id: 'ooh',    name: 'Out-of-Home',    color: '#b07e3d' },
  { id: 'meta',   name: 'Meta',           color: '#4f6ef2' },
  { id: 'yt',     name: 'YouTube',        color: '#7d9bff' },
  { id: 'tiktok', name: 'TikTok',         color: '#c773d6' },
  { id: 'search', name: 'Paid Search',    color: '#37d39b' },
];
const CHAN_BY_ID = Object.fromEntries(CHAN.map(c => [c.id, c]));

// Channels in the rough order of contribution (largest first), excl. base.
const MEDIA_CHANS = ['search','meta','yt','tv','tiktok','ooh','radio','print'];

// Deterministic pseudo-random (so the SVGs are stable).
function seeded(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// Generate 26 weeks of stacked contribution data.
function buildContributionSeries() {
  const r = seeded(7);
  const weeks = 26;
  const channels = ['base', ...MEDIA_CHANS];
  // base ~ slow seasonal, others ~ low-freq noise scaled by share
  const shares = { base: 0.46, search: 0.13, meta: 0.10, yt: 0.07, tv: 0.09, tiktok: 0.04, ooh: 0.05, radio: 0.03, print: 0.03 };
  const totalAt = (w) => 1 + 0.18 * Math.sin((w / weeks) * Math.PI * 2 - 0.6) + 0.05 * Math.sin(w * 0.9);
  const series = channels.map(ch => {
    const arr = [];
    for (let w = 0; w < weeks; w++) {
      const t = totalAt(w);
      // unique wobble per channel
      const wobble = 0.85 + 0.3 * r() + 0.15 * Math.sin(w * (0.4 + channels.indexOf(ch) * 0.13));
      arr.push(shares[ch] * t * wobble);
    }
    return { id: ch, values: arr };
  });
  // Normalise so total per week is plausible revenue (SGD k)
  const scale = 38000; // ~ SGD k per week peak
  const stacked = [];
  const totals = [];
  for (let w = 0; w < weeks; w++) {
    let acc = 0;
    const col = [];
    series.forEach(s => {
      const v = s.values[w] * scale;
      col.push({ id: s.id, y0: acc, y1: acc + v });
      acc += v;
    });
    stacked.push(col);
    totals.push(acc);
  }
  return { weeks, stacked, totals };
}

const CONTRIB = buildContributionSeries();

// -----------------------------------------------------------------------------
// SVG chart frame helpers

const ChartFrame = ({ width, height, padding = { t: 14, r: 14, b: 28, l: 44 }, yTicks = [], xTicks = [], children, yLabel, xLabel }) => {
  const ix = padding.l, iy = padding.t;
  const iw = width - padding.l - padding.r;
  const ih = height - padding.t - padding.b;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, display: 'block' }} fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--faint)">
      {/* y grid */}
      {yTicks.map((t, i) => (
        <g key={'y' + i}>
          <line x1={ix} x2={ix + iw} y1={iy + ih - t.y * ih} y2={iy + ih - t.y * ih} stroke="var(--line)" strokeDasharray="2 3" />
          <text x={ix - 6} y={iy + ih - t.y * ih + 3} textAnchor="end">{t.label}</text>
        </g>
      ))}
      {/* axes */}
      <line x1={ix} x2={ix + iw} y1={iy + ih} y2={iy + ih} stroke="var(--line2)" />
      <line x1={ix} x2={ix} y1={iy} y2={iy + ih} stroke="var(--line2)" />
      {/* x ticks */}
      {xTicks.map((t, i) => (
        <text key={'x' + i} x={ix + t.x * iw} y={iy + ih + 14} textAnchor="middle">{t.label}</text>
      ))}
      {/* Inner plot transform */}
      <g transform={`translate(${ix} ${iy})`}>{children({ w: iw, h: ih })}</g>
      {yLabel ? <text x={10} y={iy + ih / 2} textAnchor="middle" transform={`rotate(-90 10 ${iy + ih / 2})`} fill="var(--faint)" style={{ letterSpacing: '0.12em' }}>{yLabel}</text> : null}
      {xLabel ? <text x={ix + iw / 2} y={height - 4} textAnchor="middle" fill="var(--faint)" style={{ letterSpacing: '0.12em' }}>{xLabel}</text> : null}
    </svg>
  );
};

const Legend = ({ items, style }) => (
  <div className="row-h" style={{ gap: 14, flexWrap: 'wrap', ...(style || {}) }}>
    {items.map(it => (
      <div key={it.id} className="row-h" style={{ gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: it.color, display: 'inline-block' }} />
        <span className="mono" style={{ fontSize: 11 }}>{it.name}</span>
      </div>
    ))}
  </div>
);

// -----------------------------------------------------------------------------
// 1) Channel Contribution — stacked weekly areas

const ContributionChart = ({ width = 720, height = 320 }) => {
  const { weeks, stacked, totals } = CONTRIB;
  const yMax = Math.max(...totals) * 1.08;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(y => ({ y, label: `${Math.round(y * yMax / 1000)}k` }));
  const monthLabels = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];
  const xTicks = monthLabels.map((m, i) => ({ x: i / (monthLabels.length - 1), label: m }));

  // Build path strings per channel layer
  const channels = ['base', ...MEDIA_CHANS];
  const pathsByChan = {};
  channels.forEach(id => {
    let top = `M `, bot = ` L `;
    for (let w = 0; w < weeks; w++) {
      const x = (w / (weeks - 1));
      const seg = stacked[w].find(s => s.id === id);
      const y0 = 1 - seg.y0 / yMax;
      const y1 = 1 - seg.y1 / yMax;
      top += `${w === 0 ? '' : 'L '}${x} ${y1} `;
    }
    for (let w = weeks - 1; w >= 0; w--) {
      const x = (w / (weeks - 1));
      const seg = stacked[w].find(s => s.id === id);
      const y0 = 1 - seg.y0 / yMax;
      bot += `${w === weeks - 1 ? '' : 'L '}${x} ${y0} `;
    }
    pathsByChan[id] = top + bot + ' Z';
  });

  return (
    <ChartFrame
      width={width} height={height}
      yTicks={yTicks}
      xTicks={xTicks}
      yLabel="SGD / WEEK"
      xLabel="WEEK (nov 2025 → apr 2026)"
    >
      {({ w, h }) => (
        <g>
          {/* layers */}
          {channels.map(id => (
            <path key={id} d={pathsByChan[id]} transform={`scale(${w} ${h})`} fill={CHAN_BY_ID[id].color} opacity={id === 'base' ? 0.55 : 0.78} />
          ))}
          {/* total line on top */}
          <path
            d={'M ' + totals.map((t, i) => `${(i / (weeks - 1)) * w} ${(1 - t / yMax) * h}`).join(' L ')}
            fill="none" stroke="var(--text)" strokeWidth="1" opacity="0.45"
          />
          {/* selected-week marker */}
          <line x1={w * 0.74} x2={w * 0.74} y1={0} y2={h} stroke="var(--sky)" strokeDasharray="3 3" opacity="0.7" />
          <circle cx={w * 0.74} cy={(1 - totals[Math.round(0.74 * (weeks - 1))] / yMax) * h} r="3" fill="var(--sky)" />
        </g>
      )}
    </ChartFrame>
  );
};

const ContributionView = () => {
  // Aggregate contribution share per channel
  const totals = MEDIA_CHANS.concat(['base']).map(id => {
    const sum = CONTRIB.stacked.reduce((acc, col) => acc + (col.find(s => s.id === id).y1 - col.find(s => s.id === id).y0), 0);
    return { id, sum };
  });
  const grand = totals.reduce((a, b) => a + b.sum, 0);
  const sorted = [...totals].sort((a, b) => b.sum - a.sum);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
      <div>
        <ContributionChart />
        <Legend items={[CHAN_BY_ID.base, ...MEDIA_CHANS.map(id => CHAN_BY_ID[id])]} style={{ marginTop: 6, paddingLeft: 44 }} />
      </div>
      <Card>
        <CardHead title="Share of revenue" sub="Last 26 weeks · posterior mean" />
        <div style={{ padding: '6px 0' }}>
          {sorted.map(t => {
            const pct = (t.sum / grand) * 100;
            const ch = CHAN_BY_ID[t.id];
            return (
              <div key={t.id} style={{ padding: '8px 16px' }}>
                <div className="between" style={{ marginBottom: 4 }}>
                  <div className="row-h" style={{ gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: ch.color }} />
                    <span style={{ fontSize: 12 }}>{ch.name}</span>
                  </div>
                  <span className="mono" style={{ fontSize: 11.5 }}>{pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--panel3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: pct + '%', height: '100%', background: ch.color, opacity: 0.85 }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 2) ROI & Marginal ROI — horizontal bars with 90% CI

const ROI_DATA = [
  { id: 'search', roi: 3.4, m: 1.9, lo: 1.4, hi: 2.4 },
  { id: 'meta',   roi: 2.6, m: 1.7, lo: 1.2, hi: 2.2 },
  { id: 'yt',     roi: 3.1, m: 2.4, lo: 1.6, hi: 3.1 },
  { id: 'tv',     roi: 1.9, m: 1.1, lo: 0.6, hi: 1.7 },
  { id: 'tiktok', roi: 2.8, m: 2.6, lo: 1.5, hi: 3.6 },
  { id: 'ooh',    roi: 1.4, m: 0.8, lo: 0.3, hi: 1.3 },
  { id: 'radio',  roi: 1.5, m: 0.7, lo: 0.2, hi: 1.2 },
  { id: 'print',  roi: 1.1, m: 0.4, lo: 0.0, hi: 0.9 },
];

const ROIView = () => {
  const max = 4;
  const rowH = 28;
  const width = 720;
  const height = ROI_DATA.length * rowH + 36;
  const padL = 110, padR = 24, padT = 14, padB = 22;
  const iw = width - padL - padR;
  const xT = (v) => padL + (v / max) * iw;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
      <div>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height, display: 'block' }} fontFamily="var(--f-mono)" fontSize="10" fill="var(--faint)">
          {/* x grid */}
          {[0,1,2,3,4].map(v => (
            <g key={v}>
              <line x1={xT(v)} x2={xT(v)} y1={padT} y2={height - padB} stroke="var(--line)" strokeDasharray="2 3" />
              <text x={xT(v)} y={height - 6} textAnchor="middle">{v}x</text>
            </g>
          ))}
          <line x1={padL} x2={padL} y1={padT} y2={height - padB} stroke="var(--line2)" />
          {/* breakeven */}
          <line x1={xT(1)} x2={xT(1)} y1={padT} y2={height - padB} stroke="var(--red)" strokeDasharray="3 3" opacity="0.5" />
          <text x={xT(1) + 4} y={padT + 9} fill="var(--red)" opacity="0.8">break-even</text>

          {ROI_DATA.map((d, i) => {
            const y = padT + i * rowH + 6;
            const ch = CHAN_BY_ID[d.id];
            return (
              <g key={d.id}>
                <text x={padL - 10} y={y + 13} textAnchor="end" fill="var(--text)" fontFamily="var(--f-body)" fontSize="11.5">{ch.name}</text>
                {/* ROI solid bar (back) */}
                <rect x={padL} y={y} width={(d.roi / max) * iw} height="9" fill={ch.color} opacity="0.55" rx="1" />
                {/* Marginal ROI bar (front, narrower) */}
                <rect x={padL} y={y + 11} width={(d.m / max) * iw} height="5" fill={ch.color} rx="1" />
                {/* CI on marginal */}
                <line x1={xT(d.lo)} x2={xT(d.hi)} y1={y + 13.5} y2={y + 13.5} stroke="var(--text)" strokeWidth="1" opacity="0.7" />
                <line x1={xT(d.lo)} x2={xT(d.lo)} y1={y + 10} y2={y + 17} stroke="var(--text)" strokeWidth="1" opacity="0.7" />
                <line x1={xT(d.hi)} x2={xT(d.hi)} y1={y + 10} y2={y + 17} stroke="var(--text)" strokeWidth="1" opacity="0.7" />
                {/* value labels */}
                <text x={xT(d.roi) + 6} y={y + 7} fill="var(--text)" fontSize="9.5">{d.roi.toFixed(1)}x</text>
              </g>
            );
          })}
        </svg>
        <Legend
          style={{ paddingLeft: 110, marginTop: 4 }}
          items={[
            { id: 'a', name: 'ROI (average)', color: 'rgba(125,155,255,0.55)' },
            { id: 'b', name: 'Marginal ROI', color: 'var(--sky)' },
            { id: 'c', name: '90% credible interval', color: 'var(--text)' },
          ]}
        />
      </div>

      <Card>
        <CardHead title="Reading this" sub="What the two bars mean" />
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="row-h" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ width: 18, height: 8, background: 'rgba(125,155,255,0.55)', borderRadius: 1 }} />
              <span style={{ fontWeight: 600, fontSize: 12.5 }}>Average ROI</span>
            </div>
            <div className="dim" style={{ fontSize: 12 }}>Revenue per $1 across the full training window.</div>
          </div>
          <div>
            <div className="row-h" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ width: 18, height: 5, background: 'var(--sky)', borderRadius: 1 }} />
              <span style={{ fontWeight: 600, fontSize: 12.5 }}>Marginal ROI</span>
            </div>
            <div className="dim" style={{ fontSize: 12 }}>Revenue from the <em>next</em> $1 — usually lower because of diminishing returns.</div>
          </div>
          <div>
            <div className="row-h" style={{ gap: 8, marginBottom: 4 }}>
              <span style={{ width: 18, height: 1, background: 'var(--text)' }} />
              <span style={{ fontWeight: 600, fontSize: 12.5 }}>Error bar</span>
            </div>
            <div className="dim" style={{ fontSize: 12 }}>90% credible interval on Marginal ROI. Wider = less confident.</div>
          </div>
        </div>
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 3) Response curves — Hill saturation curves, grid of small multiples + detail

const hillCurve = (alpha, gamma, x) => Math.pow(x, alpha) / (Math.pow(x, alpha) + Math.pow(gamma, alpha));

const CURVE_PARAMS = {
  search: { a: 2.4, g: 0.35, sat: 0.78 },
  meta:   { a: 2.0, g: 0.45, sat: 0.62 },
  yt:     { a: 1.8, g: 0.55, sat: 0.48 },
  tv:     { a: 1.4, g: 0.65, sat: 0.40 },
  tiktok: { a: 1.6, g: 0.50, sat: 0.35 },
  ooh:    { a: 1.5, g: 0.60, sat: 0.55 },
  radio:  { a: 1.4, g: 0.55, sat: 0.50 },
  print:  { a: 1.2, g: 0.70, sat: 0.30 },
};

const makeCurvePath = (id, w, h, samples = 60) => {
  const p = CURVE_PARAMS[id];
  let s = '';
  for (let i = 0; i <= samples; i++) {
    const x = i / samples;
    const y = hillCurve(p.a, p.g, x);
    s += (i === 0 ? 'M ' : 'L ') + (x * w).toFixed(2) + ' ' + ((1 - y) * h).toFixed(2) + ' ';
  }
  return s;
};

const SmallCurve = ({ id, selected, onClick }) => {
  const ch = CHAN_BY_ID[id];
  const W = 160, H = 100;
  const p = CURVE_PARAMS[id];
  const pad = { t: 8, r: 8, b: 18, l: 8 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const path = makeCurvePath(id, iw, ih);
  const opX = p.sat;
  const opY = 1 - hillCurve(p.a, p.g, p.sat);
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? 'rgba(125,155,255,0.08)' : 'var(--panel3)',
        border: '1px solid ' + (selected ? 'var(--line2)' : 'var(--line)'),
        borderRadius: 8,
        cursor: 'pointer',
        padding: '8px 10px',
      }}>
      <div className="between" style={{ marginBottom: 4 }}>
        <div className="row-h" style={{ gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: ch.color }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>{ch.name}</span>
        </div>
        <span className="mono faint" style={{ fontSize: 10 }}>{Math.round(p.sat * 100)}%</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} fontFamily="var(--f-mono)" fontSize="8" fill="var(--faint)">
        <g transform={`translate(${pad.l} ${pad.t})`}>
          <line x1="0" x2={iw} y1={ih} y2={ih} stroke="var(--line2)" />
          <line x1="0" x2="0" y1="0" y2={ih} stroke="var(--line2)" />
          <line x1={opX * iw} x2={opX * iw} y1={0} y2={ih} stroke="var(--sky)" strokeDasharray="2 2" opacity="0.7" />
          <path d={path} fill="none" stroke={ch.color} strokeWidth="1.6" />
          <circle cx={opX * iw} cy={opY * ih} r="2.5" fill="var(--sky)" />
        </g>
        <text x={pad.l} y={H - 4}>spend →</text>
        <text x={W - pad.r} y={H - 4} textAnchor="end" fill="var(--sky)">op.</text>
      </svg>
    </div>
  );
};

const DetailCurve = ({ id }) => {
  const ch = CHAN_BY_ID[id];
  const p = CURVE_PARAMS[id];
  const W = 540, H = 280;
  const pad = { t: 16, r: 22, b: 30, l: 50 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const path = makeCurvePath(id, iw, ih, 80);
  // confidence band
  const lo = makeCurvePath(id, iw, ih, 80); // approximate: same curve offset
  // Build a smooth band by varying gamma slightly
  const bandLo = (() => {
    let s = '';
    for (let i = 0; i <= 80; i++) {
      const x = i / 80;
      const y = hillCurve(p.a, p.g * 1.18, x);
      s += (i === 0 ? 'M ' : 'L ') + (x * iw) + ' ' + ((1 - y) * ih) + ' ';
    }
    return s;
  })();
  const bandHi = (() => {
    let s = '';
    for (let i = 80; i >= 0; i--) {
      const x = i / 80;
      const y = hillCurve(p.a, p.g * 0.85, x);
      s += (i === 80 ? 'L ' : 'L ') + (x * iw) + ' ' + ((1 - y) * ih) + ' ';
    }
    return s;
  })();
  const opX = p.sat;
  const opY = 1 - hillCurve(p.a, p.g, p.sat);

  return (
    <div>
      <div className="between" style={{ marginBottom: 8 }}>
        <div className="row-h" style={{ gap: 10 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: ch.color }} />
          <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>{ch.name} · response curve</div>
        </div>
        <div className="row-h" style={{ gap: 6 }}>
          <Tag kind="sky">half-saturation γ = {p.g.toFixed(2)}</Tag>
          <Tag>shape α = {p.a.toFixed(1)}</Tag>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }} fontFamily="var(--f-mono)" fontSize="9.5" fill="var(--faint)">
        {/* y grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={pad.t + (1 - t) * ih} y2={pad.t + (1 - t) * ih} stroke="var(--line)" strokeDasharray="2 3" />
            <text x={pad.l - 8} y={pad.t + (1 - t) * ih + 3} textAnchor="end">{Math.round(t * 100)}%</text>
          </g>
        ))}
        {/* axes */}
        <line x1={pad.l} x2={W - pad.r} y1={pad.t + ih} y2={pad.t + ih} stroke="var(--line2)" />
        <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + ih} stroke="var(--line2)" />

        <g transform={`translate(${pad.l} ${pad.t})`}>
          {/* confidence band */}
          <path d={bandLo + ' ' + bandHi + ' Z'} fill={ch.color} opacity="0.12" />
          {/* main curve */}
          <path d={path} fill="none" stroke={ch.color} strokeWidth="2" />
          {/* operating point */}
          <line x1={opX * iw} x2={opX * iw} y1={0} y2={ih} stroke="var(--sky)" strokeDasharray="3 3" opacity="0.7" />
          <line x1={0} x2={opX * iw} y1={opY * ih} y2={opY * ih} stroke="var(--sky)" strokeDasharray="3 3" opacity="0.7" />
          <circle cx={opX * iw} cy={opY * ih} r="4" fill="var(--sky)" />
        </g>

        <text x={pad.l} y={H - 8}>weekly spend (SGD) →</text>
        <text x={W - pad.r} y={H - 8} textAnchor="end" fill="var(--sky)">current operating point: {Math.round(p.sat * 100)}% of saturation</text>
      </svg>
      <div className="grid g3" style={{ marginTop: 12 }}>
        <Field label="Current weekly spend" mono>SGD 24,500</Field>
        <Field label="% of saturation" mono>{Math.round(p.sat * 100)}%</Field>
        <Field label="Headroom to 80%" mono>+SGD {Math.round((0.8 - p.sat) * 30000).toLocaleString()}</Field>
      </div>
    </div>
  );
};

const ResponseView = () => {
  const [sel, setSel] = React.useState('meta');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
      <Card>
        <CardHead title="Channel detail" sub="Click any small chart to focus" icon={<I.Chart size={14} />} />
        <div className="card-pad">
          <DetailCurve id={sel} />
        </div>
      </Card>
      <div>
        <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em', marginBottom: 8 }}>ALL CHANNELS · SATURATION</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {MEDIA_CHANS.map(id => (
            <SmallCurve key={id} id={id} selected={sel === id} onClick={() => setSel(id)} />
          ))}
        </div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.5 }}>
          Each curve plots channel response (revenue contribution) against weekly spend. The blue
          dot marks the current operating point — channels above ~80% are saturated.
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// 4) Budget Optimiser — current vs recommended allocation

const OPT_DATA = [
  { id: 'search', cur: 22, rec: 19, mRoi: 1.9 },
  { id: 'meta',   cur: 14, rec: 21, mRoi: 1.7 },
  { id: 'yt',     cur:  8, rec: 12, mRoi: 2.4 },
  { id: 'tv',     cur: 24, rec: 27, mRoi: 1.1 },
  { id: 'tiktok', cur:  6, rec: 11, mRoi: 2.6 },
  { id: 'ooh',    cur:  9, rec:  5, mRoi: 0.8 },
  { id: 'radio',  cur:  7, rec:  3, mRoi: 0.7 },
  { id: 'print',  cur: 10, rec:  2, mRoi: 0.4 },
];

const StackedBar = ({ data, field, label }) => {
  const total = data.reduce((s, d) => s + d[field], 0);
  return (
    <div>
      <div className="between" style={{ marginBottom: 6 }}>
        <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em' }}>{label}</div>
        <div className="mono" style={{ fontSize: 11.5 }}>SGD 1.85m / 6 wks</div>
      </div>
      <div style={{ display: 'flex', height: 36, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {data.map(d => {
          const ch = CHAN_BY_ID[d.id];
          return (
            <div key={d.id} style={{ width: `${(d[field] / total) * 100}%`, background: ch.color, opacity: 0.82, display: 'grid', placeItems: 'center', color: '#0a0f1d', fontFamily: 'var(--f-mono)', fontSize: 10, fontWeight: 600 }}>
              {d[field] >= 6 ? `${d[field]}%` : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const OptimiserView = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <CardHead
          title="Allocation — current vs. recommended"
          sub="Flat 6-week budget; objective: maximise revenue at constant spend"
          icon={<I.Chart size={14} />}
        />
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <StackedBar data={OPT_DATA} field="cur" label="CURRENT ALLOCATION" />
          <StackedBar data={OPT_DATA} field="rec" label="RECOMMENDED ALLOCATION" />
          <Legend items={OPT_DATA.map(d => ({ ...CHAN_BY_ID[d.id] }))} />
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card>
          <CardHead title="Per-channel shift" sub="Sorted by absolute change · 90% credible interval on revenue impact" />
          <table className="tbl">
            <thead>
              <tr>
                <th>Channel</th>
                <th style={{ width: '11%' }}>Current</th>
                <th style={{ width: '11%' }}>Recommended</th>
                <th style={{ width: '24%' }}>Move</th>
                <th style={{ width: '11%' }}>Δ</th>
                <th style={{ width: '13%' }}>Marg. ROI</th>
              </tr>
            </thead>
            <tbody>
              {[...OPT_DATA].sort((a, b) => Math.abs(b.rec - b.cur) - Math.abs(a.rec - a.cur)).map(d => {
                const delta = d.rec - d.cur;
                const ch = CHAN_BY_ID[d.id];
                const maxAbs = 10;
                const w = Math.min(1, Math.abs(delta) / maxAbs);
                const isUp = delta > 0;
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="row-h" style={{ gap: 8 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: ch.color }} />
                        <span style={{ fontWeight: 600 }}>{ch.name}</span>
                      </div>
                    </td>
                    <td className="mono">{d.cur}%</td>
                    <td className="mono">{d.rec}%</td>
                    <td>
                      <div style={{ position: 'relative', height: 6, background: 'var(--panel3)', borderRadius: 999, border: '1px solid var(--line)' }}>
                        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1, background: 'var(--line2)' }} />
                        <div style={{
                          position: 'absolute', top: -1, bottom: -1,
                          left: isUp ? '50%' : `${50 - w * 50}%`,
                          width: `${w * 50}%`,
                          background: isUp ? 'var(--mint)' : 'var(--amber)',
                          borderRadius: 999, opacity: 0.85,
                        }} />
                      </div>
                    </td>
                    <td className="mono" style={{ color: isUp ? 'var(--mint)' : 'var(--amber)' }}>
                      {isUp ? '+' : ''}{delta}%
                    </td>
                    <td className="mono">{d.mRoi.toFixed(1)}x</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="tile">
            <div className="lbl">Projected lift</div>
            <div className="v mono" style={{ color: 'var(--mint)' }}>+4.2<span className="unit">% rev</span></div>
            <div className="dim" style={{ fontSize: 12 }}>90% CI: +1.9% … +6.6%</div>
          </div>
          <div className="tile">
            <div className="lbl">Budget envelope</div>
            <div className="v mono">SGD 1.85m</div>
            <div className="dim" style={{ fontSize: 12 }}>6 weeks · flat to current</div>
          </div>
          <div className="tile">
            <div className="lbl">Biggest moves</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.7, marginTop: 4 }}>
              <div className="row-h" style={{ gap: 6 }}><span style={{ color: 'var(--mint)' }}>↑</span> Meta <span className="mono faint">+7%</span></div>
              <div className="row-h" style={{ gap: 6 }}><span style={{ color: 'var(--amber)' }}>↓</span> Print <span className="mono faint">−8%</span></div>
              <div className="row-h" style={{ gap: 6 }}><span style={{ color: 'var(--amber)' }}>↓</span> Radio <span className="mono faint">−4%</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Container — replaces the placeholder Results

const Results = () => {
  const [tab, setTab] = React.useState('contribution');
  const tabs = [
    { id: 'contribution', label: 'Channel contribution' },
    { id: 'roi',          label: 'ROI & marginal ROI' },
    { id: 'response',     label: 'Response curves' },
    { id: 'optimiser',    label: 'Budget optimiser' },
  ];
  const active = tabs.find(t => t.id === tab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      <Card>
        <CardHead
          title={active.label}
          sub="Read from the latest posterior · v3 · gs://trifecta-aeon-prod/posteriors/v3-2026-05-12.nc"
          icon={<I.Chart size={14} />}
          actions={
            <>
              <Btn small kind="ghost">Window: last 26 wks</Btn>
              <Btn small kind="primary" leftIcon={<I.ArrowRight size={12} />}>Export report</Btn>
            </>
          }
        />
        <div className="card-pad">
          {tab === 'contribution' && <ContributionView />}
          {tab === 'roi'          && <ROIView />}
          {tab === 'response'     && <ResponseView />}
          {tab === 'optimiser'    && <OptimiserView />}
          <div className="row-h" style={{ marginTop: 14, gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 14 }}>
            <Tag kind="sky">90% credible interval</Tag>
            <Tag>posterior · v3</Tag>
            <Tag>geo · National + 5 regions</Tag>
            <Tag>122 wks · weekly</Tag>
            <span className="dim mono" style={{ fontSize: 11, marginLeft: 'auto' }}>Every figure carries a 90% credible interval.</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

window.Results = Results;
