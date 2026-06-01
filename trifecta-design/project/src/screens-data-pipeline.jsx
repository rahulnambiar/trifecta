// Data Pipeline screen

const ICON_BY_KEY = {
  search: <I.Search size={14} />,
  megaphone: <I.Megaphone size={14} />,
  music: <I.Music size={14} />,
  plug: <I.Plug size={14} />,
  globe: <I.Globe size={14} />,
  users: <I.Users size={14} />,
  tag: <I.Tag size={14} />,
  tv: <I.Tv size={14} />,
  radio: <I.Radio size={14} />,
  print: <I.Print size={14} />,
  billboard: <I.Billboard size={14} />,
  film: <I.Film size={14} />,
  dollar: <I.Dollar size={14} />,
  trending: <I.Trending size={14} />,
  hash: <I.Hash size={14} />,
  calendar: <I.Calendar size={14} />,
  box: <I.Box size={14} />,
  cloudsun: <I.CloudSun size={14} />,
};

const SourceRow = ({ s }) => (
  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)' }}>
    <div className="row-h" style={{ gap: 14 }}>
      <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)', flex: '0 0 28px' }}>
        {ICON_BY_KEY[s.ic] || <I.Plug size={14} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="row-h" style={{ gap: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
        </div>
        <div className="dim mono" style={{ fontSize: 11, marginTop: 2 }}>{s.cadence} · {s.coverage}</div>
      </div>
      <ConnTag method={s.method} />
      <StatusTag status={s.status} />
      {s.method === 'Upload' ? (
        <Btn small kind="ghost" leftIcon={<I.Upload size={12} />}>Upload &amp; map</Btn>
      ) : (
        <Btn small kind="ghost">Configure</Btn>
      )}
    </div>
    {s.warn ? (
      <div className="row-h" style={{ gap: 8, marginTop: 8, padding: '8px 10px', background: 'rgba(230,176,82,0.06)', border: '1px solid rgba(230,176,82,0.25)', borderRadius: 6 }}>
        <span style={{ color: 'var(--amber)' }}><I.AlertTri size={13} /></span>
        <div style={{ fontSize: 12, color: 'var(--text)' }}>{s.warn}</div>
      </div>
    ) : null}
  </div>
);

const CategoryCard = ({ cat }) => (
  <Card>
    <div className="card-head">
      <div>
        <h3>{cat.title}</h3>
        {cat.note ? <div className="sub" style={{ marginTop: 2 }}>{cat.note}</div> : null}
      </div>
      <div className="actions">
        <span className="mono faint" style={{ fontSize: 11 }}>{cat.sources.length} sources</span>
      </div>
    </div>
    {cat.sources.map((s, i) => <SourceRow key={i} s={s} />)}
  </Card>
);

const DataPipeline = ({ client }) => {
  const d = TRIFECTA_DATA;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
        {/* Readiness banner */}
        <Card>
          <div style={{ padding: 20 }}>
            <div className="between">
              <div>
                <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.16em', marginBottom: 4 }}>MODEL READINESS — {client.name.toUpperCase()}</div>
                <div className="display" style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {client.readiness}<span style={{ fontSize: 22, color: 'var(--dim)' }}>%</span>
                </div>
                <div className="dim mono" style={{ fontSize: 11.5, marginTop: 8 }}>
                  ~20 sources · ~70 raw line items → 23 model variables · weekly, Jan 2024 – Apr 2026
                </div>
              </div>
              <Btn kind="primary" leftIcon={<I.Plus size={13} />}>Connect source</Btn>
            </div>
            <div style={{ marginTop: 18 }}>
              <Progress value={client.readiness} />
            </div>
          </div>
        </Card>

        {/* Pipeline stages */}
        <div>
          <SectionHead
            title="Pipeline stages"
            sub="From inconsistent agency files to one harmonised weekly time series."
          />
          <StageStrip steps={d.pipelineStages} activeIndex={2} />
        </div>

        {/* Connection methods callout */}
        <Callout icon={<I.Info size={14} />}>
          <strong>Connection method is independent of channel type.</strong> Any source — digital
          or offline — can use any method. A brand with no ad server uploads its display and
          programmatic numbers in a spreadsheet exactly as it does its TV. The platform treats
          an uploaded digital source as a first-class citizen, with the same column-mapping and
          QA as offline media.
          <div className="row-h" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <Tag kind="sky">API · auto</Tag>
            <Tag kind="blue">Feed · scheduled</Tag>
            <Tag kind="amber">Upload · manual</Tag>
            <Tag kind="amber">Manual entry</Tag>
            <Tag kind="mint">Warehouse · auto</Tag>
          </div>
        </Callout>

        {/* Source categories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {d.pipelineCategories.map(c => <CategoryCard key={c.title} cat={c} />)}
        </div>

        {/* Upload & map explainer */}
        <Card>
          <CardHead
            icon={<I.Upload size={14} />}
            title="Upload &amp; map"
            sub="The platform’s most-used ingestion path — used by digital and offline sources alike."
          />
          <div className="card-pad" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[
              { n: '1', t: 'Drop file', s: 'Excel / CSV from the agency, however they sent it this month.' },
              { n: '2', t: 'Map columns', s: 'Match their headers to canonical: channel, week, spend, impressions, geo.' },
              { n: '3', t: 'Save as recipe', s: 'Future files use the saved mapping. Layout drift flags as “needs remapping”.' },
            ].map(s => (
              <div key={s.n} style={{ padding: 14, border: '1px dashed var(--line2)', borderRadius: 8, background: 'var(--panel3)' }}>
                <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em' }}>STEP {s.n}</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>{s.t}</div>
                <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>{s.s}</div>
              </div>
            ))}
          </div>
        </Card>

        <Callout icon={<I.AlertTri size={14} />}>
          The model is the easy 20%. The hard part is everything <strong>without an API</strong> —
          offline media <em>and</em> a large share of digital spend — arriving as inconsistent
          spreadsheets. The platform templates the upload-and-harmonise work once, so two people
          can repeat it across every client.
        </Callout>
      </div>

      {/* Right rail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'sticky', top: 78, alignSelf: 'start', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
        <Card>
          <CardHead title="Harmonisation engine" sub="Sources → variables" icon={<I.Funnel size={14} />} />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { l: '~20 sources',          w: '100%' },
              { l: '~70 raw line items',   w: '78%' },
              { l: '23 model variables',   w: '50%' },
              { l: '122 weekly rows',      w: '36%' },
            ].map((r, i) => (
              <div key={i}>
                <div className="between" style={{ marginBottom: 4 }}>
                  <div className="mono" style={{ fontSize: 11.5 }}>{r.l}</div>
                </div>
                <div style={{ height: 22, background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, width: r.w, background: 'linear-gradient(90deg, rgba(79,110,242,0.4), rgba(55,211,155,0.4))' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead title="Data coverage" sub="Last 6 months · weekly" icon={<I.Calendar size={14} />} />
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { n: 'Google Ads (API)',       segs: [['ok','100']] },
              { n: 'Meta Ads (API)',         segs: [['ok','100']] },
              { n: 'TV (Feed)',              segs: [['ok','80'],['late','20']] },
              { n: 'Influencer (Upload)',    segs: [['ok','65'],['gap','15'],['late','20']] },
              { n: 'Print (Upload)',         segs: [['ok','55'],['gap','45']] },
              { n: 'Programmatic (Upload)',  segs: [['ok','75'],['late','25']] },
            ].map((r, i) => (
              <div key={i}>
                <div className="between" style={{ marginBottom: 4 }}>
                  <div className="mono" style={{ fontSize: 11 }}>{r.n}</div>
                </div>
                <div className="cov">
                  {r.segs.map((s, j) => <span key={j} className={s[0]} style={{ width: s[1] + '%' }} />)}
                </div>
              </div>
            ))}
            <div className="row-h" style={{ gap: 12, marginTop: 4, fontSize: 11 }}>
              <span className="row-h" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: 'var(--mint)', borderRadius: 2 }} /> on time</span>
              <span className="row-h" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: 'var(--amber)', borderRadius: 2 }} /> late</span>
              <span className="row-h" style={{ gap: 4 }}><span style={{ width: 8, height: 8, background: 'var(--red)', borderRadius: 2 }} /> gap</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Action queue" sub={`${d.actionQueue.length} open items`} icon={<I.AlertTri size={14} />} />
          <div>
            {d.actionQueue.map((a, i) => (
              <div key={i} style={{ padding: '10px 14px', borderTop: i ? '1px solid var(--line)' : 'none' }}>
                <div className="row-h" style={{ gap: 8, marginBottom: 4 }}>
                  <StatusTag status={a.tag} />
                  <div className="mono faint" style={{ fontSize: 11 }}>{a.area}</div>
                </div>
                <div style={{ fontSize: 12 }}>{a.msg}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
};

window.DataPipeline = DataPipeline;
