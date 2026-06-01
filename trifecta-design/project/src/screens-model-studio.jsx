// Model Studio — the core screen, 5 internal tabs

const STRENGTH_BY_LABEL = { 'Strong': 0.85, 'Medium': 0.55, 'Weak': 0.3 };

const StudioVersionBar = () => (
  <div className="card" style={{ marginBottom: 18, padding: '14px 18px' }}>
    <div className="between">
      <div className="row-h" style={{ gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)' }}>
          <I.Sliders size={18} />
        </div>
        <div>
          <div className="row-h" style={{ gap: 10 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 18 }}>Aeon MMM — v3</div>
            <StatusTag status="Live" />
          </div>
          <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>Bayesian MMM · Google Meridian · trained 12 May 2026</div>
        </div>
      </div>
      <div className="row-h" style={{ gap: 8 }}>
        <Btn kind="ghost" leftIcon={<I.Plus size={13} />}>New version</Btn>
        <Btn kind="ghost" leftIcon={<I.Layers size={13} />}>Save as template</Btn>
        <Btn kind="primary" leftIcon={<I.Play size={11} />}>Start training run</Btn>
      </div>
    </div>
  </div>
);

const ChannelsAndPriors = () => {
  const d = TRIFECTA_DATA;
  const [selected, setSelected] = React.useState('meta');
  const [chans, setChans] = React.useState(d.channels);

  const sel = chans.find(c => c.id === selected) || chans[0];

  const toggle = (id) => setChans(prev => prev.map(c => c.id === id ? { ...c, on: !c.on } : c));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Callout icon={<I.Info size={14} />}>
        <strong>Per-brand model weights.</strong> Priors are the model’s starting beliefs about
        each channel; strength controls how much the brand’s own data can move them. Every client
        runs a different configuration — tuned from category benchmarks, prior model versions,
        and that brand’s own incrementality tests.
      </Callout>

      <Card>
        <CardHead
          title="Channels &amp; priors"
          sub="9 channels · 8 included · 1 excluded"
          icon={<I.Sliders size={14} />}
          actions={<Btn small kind="ghost" leftIcon={<I.Plus size={12} />}>Add channel</Btn>}
        />
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Channel</th>
              <th style={{ width: '8%' }}>Include</th>
              <th style={{ width: '14%' }}>ROI prior (μ)</th>
              <th style={{ width: '14%' }}>Strength</th>
              <th style={{ width: '14%' }}>Adstock</th>
              <th>Prior source</th>
            </tr>
          </thead>
          <tbody>
            {chans.map(c => (
              <tr key={c.id}
                  className={(c.on ? '' : 'dim ') + 'selectable ' + (c.id === selected ? 'selected' : '')}
                  onClick={() => setSelected(c.id)}>
                <td>
                  <div className="row-h" style={{ gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: c.medium === 'Digital' ? 'var(--sky)' : 'var(--amber)' }} />
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <Tag>{c.medium}</Tag>
                  </div>
                </td>
                <td onClick={e => { e.stopPropagation(); toggle(c.id); }}>
                  <Toggle on={c.on} />
                </td>
                <td className="mono">{c.roi.toFixed(1)}x</td>
                <td>
                  <div className="row-h" style={{ gap: 8 }}>
                    <div style={{ flex: 1, height: 4, background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: (c.strengthN * 100) + '%', height: '100%', background: 'var(--sky)' }} />
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>{c.strength}</div>
                  </div>
                </td>
                <td className="mono">{c.adstock.toFixed(2)}</td>
                <td className="dim" style={{ fontSize: 12.5 }}>{c.priorSource}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Channel detail panel */}
      <Card>
        <CardHead
          title={`Channel detail — ${sel.name}`}
          sub={`Prior source: ${sel.priorSource}`}
          icon={<I.Sliders size={14} />}
          actions={
            <>
              <Btn small kind="ghost">Reset to template</Btn>
              <Btn small kind="mint" leftIcon={<I.Check size={12} />}>Apply experiment result</Btn>
            </>
          }
        />
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>ROI PRIOR (μ)</div>
              <div className="dim" style={{ fontSize: 11.5, marginBottom: 8 }}>The model’s starting belief about revenue per $1 spent on this channel.</div>
              <Slider value={sel.roi} min={0} max={5} fmt={v => `${v.toFixed(2)}x`} />
            </div>
            <div>
              <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>PRIOR STRENGTH (σ)</div>
              <div className="dim" style={{ fontSize: 11.5, marginBottom: 8 }}>How hard the brand’s own data can override this belief.</div>
              <Slider value={sel.strengthN} min={0} max={1} fmt={v => `${sel.strength} · σ ${(1 - v).toFixed(2)}`} />
            </div>
            <div>
              <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>ADSTOCK / CARRY-OVER DECAY</div>
              <div className="dim" style={{ fontSize: 11.5, marginBottom: 8 }}>How long this channel’s effect lingers after spend.</div>
              <Slider value={sel.adstock} min={0} max={1} fmt={v => v.toFixed(2)} />
            </div>
            <div className="row-h" style={{ gap: 8, paddingTop: 8 }}>
              <Tag kind="sky">media type · {sel.medium.toLowerCase()}</Tag>
              {sel.priorSource.toLowerCase().includes('geo') || sel.priorSource.toLowerCase().includes('calibrated')
                ? <Tag kind="mint">calibrated</Tag>
                : <Tag>uncalibrated</Tag>}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Skel label="ROI prior distribution" height={160} />
            <Skel label="saturation (Hill) curve" height={160} />
          </div>
        </div>
      </Card>
    </div>
  );
};

const ControlVariables = () => {
  const d = TRIFECTA_DATA;
  const [ctrls, setCtrls] = React.useState(d.controls);
  const toggle = (id) => setCtrls(prev => prev.map(c => c.id === id ? { ...c, on: !c.on } : c));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Callout icon={<I.Info size={14} />}>
        Without controls, media takes credit for things it didn’t cause. Toggle each one on or off
        for this brand; the model is re-built when training next runs.
      </Callout>
      <Card>
        <CardHead title="Control variables" sub={`${ctrls.filter(c=>c.on).length} of ${ctrls.length} active`} icon={<I.Sliders size={14} />} />
        {ctrls.map((c, i) => (
          <div key={c.id} style={{ padding: '14px 18px', borderTop: '1px solid var(--line)', display: 'grid', gridTemplateColumns: '36px 1fr auto', alignItems: 'center', gap: 14 }}>
            <Toggle on={c.on} onClick={() => toggle(c.id)} />
            <div style={c.on ? {} : { opacity: 0.5 }}>
              <div style={{ fontWeight: 600 }}>{c.name}</div>
              <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{c.desc}</div>
            </div>
            <Tag kind={c.on ? 'mint' : 'default'}>{c.on ? 'included' : 'excluded'}</Tag>
          </div>
        ))}
      </Card>
    </div>
  );
};

const Calibration = () => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Callout icon={<I.Check size={14} />}>
        <strong>Geo-holdout test results are injected as priors</strong> so the model is anchored
        to measured causal lift — not just observational correlation.
      </Callout>
      <Card>
        <CardHead title="Calibration experiments" sub="Linked geo-holdout incrementality tests" icon={<I.Check size={14} />}
          actions={<Btn small kind="primary" leftIcon={<I.Plus size={12} />}>Add calibration</Btn>} />
        {d.calibrations.map((c, i) => (
          <div key={i} style={{ padding: '14px 18px', borderTop: '1px solid var(--line)' }}>
            <div className="between">
              <div>
                <div style={{ fontWeight: 600 }}>{c.name}</div>
                <div className="dim mono" style={{ fontSize: 11.5, marginTop: 2 }}>{c.period} → applied to {c.appliesTo}</div>
              </div>
              <div className="row-h" style={{ gap: 8 }}>
                <StatusTag status={c.status} />
                <Btn small kind="ghost">Open</Btn>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};

const ModelSettings = () => {
  const d = TRIFECTA_DATA;
  return (
    <Card>
      <CardHead title="Model settings" sub="The structural choices that frame the whole MMM" icon={<I.Cog size={14} />} />
      <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 14 }}>
        {d.modelSettings.map(m => (
          <Field key={m.label} label={m.label} mono>
            {m.value}
          </Field>
        ))}
      </div>
    </Card>
  );
};

const Versions = () => {
  const d = TRIFECTA_DATA;
  return (
    <Card>
      <CardHead title="Model versions" sub="Each version is a saved configuration; diagnostics from its last training run" icon={<I.Layers size={14} />} />
      <table className="tbl">
        <thead>
          <tr>
            <th>Version</th>
            <th>Status</th>
            <th>Trained</th>
            <th>Diagnostics</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {d.versions.map(v => (
            <tr key={v.id}>
              <td>
                <div className="row-h" style={{ gap: 10 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{v.id}</span>
                </div>
              </td>
              <td><StatusTag status={v.tag === 'Live' ? 'Live' : 'Archived'} /></td>
              <td className="mono dim" style={{ fontSize: 12 }}>{v.date}</td>
              <td className="dim" style={{ fontSize: 12.5 }}>{v.note}</td>
              <td>
                <Btn small kind="ghost" leftIcon={<I.Compare size={12} />}>Compare</Btn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
};

const ModelStudio = () => {
  const [tab, setTab] = React.useState('channels');
  const tabs = [
    { id: 'channels',    label: 'Channels & Priors' },
    { id: 'controls',    label: 'Control Variables' },
    { id: 'calibration', label: 'Calibration' },
    { id: 'settings',    label: 'Model Settings' },
    { id: 'versions',    label: 'Versions' },
  ];
  return (
    <div>
      <StudioVersionBar />
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>
      {tab === 'channels'    && <ChannelsAndPriors />}
      {tab === 'controls'    && <ControlVariables />}
      {tab === 'calibration' && <Calibration />}
      {tab === 'settings'    && <ModelSettings />}
      {tab === 'versions'    && <Versions />}
    </div>
  );
};

window.ModelStudio = ModelStudio;
