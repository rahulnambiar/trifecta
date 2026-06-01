// Login + System Settings (Team, Auth, Infrastructure, Billing)

const Login = ({ onSignIn }) => {
  return (
    <div className="login-bg">
      <div className="login-card">
        <div className="row-h" style={{ gap: 10, marginBottom: 4 }}>
          <Logo size={26} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, lineHeight: 1 }}>
            <div className="display" style={{ fontWeight: 800, letterSpacing: '0.06em', fontSize: 18, lineHeight: 1 }}>TRIFECTA</div>
            <div className="mono" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--faint)', textTransform: 'uppercase', lineHeight: 1 }}>Part of <b style={{ color: 'var(--text)', fontWeight: 700 }}>Midpoint Global</b></div>
          </div>
        </div>
        <div>
          <div className="display" style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em' }}>Operator Console</div>
          <div className="dim" style={{ fontSize: 13, marginTop: 4 }}>Sign in to continue.</div>
        </div>

        <div className="field">
          <label>Email</label>
          <div className="inset mono">
            <span style={{ color: 'var(--faint)' }}><I.Mail size={13} /></span>
            <span style={{ flex: 1 }}>rajeev@trifecta.sg</span>
          </div>
        </div>
        <div className="field">
          <label>Password</label>
          <div className="inset mono">
            <span style={{ color: 'var(--faint)' }}><I.Lock size={13} /></span>
            <span style={{ flex: 1, letterSpacing: 2 }}>••••••••••</span>
          </div>
        </div>

        <Btn kind="primary" onClick={onSignIn} style={{ width: '100%', justifyContent: 'center', padding: '11px 16px', marginTop: 4 }}>
          Sign in
        </Btn>

        <div className="row-h faint" style={{ gap: 8, fontSize: 11.5, justifyContent: 'center', marginTop: 4 }}>
          <I.Shield size={12} /> Protected by 2-factor authentication
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------

const SystemSettings = () => {
  const d = TRIFECTA_DATA;
  const [tab, setTab] = React.useState('team');
  const tabs = [
    { id: 'team',    label: 'Team & Access' },
    { id: 'auth',    label: 'Authentication' },
    { id: 'infra',   label: 'Infrastructure' },
    { id: 'billing', label: 'Billing' },
  ];
  return (
    <div>
      <div className="tabs">
        {tabs.map(t => (
          <div key={t.id} className={'tab' + (tab === t.id ? ' active' : '')} onClick={() => setTab(t.id)}>
            {t.label}
          </div>
        ))}
      </div>

      {tab === 'team' && (
        <Card>
          <CardHead title="Team &amp; access" sub="Roles: Admin · Analyst · Client-viewer" icon={<I.Users size={14} />}
            actions={<Btn small kind="primary" leftIcon={<I.Plus size={12} />}>Invite operator</Btn>} />
          {d.team.map((u, i) => (
            <div key={u.email} style={{ padding: '12px 18px', borderTop: '1px solid var(--line)' }}>
              <div className="between">
                <div className="row-h" style={{ gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 999, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)', fontSize: 12 }} className="mono">
                    {u.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.name}</div>
                    <div className="dim mono" style={{ fontSize: 11.5 }}>{u.email}</div>
                  </div>
                </div>
                <div className="row-h" style={{ gap: 8 }}>
                  <Tag kind={u.role.includes('Owner') ? 'sky' : 'default'}>{u.role}</Tag>
                  <Btn small kind="ghost">Manage</Btn>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {tab === 'auth' && (
        <Card>
          <CardHead title="Authentication" sub="Operator access policies for this workspace" icon={<I.Shield size={14} />} />
          {[
            { name: 'Password policy',          desc: '12+ chars · 90-day rotation', on: true },
            { name: 'Two-factor authentication',desc: 'Required for all operators', on: true },
            { name: 'Single sign-on',           desc: 'Google Workspace · trifecta.sg', on: false },
            { name: 'Session timeout',          desc: 'Auto sign-out after 8 hours idle', on: true },
          ].map((r, i) => (
            <div key={r.name} style={{ padding: '14px 18px', borderTop: '1px solid var(--line)' }}>
              <div className="between">
                <div>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{r.desc}</div>
                </div>
                <div className="row-h" style={{ gap: 10 }}>
                  <Tag kind={r.on ? 'mint' : 'default'}>{r.on ? 'on' : 'off'}</Tag>
                  <Toggle on={r.on} />
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}

      {tab === 'infra' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Callout icon={<I.Cpu size={14} />}>
            <strong>How the platform connects to the Meridian stack.</strong> One isolated set per client — each
            engagement gets its own GCP project, BigQuery dataset, and GCS bucket.
          </Callout>
          <Card>
            <CardHead title="Infrastructure" sub="Backend connections — shared across the workspace" icon={<I.Cloud size={14} />} />
            {d.infra.map((r, i) => {
              const iconEl = ({
                database: <I.Database size={16} />,
                cloud:    <I.Cloud size={16} />,
                cpu:      <I.Cpu size={16} />,
                shield:   <I.Shield size={16} />,
              })[r.icon] || <I.Plug size={16} />;
              return (
                <div key={r.name} style={{ padding: '14px 18px', borderTop: '1px solid var(--line)' }}>
                  <div className="between">
                    <div className="row-h" style={{ gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: r.status === 'Connected' ? 'var(--sky)' : 'var(--amber)' }}>
                        {iconEl}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        <div className="dim" style={{ fontSize: 12.5, marginTop: 2 }}>{r.desc}</div>
                      </div>
                    </div>
                    <div className="row-h" style={{ gap: 8 }}>
                      <StatusTag status={r.status} />
                      <Btn small kind="ghost">Configure</Btn>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </div>
      )}

      {tab === 'billing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Card>
            <CardHead title="Plan" icon={<I.Tag size={14} />} />
            <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <Field label="Plan" mono>Operator · Growth</Field>
              <Field label="Renews" mono>14 Feb 2027</Field>
              <Field label="Workspace seats" mono>2 of 5 used</Field>
              <Field label="Client engagements" mono>4 active</Field>
            </div>
          </Card>

          <Card>
            <CardHead title="Usage this month" sub="May 2026 to date" icon={<I.Chart size={14} />} />
            <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              <div className="tile" style={{ background: 'var(--panel3)' }}>
                <div className="lbl">GPU compute</div>
                <div className="v mono">34.5<span className="unit">hrs</span></div>
                <div className="dim" style={{ fontSize: 12 }}>Vertex AI · a2-highgpu-1g</div>
              </div>
              <div className="tile" style={{ background: 'var(--panel3)' }}>
                <div className="lbl">BigQuery storage</div>
                <div className="v mono">118<span className="unit">GB</span></div>
                <div className="dim" style={{ fontSize: 12 }}>Across 4 clients</div>
              </div>
              <div className="tile" style={{ background: 'var(--panel3)' }}>
                <div className="lbl">GCS posteriors</div>
                <div className="v mono">7.2<span className="unit">GB</span></div>
                <div className="dim" style={{ fontSize: 12 }}>Versioned · 30-day retention</div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHead title="Billing contact" icon={<I.Mail size={14} />} />
            <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              <Field label="Billing email" mono>billing@trifecta.sg</Field>
              <Field label="Payment method" mono>Bank transfer · invoice</Field>
              <Field label="Tax ID (SG)" mono>202412345R</Field>
              <Field label="Currency" mono>SGD</Field>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

window.Login = Login;
window.SystemSettings = SystemSettings;
