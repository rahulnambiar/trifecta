// Signal Preview — client-facing chat-with-the-MMM modal mockup.

const SP_COLORS = {
  base:   '#3a4663',
  search: '#37d39b',
  meta:   '#4f6ef2',
  yt:     '#7d9bff',
  tv:     '#e6b052',
  tiktok: '#c773d6',
  ooh:    '#b07e3d',
  radio:  '#c98568',
  print:  '#7e6a5a',
};

// --- Inline mini-result widgets that appear inside chat bubbles ----------

const MiniContributionBar = () => {
  const data = [
    { id: 'base',   pct: 46, label: 'Base / organic' },
    { id: 'search', pct: 13, label: 'Paid Search' },
    { id: 'meta',   pct: 10, label: 'Meta' },
    { id: 'tv',     pct:  9, label: 'TV' },
    { id: 'yt',     pct:  7, label: 'YouTube' },
    { id: 'ooh',    pct:  5, label: 'Out-of-Home' },
    { id: 'tiktok', pct:  4, label: 'TikTok' },
    { id: 'radio',  pct:  3, label: 'Radio' },
    { id: 'print',  pct:  3, label: 'Print' },
  ];
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', height: 22, borderRadius: 5, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {data.map(d => (
          <div key={d.id} style={{ width: `${d.pct}%`, background: SP_COLORS[d.id], opacity: 0.85 }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {data.slice(0, 5).map(d => (
          <div key={d.id} className="row-h" style={{ gap: 6, fontSize: 11, whiteSpace: 'nowrap' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: SP_COLORS[d.id] }} />
            <span>{d.label}</span>
            <span className="mono faint">{d.pct}%</span>
          </div>
        ))}
        <div className="mono faint" style={{ fontSize: 11 }}>+ 4 more</div>
      </div>
    </div>
  );
};

const MiniROIRow = ({ name, roi, mroi, color }) => (
  <div style={{ padding: '8px 0', borderTop: '1px solid var(--line)' }}>
    <div className="between" style={{ marginBottom: 4 }}>
      <div className="row-h" style={{ gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{name}</span>
      </div>
      <span className="mono" style={{ fontSize: 11.5 }}>{roi.toFixed(1)}x · marg {mroi.toFixed(1)}x</span>
    </div>
    <div style={{ height: 4, background: 'var(--panel3)', borderRadius: 999, position: 'relative' }}>
      <div style={{ position: 'absolute', height: '100%', width: `${(roi / 4) * 100}%`, background: color, opacity: 0.45, borderRadius: 999 }} />
      <div style={{ position: 'absolute', height: '100%', width: `${(mroi / 4) * 100}%`, background: color, borderRadius: 999 }} />
    </div>
  </div>
);

const ScenarioResult = () => (
  <div style={{ marginTop: 10, padding: 12, background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 8 }}>
    <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em', marginBottom: 8 }}>SCENARIO · MOVE SGD 50,000 FROM PRINT → META</div>
    <div className="row-h" style={{ gap: 18, alignItems: 'flex-end' }}>
      <div>
        <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>PROJECTED REVENUE</div>
        <div className="display" style={{ fontWeight: 700, fontSize: 22, color: 'var(--mint)' }}>+SGD 84,000</div>
      </div>
      <div>
        <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>90% CI</div>
        <div className="mono" style={{ fontSize: 13 }}>+SGD 41k … +SGD 138k</div>
      </div>
      <div>
        <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>CONFIDENCE</div>
        <div className="row-h" style={{ gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--mint)' }} />
          <span style={{ fontSize: 12.5 }}>High</span>
        </div>
      </div>
    </div>
    <div className="dim" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
      Print is at the flat tail of its saturation curve; Meta still has headroom. Most of the
      lift comes from Meta's marginal ROI of <span className="mono">1.7x</span> vs Print's
      <span className="mono"> 0.4x</span>.
    </div>
  </div>
);

const ToolBadge = ({ name }) => (
  <div className="row-h" style={{ gap: 6, padding: '3px 8px', background: 'rgba(79,110,242,0.08)', border: '1px solid rgba(79,110,242,0.25)', borderRadius: 999, fontSize: 10.5, color: 'var(--sky)', fontFamily: 'var(--f-mono)', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
    <I.Plug size={10} /> {name}
  </div>
);

// --- The conversation -----------------------------------------------------

const TRANSCRIPT = [
  {
    role: 'assistant', kind: 'greeting',
    text: "Hi Maya — I'm Signal, connected to Aeon's MMM (v3, trained 12 May). Ask me about contribution, ROI, scenarios or budget. Every figure I give carries a 90% credible interval.",
  },
  {
    role: 'user',
    text: 'What drove revenue last quarter?',
  },
  {
    role: 'assistant',
    tool: 'Channel contribution',
    text: "Over Feb–Apr 2026, ~46% of revenue is base demand. Of the rest, the four largest paid drivers were Paid Search, Meta, TV and YouTube — together accounting for ~40% of revenue.",
    widget: <MiniContributionBar />,
  },
  {
    role: 'user',
    text: 'Which channels have headroom to spend more right now?',
  },
  {
    role: 'assistant',
    tool: 'Marginal ROI',
    text: "Three channels have a marginal ROI above 1.5x with reasonable confidence:",
    widget: (
      <div style={{ marginTop: 8 }}>
        <MiniROIRow name="TikTok"  roi={2.8} mroi={2.6} color={SP_COLORS.tiktok} />
        <MiniROIRow name="YouTube" roi={3.1} mroi={2.4} color={SP_COLORS.yt} />
        <MiniROIRow name="Meta"    roi={2.6} mroi={1.7} color={SP_COLORS.meta} />
        <div className="dim" style={{ fontSize: 11.5, marginTop: 8, lineHeight: 1.5 }}>
          Paid Search is profitable on average but is already past its half-saturation point;
          the next dollar there is only worth ~SGD 1.90.
        </div>
      </div>
    ),
  },
  {
    role: 'user',
    text: 'If I move SGD 50k from Print into Meta for the next 6 weeks, what happens?',
  },
  {
    role: 'assistant',
    tool: 'Budget scenario',
    text: "I expect revenue to lift by ~SGD 84k over the 6 weeks (about a 2.5% increase). The 90% credible interval spans +SGD 41k to +SGD 138k.",
    widget: <ScenarioResult />,
  },
];

// --- The modal shell ------------------------------------------------------

const SignalPreview = ({ tools, onClose }) => {
  const [input, setInput] = React.useState('');
  const enabledTools = tools.filter(t => t.on);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        {/* Header: client brand frame */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--panel)' }}>
          <Logo size={20} />
          <div style={{ flex: 1 }}>
            <div className="row-h" style={{ gap: 8 }}>
              <div className="display" style={{ fontWeight: 700, fontSize: 14, letterSpacing: '-0.005em' }}>Signal · Aeon Skincare</div>
              <Tag kind="mint" dot>LIVE</Tag>
              <Tag kind="sky">PREVIEW</Tag>
            </div>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>
              maya@aeonskincare.com · MMM v3 · last refresh 12 May
            </div>
          </div>
          <button className="theme-toggle" onClick={onClose} title="Close">
            <I.Plus size={14} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>

        {/* Enabled tools strip */}
        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--line)', background: 'var(--panel3)' }}>
          <div className="row-h" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em', marginRight: 4 }}>EXPOSED TOOLS</span>
            {enabledTools.length === 0 ? (
              <span className="dim" style={{ fontSize: 12 }}>No tools enabled — Maya will only see this header.</span>
            ) : enabledTools.map(t => <ToolBadge key={t.name} name={t.name} />)}
          </div>
        </div>

        {/* Transcript */}
        <div style={{ padding: '18px 18px 8px', maxHeight: 460, overflowY: 'auto', background: 'var(--bg)' }}>
          {TRANSCRIPT.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <div style={{
                maxWidth: '88%',
                background: m.role === 'user' ? 'var(--blue)' : 'var(--panel)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                border: m.role === 'user' ? '1px solid var(--blue)' : '1px solid var(--line)',
                borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                padding: '10px 14px',
                fontSize: 13,
                lineHeight: 1.55,
              }}>
                {m.tool ? (
                  <div className="row-h" style={{ gap: 6, marginBottom: 6 }}>
                    <ToolBadge name={m.tool} />
                  </div>
                ) : null}
                <div>{m.text}</div>
                {m.widget}
                {m.role === 'assistant' && m.kind !== 'greeting' ? (
                  <div className="row-h" style={{ gap: 12, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                    <span className="mono faint" style={{ fontSize: 10, letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>POSTERIOR v3 · 90% CI</span>
                    <button style={{ fontSize: 11, color: 'var(--sky)', cursor: 'pointer', background: 'transparent', border: 0, padding: 0, whiteSpace: 'nowrap' }}>Save to decision log →</button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Input (mocked) */}
        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', background: 'var(--panel)' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 999,
            padding: '6px 6px 6px 14px',
          }}>
            <input
              className="input mono"
              style={{ background: 'transparent', border: 0, padding: 0, fontSize: 13, fontFamily: 'var(--f-body)' }}
              placeholder="Ask Signal about contribution, ROI, scenarios…"
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button style={{
              width: 30, height: 30, borderRadius: 999,
              background: input ? 'var(--blue)' : 'var(--panel)',
              color: input ? '#fff' : 'var(--faint)',
              border: '1px solid ' + (input ? 'var(--blue)' : 'var(--line)'),
              display: 'grid', placeItems: 'center', cursor: 'pointer',
            }}>
              <I.ArrowRight size={13} />
            </button>
          </div>
          <div className="dim" style={{ fontSize: 11, marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Preview mode — replies are scripted. Live Signal uses the latest posterior on Vertex AI.</span>
            <span className="mono">⌘↵ to send</span>
          </div>
        </div>
      </div>
    </div>
  );
};

window.SignalPreview = SignalPreview;
