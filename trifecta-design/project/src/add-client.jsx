// Add Client wizard — 6-step modal.

const WIZ_STEPS = [
  { id: 'client',      label: 'Client'        },
  { id: 'template',    label: 'Template'      },
  { id: 'channels',    label: 'Channels'      },
  { id: 'sources',     label: 'Data sources'  },
  { id: 'engagement',  label: 'Engagement'    },
  { id: 'review',      label: 'Review'        },
];

// Pre-built channel sets per archetype.
const TEMPLATE_CHANNELS = {
  dtc:    ['Paid Search','Meta','YouTube','TikTok','Programmatic','Affiliate','Influencer','Podcasts'],
  fmcg:   ['TV','Radio','OOH','Print','Cinema','Paid Search','Meta','YouTube','Programmatic','Trade promo','Sampling'],
  saas:   ['Paid Search','LinkedIn','Display','Content / SEO','Webinars','Outbound','Events'],
  travel: ['Paid Search','Meta','Affiliate','TV','OOH','Programmatic','Email','YouTube','Display'],
};

const DEFAULT_METHODS = {
  // sensible defaults — same channel can pick any method
  'Paid Search': 'API', 'Meta': 'API', 'YouTube': 'API', 'TikTok': 'API', 'LinkedIn': 'API',
  'Programmatic': 'Upload', 'Affiliate': 'Upload', 'Influencer': 'Upload', 'Podcasts': 'Upload',
  'Display': 'API', 'Content / SEO': 'Warehouse', 'Webinars': 'Upload', 'Outbound': 'Warehouse', 'Events': 'Manual entry',
  'TV': 'Feed', 'Radio': 'Upload', 'OOH': 'Upload', 'Print': 'Upload', 'Cinema': 'Manual entry',
  'Trade promo': 'Upload', 'Sampling': 'Manual entry', 'Email': 'Warehouse',
};

const METHOD_OPTIONS = ['API', 'Feed', 'Upload', 'Manual entry', 'Warehouse'];

const slug = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// -----------------------------------------------------------------------------
// Stepper

const Stepper = ({ step }) => (
  <div className="stepper">
    {WIZ_STEPS.map((s, i) => {
      const cls = i === step ? 'active' : (i < step ? 'done' : '');
      return (
        <React.Fragment key={s.id}>
          <div className={'s ' + cls}>
            <div className="n">{i < step ? <I.Check size={11} /> : i + 1}</div>
            <div>{s.label}</div>
          </div>
          {i < WIZ_STEPS.length - 1 ? <div className={'bar' + (i < step ? ' done' : '')} /> : null}
        </React.Fragment>
      );
    })}
  </div>
);

// -----------------------------------------------------------------------------
// Step 1 — Client basics

const StepClient = ({ form, setForm }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div>
      <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Tell us about the client</div>
      <div className="dim" style={{ fontSize: 12.5 }}>A few basics so we can spin up the workspace and choose sensible defaults.</div>
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div className="field">
        <label>Display name</label>
        <input className="input" placeholder="e.g. Stellar Cosmetics"
          value={form.displayName}
          onChange={e => setForm({ ...form, displayName: e.target.value, gcpProject: 'trifecta-' + slug(e.target.value) + '-prod' })} />
      </div>
      <div className="field">
        <label>Legal name</label>
        <input className="input" placeholder="e.g. Stellar Cosmetics Pte. Ltd."
          value={form.legalName} onChange={e => setForm({ ...form, legalName: e.target.value })} />
      </div>
      <div className="field">
        <label>Industry / category</label>
        <select className="input" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })}>
          {['Beauty & Personal Care','Food & Beverage','Home & Garden','Fashion & Apparel','Subscription / SaaS','Travel & Hospitality','Automotive','Telco','Financial Services','Other'].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Primary geography</label>
        <select className="input" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })}>
          {['Singapore','Malaysia','Indonesia','Thailand','Australia','United Kingdom','United States'].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Outcome / KPI</label>
        <select className="input" value={form.kpi} onChange={e => setForm({ ...form, kpi: e.target.value })}>
          {['Revenue','Units sold','New customers','Subscriptions','Bookings'].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Currency</label>
        <select className="input mono" value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
          {['SGD','MYR','IDR','THB','AUD','GBP','USD','EUR'].map(o => <option key={o}>{o}</option>)}
        </select>
      </div>
      <div className="field">
        <label>Primary contact — name</label>
        <input className="input" placeholder="e.g. Maya Tan"
          value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} />
      </div>
      <div className="field">
        <label>Primary contact — email</label>
        <input className="input mono" placeholder="maya@brand.com"
          value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} />
      </div>
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Step 2 — Model template

const StepTemplate = ({ form, setForm }) => {
  const templates = TRIFECTA_DATA.modelLibrary.map(t => ({ ...t }));
  templates.push({ id: 'blank', name: 'Start from blank', desc: 'No defaults', channels: 0, clients: 0, tags: ['Custom'] });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Pick a starting template</div>
        <div className="dim" style={{ fontSize: 12.5 }}>A reusable archetype from Model Library — channels, priors and adstock defaults. Tune everything in Model Studio later.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {templates.map(t => (
          <div key={t.id} className={'choice' + (form.templateId === t.id ? ' selected' : '')}
            onClick={() => setForm({ ...form, templateId: t.id })}>
            <div className="between" style={{ marginBottom: 10 }}>
              <div className="row-h" style={{ gap: 10 }}>
                <div className="check"><I.Check size={11} /></div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                  <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{t.desc}</div>
                </div>
              </div>
              {t.id !== 'blank' ? (
                <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em', textAlign: 'right' }}>
                  {t.channels} CH · {t.clients} CLIENT{t.clients !== 1 ? 'S' : ''}
                </div>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {t.tags.map(tag => <Tag key={tag}>{tag}</Tag>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Step 3 — Channels

const StepChannels = ({ form, setForm }) => {
  const channels = form.templateId === 'blank'
    ? ['Paid Search','Meta','YouTube','TV','OOH','Programmatic']
    : (TEMPLATE_CHANNELS[form.templateId] || []);

  // Initialise toggles if not set
  React.useEffect(() => {
    const init = {};
    channels.forEach(c => { init[c] = form.channels[c] !== undefined ? form.channels[c] : true; });
    setForm({ ...form, channels: init });
    // eslint-disable-next-line
  }, [form.templateId]);

  const toggle = (c) => setForm({ ...form, channels: { ...form.channels, [c]: !form.channels[c] } });
  const onCount = Object.values(form.channels).filter(Boolean).length;
  const totalCount = Object.keys(form.channels).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="between">
        <div>
          <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Confirm channels</div>
          <div className="dim" style={{ fontSize: 12.5 }}>Drop or add channels you don't run yet. You can change this later in Model Studio.</div>
        </div>
        <Tag kind="sky">{onCount} of {totalCount} included</Tag>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {channels.map(c => {
          const on = !!form.channels[c];
          return (
            <div key={c} className={'choice' + (on ? ' selected' : '')} onClick={() => toggle(c)} style={{ padding: '12px 14px' }}>
              <div className="between">
                <div className="row-h" style={{ gap: 10 }}>
                  <div className="check"><I.Check size={11} /></div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{c}</div>
                </div>
                <Tag>{['TV','Radio','OOH','Print','Cinema','Trade promo','Sampling'].includes(c) ? 'Traditional' : 'Digital'}</Tag>
              </div>
            </div>
          );
        })}
      </div>
      <Callout icon={<I.Info size={13} />}>
        Excluded channels stay in the workspace as drafts — easy to add back later when the agency starts buying them.
      </Callout>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Step 4 — Data sources

const StepSources = ({ form, setForm }) => {
  const channels = Object.keys(form.channels).filter(c => form.channels[c]);

  // Init methods
  React.useEffect(() => {
    const init = { ...form.methods };
    channels.forEach(c => { if (!init[c]) init[c] = DEFAULT_METHODS[c] || 'Upload'; });
    setForm({ ...form, methods: init });
    // eslint-disable-next-line
  }, [JSON.stringify(channels)]);

  const setMethod = (ch, m) => setForm({ ...form, methods: { ...form.methods, [ch]: m } });

  const counts = METHOD_OPTIONS.reduce((acc, m) => {
    acc[m] = channels.filter(c => form.methods[c] === m).length;
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>How will each source reach us?</div>
        <div className="dim" style={{ fontSize: 12.5 }}>Connection method is independent of channel type — anything without an API arrives as a spreadsheet, exactly like TV. Pick what's true today; we'll set up the recipe later.</div>
      </div>

      <div className="grid g4" style={{ gap: 8 }}>
        {METHOD_OPTIONS.map(m => (
          <div key={m} className="tile" style={{ padding: '10px 12px' }}>
            <div className="lbl">{m}</div>
            <div className="mono" style={{ fontSize: 16, fontFamily: 'var(--f-display)', fontWeight: 700 }}>{counts[m]}</div>
          </div>
        ))}
        <div className="tile" style={{ padding: '10px 12px' }}>
          <div className="lbl">Total</div>
          <div className="mono" style={{ fontSize: 16, fontFamily: 'var(--f-display)', fontWeight: 700 }}>{channels.length}</div>
        </div>
      </div>

      <Card>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Channel</th>
              <th>Connection method</th>
            </tr>
          </thead>
          <tbody>
            {channels.map(c => (
              <tr key={c}>
                <td>
                  <div className="row-h" style={{ gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: ['TV','Radio','OOH','Print','Cinema','Trade promo','Sampling'].includes(c) ? 'var(--amber)' : 'var(--sky)' }} />
                    <span style={{ fontWeight: 600 }}>{c}</span>
                  </div>
                </td>
                <td>
                  <div className="row-h" style={{ gap: 4, flexWrap: 'wrap' }}>
                    {METHOD_OPTIONS.map(m => (
                      <button key={m}
                        onClick={() => setMethod(c, m)}
                        style={{
                          padding: '4px 9px', borderRadius: 999, fontSize: 11,
                          fontFamily: 'var(--f-mono)', letterSpacing: '0.04em',
                          border: '1px solid ' + (form.methods[c] === m ? 'var(--blue)' : 'var(--line)'),
                          background: form.methods[c] === m ? 'rgba(79,110,242,0.10)' : 'transparent',
                          color: form.methods[c] === m ? 'var(--text)' : 'var(--dim)',
                          cursor: 'pointer',
                        }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} style={{ background: 'var(--panel3)' }}>
                <div className="row-h" style={{ gap: 10, justifyContent: 'space-between' }}>
                  <span className="dim" style={{ fontSize: 12 }}>Business outcomes (revenue, conversions) and controls (price, promos, weather) are auto-set to <strong style={{ color: 'var(--text)' }}>Warehouse · auto</strong>.</span>
                  <Tag kind="mint">+ 9 auto-configured</Tag>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Step 5 — Engagement

const StepEngagement = ({ form, setForm }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Engagement &amp; infrastructure</div>
        <div className="dim" style={{ fontSize: 12.5 }}>Commercial terms, refresh cadence, and where this client's data lives.</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="field">
          <label>Engagement value (per year)</label>
          <div className="row-h" style={{ gap: 8 }}>
            <span className="mono dim" style={{ minWidth: 36, fontSize: 12 }}>{form.currency}</span>
            <input className="input mono" placeholder="54,000" value={form.engagementValue}
              onChange={e => setForm({ ...form, engagementValue: e.target.value })} />
          </div>
        </div>
        <div className="field">
          <label>Contract term</label>
          <select className="input" value={form.termMonths} onChange={e => setForm({ ...form, termMonths: e.target.value })}>
            {[6, 12, 18, 24, 36].map(n => <option key={n} value={n}>{n} months</option>)}
          </select>
        </div>
        <div className="field">
          <label>Model refresh cadence</label>
          <div className="seg">
            {['Monthly','Quarterly','Bi-weekly'].map(c => (
              <button key={c} className={form.cadence === c ? 'on' : ''} onClick={() => setForm({ ...form, cadence: c })}>{c}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Data residency</label>
          <select className="input mono" value={form.residency} onChange={e => setForm({ ...form, residency: e.target.value })}>
            {['asia-southeast1 (Singapore)','asia-southeast2 (Jakarta)','australia-southeast1 (Sydney)','europe-west2 (London)','us-east1 (S. Carolina)'].map(o => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>GCP project ID</label>
          <input className="input mono" placeholder="trifecta-<client>-prod"
            value={form.gcpProject} onChange={e => setForm({ ...form, gcpProject: e.target.value })} />
          <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>Each client lives in an isolated GCP project — its own BigQuery dataset, GCS bucket, and service account.</div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Step 6 — Review

const StepReview = ({ form, goTo }) => {
  const channels = Object.keys(form.channels).filter(c => form.channels[c]);
  const apiCount = channels.filter(c => form.methods[c] === 'API').length;
  const nonApi = channels.length - apiCount;
  const readiness = Math.min(100, Math.round(20 + (apiCount / Math.max(1, channels.length)) * 50));

  const rows = [
    ['Display name',    form.displayName || '—'],
    ['Legal name',      form.legalName || '—'],
    ['Industry',        form.industry],
    ['Geography',       form.region],
    ['KPI',             `${form.kpi} (${form.currency})`],
    ['Primary contact', form.contactName ? `${form.contactName} · ${form.contactEmail}` : '—'],
  ];
  const eng = [
    ['Template',        TRIFECTA_DATA.modelLibrary.find(t => t.id === form.templateId)?.name || (form.templateId === 'blank' ? 'Start from blank' : '—')],
    ['Channels',        `${channels.length} included (${apiCount} API · ${nonApi} non-API)`],
    ['Cadence',         form.cadence],
    ['Engagement',      `${form.currency} ${form.engagementValue || '—'} / yr · ${form.termMonths} mo`],
    ['Residency',       form.residency],
    ['GCP project',     form.gcpProject || '—'],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div className="display" style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Review &amp; create</div>
        <div className="dim" style={{ fontSize: 12.5 }}>This sets up the GCP project, copies the template into a draft model, and queues the first data-source uploads.</div>
      </div>

      <div className="grid g2">
        <Card>
          <CardHead title="Client" actions={<Btn small kind="ghost" onClick={() => goTo(0)}>Edit</Btn>} />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map(([k, v]) => (
              <div key={k} className="between" style={{ gap: 12 }}>
                <span className="mono faint" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{k}</span>
                <span style={{ fontSize: 13, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHead title="Model & infrastructure" actions={<Btn small kind="ghost" onClick={() => goTo(1)}>Edit</Btn>} />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {eng.map(([k, v]) => (
              <div key={k} className="between" style={{ gap: 12 }}>
                <span className="mono faint" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{k}</span>
                <span style={{ fontSize: 13, textAlign: 'right' }} className={k === 'GCP project' || k === 'Residency' ? 'mono' : ''}>{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardHead title="Channels & methods" actions={<Btn small kind="ghost" onClick={() => goTo(2)}>Edit</Btn>} />
        <div className="card-pad" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {channels.map(c => (
            <div key={c} className="row-h" style={{ gap: 6, padding: '4px 8px 4px 4px', background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 999 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: ['TV','Radio','OOH','Print','Cinema','Trade promo','Sampling'].includes(c) ? 'var(--amber)' : 'var(--sky)' }} />
              <span style={{ fontSize: 12 }}>{c}</span>
              <Tag kind={form.methods[c] === 'API' ? 'sky' : (form.methods[c] === 'Warehouse' ? 'mint' : (form.methods[c] === 'Feed' ? 'blue' : 'amber'))}>{form.methods[c]}</Tag>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHead title="What happens next" />
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['1', 'Provision GCP project',      `${form.gcpProject || 'trifecta-<client>-prod'} · BigQuery + GCS + service account`],
            ['2', 'Clone model template',       'New draft Aeon-style model with template priors, ready to tune'],
            ['3', 'Request first uploads',      `${nonApi} non-API sources will need a first spreadsheet to set the column-mapping recipe`],
            ['4', 'Invite client viewer',       `Email ${form.contactEmail || 'primary contact'} a Signal Viewer invite once the first run completes`],
          ].map(([n, t, s]) => (
            <div key={n} className="row-h" style={{ gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--panel3)', border: '1px solid var(--line2)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-mono)', fontSize: 11, color: 'var(--dim)', flex: '0 0 22px' }}>{n}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t}</div>
                <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>{s}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="row-h" style={{ gap: 12, alignItems: 'center', padding: '12px 14px', background: 'rgba(55,211,155,0.08)', border: '1px solid rgba(55,211,155,0.35)', borderRadius: 8 }}>
        <span style={{ color: 'var(--mint)' }}><I.Check size={14} /></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>Initial readiness ~{readiness}%</div>
          <div className="dim" style={{ fontSize: 12 }}>
            {apiCount} channel{apiCount !== 1 ? 's' : ''} will populate automatically once OAuth is connected. {nonApi} source{nonApi !== 1 ? 's' : ''} need the first manual file to set up the mapping recipe.
          </div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Wizard shell

const AddClientWizard = ({ onClose, onCreate }) => {
  const [step, setStep] = React.useState(0);
  const [form, setForm] = React.useState({
    displayName: '',
    legalName: '',
    industry: 'Beauty & Personal Care',
    region: 'Singapore',
    kpi: 'Revenue',
    currency: 'SGD',
    contactName: '',
    contactEmail: '',
    templateId: 'dtc',
    channels: {},
    methods: {},
    engagementValue: '54,000',
    cadence: 'Monthly',
    termMonths: 12,
    residency: 'asia-southeast1 (Singapore)',
    gcpProject: 'trifecta-<client>-prod',
  });

  const goNext = () => setStep(s => Math.min(WIZ_STEPS.length - 1, s + 1));
  const goBack = () => setStep(s => Math.max(0, s - 1));
  const goTo = (i) => setStep(i);

  const isLast = step === WIZ_STEPS.length - 1;
  const isFirst = step === 0;

  // Validation per step (loose — just disable Next if obviously empty on key steps)
  const canContinue = (() => {
    if (step === 0) return form.displayName.trim().length > 0;
    if (step === 2) return Object.values(form.channels).some(Boolean);
    return true;
  })();

  const handleCreate = () => {
    const channels = Object.keys(form.channels).filter(c => form.channels[c]);
    const apiCount = channels.filter(c => form.methods[c] === 'API').length;
    const readiness = Math.min(100, Math.round(20 + (apiCount / Math.max(1, channels.length)) * 50));
    const newClient = {
      id: slug(form.displayName) || ('client-' + Date.now()),
      name: form.displayName || 'New client',
      readiness,
      version: 'v0',
      state: 'draft',
      run: 'Onboarding',
      actions: channels.length - apiCount,
      status: 'Onboarding',
      steps: { data: 'active', config: 'pending', train: 'pending', results: 'pending', signal: 'pending' },
    };
    onCreate(newClient);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)' }}>
            <I.Plus size={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>Add a client</div>
            <div className="dim" style={{ fontSize: 12 }}>Set up the workspace, model template and data sources for a new engagement.</div>
          </div>
          <button className="theme-toggle" onClick={onClose} title="Close">
            <I.Plus size={14} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>

        <div style={{ padding: '14px 22px', borderBottom: '1px solid var(--line)', background: 'var(--panel3)' }}>
          <Stepper step={step} />
        </div>

        <div className="modal-body" style={{ minHeight: 380 }}>
          {step === 0 && <StepClient    form={form} setForm={setForm} />}
          {step === 1 && <StepTemplate  form={form} setForm={setForm} />}
          {step === 2 && <StepChannels  form={form} setForm={setForm} />}
          {step === 3 && <StepSources   form={form} setForm={setForm} />}
          {step === 4 && <StepEngagement form={form} setForm={setForm} />}
          {step === 5 && <StepReview    form={form} goTo={goTo} />}
        </div>

        <div className="modal-foot">
          <div className="mono faint" style={{ fontSize: 11, letterSpacing: '0.1em' }}>
            STEP {step + 1} OF {WIZ_STEPS.length} · {WIZ_STEPS[step].label.toUpperCase()}
          </div>
          <div className="row-h" style={{ gap: 8 }}>
            <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
            {!isFirst ? <Btn kind="ghost" onClick={goBack}>Back</Btn> : null}
            {!isLast ? (
              <Btn kind="primary" onClick={canContinue ? goNext : undefined}
                style={canContinue ? {} : { opacity: 0.5, cursor: 'not-allowed' }}>
                Continue
              </Btn>
            ) : (
              <Btn kind="primary" leftIcon={<I.Check size={13} />} onClick={handleCreate}>
                Create client
              </Btn>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

window.AddClientWizard = AddClientWizard;
