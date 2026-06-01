// Dashboard (Portfolio) and Model Library

const STEP_DEFS = [
  { id: 'data',    label: 'Data' },
  { id: 'config',  label: 'Config' },
  { id: 'train',   label: 'Train' },
  { id: 'results', label: 'Results' },
  { id: 'signal',  label: 'Signal' },
];

const LifecycleDots = ({ steps }) => {
  return (
    <div className="lc-row">
      {STEP_DEFS.map((s, i) => {
        const status = steps[s.id] || 'pending';
        const next = STEP_DEFS[i + 1];
        const connDone = status === 'done';
        let glyph = i + 1;
        if (status === 'done') glyph = <I.Check size={11} />;
        else if (status === 'attention') glyph = '!';
        return (
          <React.Fragment key={s.id}>
            <div className="lc-step">
              <div className={'lc-dot ' + status}>{glyph}</div>
              <div className="lc-label">{s.label}</div>
            </div>
            {next ? <div className={'lc-conn' + (connDone ? ' done' : '')} /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
};

const Dashboard = ({ go, enterClient, openAddClient, clients }) => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Stat tiles */}
      <div className="grid g4">
        <div className="tile">
          <div className="lbl">Active clients</div>
          <div className="v mono">{clients.length}</div>
          <div className="dim" style={{ fontSize: 12 }}>{clients.filter(c => c.state === 'live').length} live · {clients.filter(c => c.state === 'draft').length} onboarding</div>
        </div>
        <div className="tile">
          <div className="lbl">Models live</div>
          <div className="v mono">{clients.filter(c => c.state === 'live').length}</div>
          <div className="dim" style={{ fontSize: 12 }}>Aeon v3 · Northwind v5 · Vega v4</div>
        </div>
        <div className="tile">
          <div className="lbl">Open actions</div>
          <div className="v mono" style={{ color: 'var(--amber)' }}>{clients.reduce((s, c) => s + c.actions, 0)}</div>
          <div className="dim" style={{ fontSize: 12 }}>across {clients.filter(c => c.actions).length} clients</div>
        </div>
        <div className="tile">
          <div className="lbl">Next training run</div>
          <div className="v mono">28<span className="unit">May</span></div>
          <div className="dim" style={{ fontSize: 12 }}>Vega Mobility · v4 refresh</div>
        </div>
      </div>

      {/* Portfolio */}
      <div>
        <SectionHead
          title="Client portfolio"
          sub="Click a card to enter that client."
          actions={<Btn kind="primary" leftIcon={<I.Plus size={13} />} onClick={openAddClient}>Add client</Btn>}
        />
        <div className="grid g2">
          {clients.map(c => (
            <div
              key={c.id}
              className="card"
              style={{ padding: 18, cursor: 'pointer', transition: 'border-color 0.15s' }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--line2)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--line)'}
              onClick={() => enterClient(c.id)}
            >
              <div className="between">
                <div className="row-h" style={{ gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center' }}>
                    <span className="mono" style={{ fontSize: 13, color: 'var(--sky)' }}>{c.name[0]}</span>
                  </div>
                  <div>
                    <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                    <div className="dim mono" style={{ fontSize: 11 }}>{c.version} · {c.state} · {c.run}</div>
                  </div>
                </div>
                <StatusTag status={c.status} />
              </div>

              {/* Lifecycle dots */}
              <div style={{ marginTop: 16, padding: '10px 4px 4px', borderTop: '1px dashed var(--line)' }}>
                <LifecycleDots steps={c.steps} />
              </div>

              {/* Readiness */}
              <div style={{ marginTop: 14 }}>
                <div className="between" style={{ marginBottom: 6 }}>
                  <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em' }}>MODEL READINESS</div>
                  <div className="mono" style={{ fontSize: 12 }}>{c.readiness}%</div>
                </div>
                <Progress value={c.readiness} />
              </div>

              <div className="between" style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12.5, color: c.actions ? 'var(--amber)' : 'var(--faint)' }}>
                  {c.actions ? (
                    <span className="row-h" style={{ gap: 6 }}>
                      <I.AlertTri size={13} /> {c.actions} action{c.actions > 1 ? 's' : ''} pending
                    </span>
                  ) : (
                    <span className="row-h" style={{ gap: 6 }}>
                      <I.Check size={13} /> No actions pending
                    </span>
                  )}
                </div>
                <span className="row-h faint" style={{ gap: 6, fontSize: 12 }}>
                  Enter client <I.ArrowRight size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------

const ModelLibrary = ({ go }) => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Callout icon={<I.Layers size={14} />}>
        <strong>Reusable model archetypes.</strong> Channel sets, priors and adstock defaults.
        Clone one to start a new client model, then tune it per brand in Model Studio.
      </Callout>

      <div className="grid g2">
        {d.modelLibrary.map(t => (
          <Card key={t.id}>
            <div className="card-pad">
              <div className="between" style={{ marginBottom: 12 }}>
                <div>
                  <div className="display" style={{ fontWeight: 700, fontSize: 17 }}>{t.name}</div>
                  <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{t.desc}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)' }}>
                  <I.Layers size={16} />
                </div>
              </div>

              <div className="grid g2" style={{ gap: 10, marginBottom: 14 }}>
                <div className="tile" style={{ padding: '10px 12px' }}>
                  <div className="lbl">Channels</div>
                  <div className="mono" style={{ fontSize: 18, fontFamily: 'var(--f-display)', fontWeight: 700 }}>{t.channels}</div>
                </div>
                <div className="tile" style={{ padding: '10px 12px' }}>
                  <div className="lbl">Used by</div>
                  <div className="mono" style={{ fontSize: 18, fontFamily: 'var(--f-display)', fontWeight: 700 }}>{t.clients} <span style={{ fontSize: 12, color: 'var(--dim)' }}>client{t.clients>1?'s':''}</span></div>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {t.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
              </div>

              <Btn kind="primary" leftIcon={<I.ArrowRight size={13} />} onClick={() => go('model-studio')}>
                Use template
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

window.Dashboard = Dashboard;
window.ModelLibrary = ModelLibrary;
