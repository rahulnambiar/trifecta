// Training Runs, Results, Signal, Client Settings

const TrainingRuns = () => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card>
        <CardHead title="Next training run" sub="Configure, then kick off the next Meridian run on Vertex AI" icon={<I.Play size={12} />} />
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Model version" mono value="Aeon MMM · v3" />
            <Field label="Data window" mono value="Jan 2024 – Apr 2026 · 122 wks" />
            <Field label="Compute target" mono value="Meridian · Vertex AI · GPU (a2-highgpu-1g)" />
            <Field label="Sampler" mono value="NUTS · 4 chains · 2,000 draws" />
            <Field label="Holdout" mono value="Last 8 weeks" />
            <Field label="Output destination" mono value="gs://trifecta-aeon-prod/posteriors/" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Btn kind="primary" leftIcon={<I.Play size={12} />} style={{ justifyContent: 'center' }}>Start training run</Btn>
            <Btn kind="ghost">Dry-run validation</Btn>
            <div className="dim" style={{ fontSize: 11.5, marginTop: 4 }}>
              <span className="row-h" style={{ gap: 6, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--sky)' }}><I.Info size={12} /></span>
                <span>Training runs on GPU as a batch job. The posterior artifact is saved to GCS and becomes the source for Results and Signal.</span>
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Run history" sub={`${d.runs.length} runs · last 90 days`} icon={<I.Cpu size={14} />} />
        <table className="tbl">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Version</th>
              <th>Started</th>
              <th>Duration</th>
              <th>Status</th>
              <th>R̂</th>
              <th>Holdout MAPE</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {d.runs.map(r => (
              <tr key={r.id}>
                <td className="mono" style={{ fontWeight: 600 }}>{r.id}</td>
                <td className="mono">{r.v}</td>
                <td className="mono dim" style={{ fontSize: 12 }}>{r.started}</td>
                <td className="mono">{r.dur}</td>
                <td><StatusTag status={r.status} /></td>
                <td className="mono">{r.rhat}</td>
                <td className="mono">{r.mape}</td>
                <td><Btn small kind="ghost">Open</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// (Results lives in screens-results.jsx — keeps this file slim.)

const Signal = () => {
  const d = TRIFECTA_DATA;
  const [tools, setTools] = React.useState(d.signalTools);
  const [preview, setPreview] = React.useState(false);
  const toggle = (i) => setTools(prev => prev.map((t, j) => j === i ? { ...t, on: !t.on } : t));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Callout icon={<I.Signal size={14} />}>
        <strong>Signal</strong> is the client-facing conversational decision layer — a chat
        interface built as an MCP server over the trained model. Choose which tools are exposed
        to this client.
      </Callout>

      <Card>
        <CardHead
          title="Exposed tools"
          sub={`${tools.filter(t => t.on).length} of ${tools.length} enabled for Aeon Skincare`}
          icon={<I.Signal size={14} />}
          actions={<Btn small kind="ghost" leftIcon={<I.ArrowRight size={12} />} onClick={() => setPreview(true)}>Preview Signal</Btn>}
        />
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          {tools.map((t, i) => (
            <div key={t.name} style={{ padding: 14, border: '1px solid var(--line)', borderRadius: 8, background: 'var(--panel3)' }}>
              <div className="between">
                <div style={{ flex: 1, paddingRight: 12 }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{t.desc}</div>
                </div>
                <Toggle on={t.on} onClick={() => toggle(i)} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="Client access" sub="People at Aeon Skincare with Signal access"
          icon={<I.Users size={14} />}
          actions={<Btn small kind="primary" leftIcon={<I.Plus size={12} />}>Invite</Btn>} />
        {d.clientAccess.map((u, i) => (
          <div key={u.email} style={{ padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
            <div className="between">
              <div className="row-h" style={{ gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)', fontSize: 11 }} className="mono">
                  {u.email[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.email}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{u.role}</div>
                </div>
              </div>
              <div className="row-h" style={{ gap: 8 }}>
                <Tag kind={u.access === 'Editor' ? 'sky' : 'default'}>{u.access}</Tag>
                <Btn small kind="ghost">Manage</Btn>
              </div>
            </div>
          </div>
        ))}
      </Card>

      {preview ? <SignalPreview tools={tools} onClose={() => setPreview(false)} /> : null}
    </div>
  );
};

// -----------------------------------------------------------------------------

const ClientSettings = () => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Card>
        <CardHead title="Engagement" sub="Commercial &amp; data-residency configuration for Aeon Skincare" icon={<I.Tag size={14} />} />
        <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          <Field label="Client legal name" mono>Aeon Skincare Pte. Ltd.</Field>
          <Field label="Engagement value" mono>USD 54,000 / year</Field>
          <Field label="Model refresh cadence" mono>Monthly</Field>
          <Field label="Contract term" mono>12 months · renews Feb 2027</Field>
          <Field label="Data residency" mono>Singapore (asia-southeast1)</Field>
          <Field label="GCP project" mono>trifecta-aeon-prod</Field>
        </div>
      </Card>

      <Card>
        <CardHead title="Client users" sub="Roles: Editor (can change scenarios) · Viewer (read-only)"
          icon={<I.Users size={14} />}
          actions={<Btn small kind="primary" leftIcon={<I.Plus size={12} />}>Invite</Btn>} />
        {d.clientAccess.map((u, i) => (
          <div key={u.email} style={{ padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
            <div className="between">
              <div className="row-h" style={{ gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 999, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)', fontSize: 11 }} className="mono">
                  {u.email[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{u.email}</div>
                  <div className="dim" style={{ fontSize: 12 }}>{u.role}</div>
                </div>
              </div>
              <div className="row-h" style={{ gap: 8 }}>
                <Tag kind={u.access === 'Editor' ? 'sky' : 'default'}>{u.access}</Tag>
                <Btn small kind="ghost">Manage</Btn>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
};

window.TrainingRuns = TrainingRuns;
window.SignalScreen = Signal;
window.ClientSettings = ClientSettings;
