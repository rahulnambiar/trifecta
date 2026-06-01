// Reports — generate quarterly/annual reports with human-in-the-loop editing.

// -----------------------------------------------------------------------------
// Data

const REPORT_SECTION_LIB = [
  {
    id: 'exec', title: 'Executive summary', icon: 'Info',
    story: "Aeon Skincare grew revenue 11% year-over-year in Q1 2026 despite a modest 4% lift in paid media spend, with Meta and YouTube emerging as the strongest contributors to incremental growth. Print and Radio continue to under-deliver against their cost; we recommend reallocating ~SGD 110k from these channels into Meta over Q2 to capture the headroom on its response curve.",
    dataLbl: 'KPIs', dataHint: 'Auto-pulled from posterior · revenue, paid share, top mover',
  },
  {
    id: 'drivers', title: 'What drove the quarter', icon: 'Chart',
    story: "Base demand carried 46% of revenue this quarter, in line with the trailing four-quarter average. Among paid drivers, the top three (Paid Search, Meta, TV) account for 32% of revenue. Paid Search remained the steady performer; Meta grew its contribution share by 2.1 percentage points following the March creative refresh.",
    dataLbl: 'Channel contribution', dataHint: 'Stacked weekly · last 13 weeks',
  },
  {
    id: 'roi', title: 'Channel ROI & marginal ROI', icon: 'Trending',
    story: "Three channels carry a marginal ROI above 1.5x with reasonable confidence: YouTube (2.4x), TikTok (2.6x) and Meta (1.7x). Paid Search remains profitable on average (3.4x) but the next marginal dollar is worth only 1.9x — diminishing returns are now material. TV and Out-of-Home both sit just above break-even.",
    dataLbl: 'ROI & marginal ROI', dataHint: '8 channels · 90% credible interval',
  },
  {
    id: 'budget', title: 'Recommended allocation', icon: 'Dollar',
    story: "Holding total Q2 spend flat at SGD 1.85m, the optimiser projects a +4.2% revenue lift (90% CI: +1.9% to +6.6%) from moving ~SGD 130k of weekly spend out of Print and Radio and into Meta, YouTube and TikTok. The recommendation is robust across alternative model specifications and remains the headline action for Q2.",
    dataLbl: 'Current vs recommended', dataHint: 'Reallocation visual',
  },
  {
    id: 'saturation', title: 'Saturation watch', icon: 'Funnel',
    story: "Paid Search now sits at ~78% of its half-saturation point — the response curve is visibly flattening. TV and YouTube remain in the steep portion of their curves with meaningful headroom. We recommend treating any further Paid Search increase as exploratory until a fresh geo-holdout is run.",
    dataLbl: 'Saturation by channel', dataHint: 'Hill curves · operating point',
  },
  {
    id: 'experiments', title: 'Calibration experiments', icon: 'Check',
    story: "The Meta geo-holdout completed in March 2026 returned a measured ROI of 2.4x ±0.4, applied as a calibration prior in model v3. A TikTok holdout is proposed for Q2 to anchor that channel's prior more strongly — its current prior is the weakest in the model.",
    dataLbl: 'Experiment log', dataHint: '2 applied · 1 proposed',
  },
  {
    id: 'changes', title: 'What changed since last quarter', icon: 'Compare',
    story: "Compared to Q4 2025, Meta's contribution share rose 2.1pp and Print fell 1.4pp. Model R-hat improved from 1.02 to 1.01 and holdout MAPE tightened from 11% to 9%. No structural changes to the model — same channels, same control set.",
    dataLbl: 'QoQ delta', dataHint: 'Contribution + diagnostics',
  },
  {
    id: 'appendix', title: 'Methodology & appendix', icon: 'Box',
    story: "MMM v3 trained on 122 weeks of weekly data (Jan 2024 – Apr 2026) with Google's open-source Meridian library, NUTS sampler, 4 chains. National + 5 regions. Holdout MAPE 9% on the last 8 weeks. Posterior artifact: v3-2026-05-12.nc. Every figure in this report carries a 90% credible interval.",
    dataLbl: 'Methodology block', dataHint: 'Model, data window, diagnostics',
  },
];

const REPORTS_HISTORY = [
  { id: 'r1', title: 'Q1 2026 — Quarterly Performance', type: 'Quarterly', period: 'Jan – Mar 2026', sentDate: '14 Apr 2026', status: 'Sent',     pages: 18, recipients: ['maya@aeonskincare.com','sam@aeonskincare.com'] },
  { id: 'r2', title: '2025 — Annual Review',            type: 'Annual',    period: 'Jan – Dec 2025', sentDate: '28 Jan 2026', status: 'Sent',     pages: 42, recipients: ['maya@aeonskincare.com','sam@aeonskincare.com'] },
  { id: 'r3', title: 'Q4 2025 — Quarterly Performance', type: 'Quarterly', period: 'Oct – Dec 2025', sentDate: '12 Jan 2026', status: 'Sent',     pages: 19, recipients: ['maya@aeonskincare.com'] },
  { id: 'r4', title: 'Q3 2025 — Quarterly Performance', type: 'Quarterly', period: 'Jul – Sep 2025', sentDate: '14 Oct 2025', status: 'Sent',     pages: 17, recipients: ['maya@aeonskincare.com'] },
  { id: 'r5', title: 'Q2 2025 — Quarterly Performance', type: 'Quarterly', period: 'Apr – Jun 2025', sentDate: '18 Jul 2025', status: 'Sent',     pages: 16, recipients: ['maya@aeonskincare.com'] },
];

// -----------------------------------------------------------------------------
// Mini data widgets that appear inside the section editor's "data preview"

const ContribMiniBar = () => (
  <>
    <div className="data-lbl">CHANNEL CONTRIBUTION · LAST 13 WKS</div>
    <div style={{ display: 'flex', height: 18, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--line)' }}>
      {[['#3a4663',46],['#37d39b',13],['#4f6ef2',10],['#e6b052',9],['#7d9bff',7],['#c773d6',4],['#b07e3d',5],['#c98568',3],['#7e6a5a',3]].map(([c,p],i) => (
        <div key={i} style={{ width: p+'%', background: c, opacity: 0.85 }} />
      ))}
    </div>
    <div className="dim" style={{ fontSize: 11.5 }}>Base 46% · Search 13% · Meta 10% · TV 9% · YouTube 7% · 4 more</div>
  </>
);

const KpiMini = () => (
  <>
    <div className="data-lbl">KEY FIGURES · Q1 2026</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
      {[
        ['Revenue', 'SGD 5.42m', 'var(--text)'],
        ['Paid share', '54%', 'var(--text)'],
        ['Top mover', 'Meta +2.1pp', 'var(--mint)'],
      ].map(([l,v,c],i) => (
        <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 10px' }}>
          <div className="mono faint" style={{ fontSize: 9.5, letterSpacing: '0.14em' }}>{l.toUpperCase()}</div>
          <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: c, marginTop: 2 }}>{v}</div>
        </div>
      ))}
    </div>
  </>
);

const RoiMini = () => (
  <>
    <div className="data-lbl">MARGINAL ROI · TOP 3</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[['TikTok',2.6,'#c773d6'],['YouTube',2.4,'#7d9bff'],['Meta',1.7,'#4f6ef2']].map(([n,v,c],i) => (
        <div key={i} className="between">
          <div className="row-h" style={{ gap: 8, fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{n}
          </div>
          <span className="mono" style={{ fontSize: 11.5 }}>{v.toFixed(1)}x</span>
        </div>
      ))}
    </div>
  </>
);

const BudgetMini = () => (
  <>
    <div className="data-lbl">RECOMMENDED REALLOCATION</div>
    <div className="row-h" style={{ gap: 8, fontSize: 12 }}>
      <span style={{ color: 'var(--amber)' }}>↓ Print −8%</span>
      <span className="faint">·</span>
      <span style={{ color: 'var(--amber)' }}>↓ Radio −4%</span>
      <span className="faint">·</span>
      <span style={{ color: 'var(--mint)' }}>↑ Meta +7%</span>
    </div>
    <div className="mono" style={{ fontSize: 11.5, color: 'var(--mint)', marginTop: 4 }}>Projected lift +4.2% rev (CI: +1.9% → +6.6%)</div>
  </>
);

const ExperimentsMini = () => (
  <>
    <div className="data-lbl">EXPERIMENTS</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
      <div className="row-h" style={{ gap: 8 }}><Tag kind="mint">APPLIED</Tag> Meta geo-holdout · Mar 2026 · ROI 2.4x ±0.4</div>
      <div className="row-h" style={{ gap: 8 }}><Tag kind="mint">APPLIED</Tag> TV regional lift · Q4 2025</div>
      <div className="row-h" style={{ gap: 8 }}><Tag kind="amber">PROPOSED</Tag> TikTok holdout · Q2</div>
    </div>
  </>
);

const SaturationMini = () => (
  <>
    <div className="data-lbl">SATURATION · SHARE OF HALF-POINT</div>
    {[['Paid Search',78,'var(--amber)'],['TV',40,'var(--mint)'],['YouTube',48,'var(--mint)'],['Meta',62,'var(--sky)']].map(([n,p,c],i) => (
      <div key={i}>
        <div className="between" style={{ marginBottom: 2 }}>
          <span style={{ fontSize: 11.5 }}>{n}</span>
          <span className="mono" style={{ fontSize: 11 }}>{p}%</span>
        </div>
        <div style={{ height: 4, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 999 }}>
          <div style={{ width: p+'%', height: '100%', background: c, borderRadius: 999 }} />
        </div>
      </div>
    ))}
  </>
);

const ChangesMini = () => (
  <>
    <div className="data-lbl">QoQ DELTA</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <div className="between"><span>Meta share</span><span className="mono" style={{ color: 'var(--mint)' }}>+2.1pp</span></div>
      <div className="between"><span>Print share</span><span className="mono" style={{ color: 'var(--amber)' }}>−1.4pp</span></div>
      <div className="between"><span>Model R-hat</span><span className="mono">1.02 → 1.01</span></div>
      <div className="between"><span>Holdout MAPE</span><span className="mono">11% → 9%</span></div>
    </div>
  </>
);

const AppendixMini = () => (
  <>
    <div className="data-lbl">METHODOLOGY</div>
    <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.5 }}>
      Meridian · NUTS · 4 chains<br/>
      122 wks · Jan 2024 – Apr 2026<br/>
      National + 5 regions<br/>
      Holdout MAPE 9% · R-hat 1.01
    </div>
  </>
);

const DATA_PREVIEW_BY_ID = {
  exec: <KpiMini />,
  drivers: <ContribMiniBar />,
  roi: <RoiMini />,
  budget: <BudgetMini />,
  saturation: <SaturationMini />,
  experiments: <ExperimentsMini />,
  changes: <ChangesMini />,
  appendix: <AppendixMini />,
};

// -----------------------------------------------------------------------------
// Archive view

const ReportCard = ({ r, onOpen }) => (
  <Card style={{ padding: 14, cursor: 'pointer' }}>
    <div onClick={onOpen} className="report-thumb">
      <div className="t2">TRIFECTA · MMM</div>
      <div className="t1">{r.title.split(' — ')[0]}</div>
      <div className="t2">{r.period}</div>
      <div className="t-row" style={{ marginTop: 8 }}>
        <span style={{ flex: 3 }} /><span style={{ flex: 4 }} className="x" /><span style={{ flex: 2 }} />
      </div>
      <div className="t-row"><span style={{ flex: 5 }} className="x" /><span style={{ flex: 3 }} /></div>
      <div className="t-row"><span style={{ flex: 2 }} /><span style={{ flex: 6 }} className="x" /></div>
      <div className="t-bar" />
    </div>
    <div style={{ marginTop: 12 }}>
      <div className="between" style={{ marginBottom: 6 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title}</div>
        <StatusTag status={r.status} />
      </div>
      <div className="dim mono" style={{ fontSize: 11 }}>{r.type.toUpperCase()} · {r.pages} PAGES · SENT {r.sentDate.toUpperCase()}</div>
      <div className="dim" style={{ fontSize: 11.5, marginTop: 4 }}>To: {r.recipients.join(', ')}</div>
      <div className="row-h" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <Btn small kind="ghost" leftIcon={<I.Download size={12} />}>PDF</Btn>
        <Btn small kind="ghost" leftIcon={<I.Send size={12} />}>Resend</Btn>
        <Btn small kind="ghost" leftIcon={<I.FileText size={12} />} onClick={onOpen} style={{ padding: '6px 8px' }} title="Duplicate"></Btn>
      </div>
    </div>
  </Card>
);

const ReportsArchive = ({ onNew, onOpen, client }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <Callout icon={<I.FileText size={14} />}>
      <strong>Quarterly &amp; annual reports.</strong> A PDF per quarter (and a long-form one each year) summarising what
      the model says. Every section is auto-populated from the latest posterior but the narrative is operator-edited
      before sending — so the story stays in your hands.
    </Callout>

    <div className="grid g4">
      <div className="tile">
        <div className="lbl">Reports sent</div>
        <div className="v mono">{REPORTS_HISTORY.length}</div>
        <div className="dim" style={{ fontSize: 12 }}>since {client.name} onboarded</div>
      </div>
      <div className="tile">
        <div className="lbl">Cadence</div>
        <div className="v mono">Q + A</div>
        <div className="dim" style={{ fontSize: 12 }}>Quarterly + Annual review</div>
      </div>
      <div className="tile">
        <div className="lbl">Last sent</div>
        <div className="v mono">14<span className="unit">Apr</span></div>
        <div className="dim" style={{ fontSize: 12 }}>Q1 2026 · 18 pages</div>
      </div>
      <div className="tile">
        <div className="lbl">Next due</div>
        <div className="v mono" style={{ color: 'var(--amber)' }}>14<span className="unit">Jul</span></div>
        <div className="dim" style={{ fontSize: 12 }}>Q2 2026 · drafts ready 10 Jul</div>
      </div>
    </div>

    <SectionHead
      title="All reports"
      sub="Most recent first. Click a report to preview, duplicate, or rebuild."
      actions={
        <>
          <div className="seg">
            <button className="on">All</button>
            <button>Quarterly</button>
            <button>Annual</button>
            <button>Drafts</button>
          </div>
          <Btn kind="primary" leftIcon={<I.Plus size={13} />} onClick={onNew}>New report</Btn>
        </>
      }
    />

    <div className="grid g3" style={{ gap: 14 }}>
      {REPORTS_HISTORY.map(r => <ReportCard key={r.id} r={r} onOpen={onOpen} />)}
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Section editor — the human-in-the-loop bit

const SectionEditor = ({ sec, index, included, story, onToggle, onStoryChange, onRegenerate, onMove, expanded, onExpand, isFirst, isLast }) => {
  const Ic = I[sec.icon] || I.FileText;
  return (
    <div className={'sec-card ' + (included ? 'included' : '')}>
      <div className="sec-head" onClick={onExpand}>
        <span className="sec-grip" title="Drag to reorder"><I.Grip size={14} /></span>
        <div className="sec-num">{included ? index : '—'}</div>
        <span style={{ color: included ? 'var(--sky)' : 'var(--faint)', display: 'inline-flex' }}><Ic size={14} /></span>
        <div className="sec-title">{sec.title}</div>
        {!included ? <Tag>excluded</Tag> : null}
        <div style={{ flex: 1 }} />
        <Btn small kind="ghost" onClick={e => { e.stopPropagation(); onMove(-1); }} style={{ visibility: isFirst ? 'hidden' : 'visible', padding: '4px 6px' }}><I.ChevronUp size={12} /></Btn>
        <Btn small kind="ghost" onClick={e => { e.stopPropagation(); onMove(1); }}  style={{ visibility: isLast  ? 'hidden' : 'visible', padding: '4px 6px' }}><I.Chevron  size={12} /></Btn>
        <span onClick={e => { e.stopPropagation(); onToggle(); }}><Toggle on={included} /></span>
        <span style={{ color: 'var(--faint)', display: 'inline-flex', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <I.Chevron size={14} />
        </span>
      </div>
      {expanded ? (
        <div className="sec-body">
          <div>
            <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em', marginBottom: 6 }}>DATA · {sec.dataLbl.toUpperCase()}</div>
            <div className="data-mini">
              {DATA_PREVIEW_BY_ID[sec.id]}
            </div>
            <div className="dim" style={{ fontSize: 11, marginTop: 6 }}>{sec.dataHint} · pulls live from posterior v3.</div>
            <div className="row-h" style={{ gap: 6, marginTop: 8 }}>
              <Btn small kind="ghost" leftIcon={<I.Eye size={12} />}>Open in Results</Btn>
              <Btn small kind="ghost" leftIcon={<I.Compare size={12} />}>Swap chart</Btn>
            </div>
          </div>
          <div>
            <div className="mono faint" style={{ fontSize: 10, letterSpacing: '0.14em', marginBottom: 6 }}>STORY · OPERATOR-EDITABLE</div>
            <textarea
              className="story"
              value={story}
              onChange={e => onStoryChange(e.target.value)}
            />
            <div className="ai-row">
              <div className="row-h" style={{ gap: 8 }}>
                <Btn small kind="mint" leftIcon={<I.Sparkles size={11} />} onClick={onRegenerate}>Regenerate with Claude</Btn>
                <span className="meta">{story.trim().split(/\s+/).filter(Boolean).length} words</span>
              </div>
              <span className="meta">edited by RB · just now</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

// -----------------------------------------------------------------------------
// PDF preview pane (paper aesthetic)

const PaperCover = ({ title, period, client }) => (
  <div style={{ padding: '8px 0' }}>
    <div className="p-cover-sub">TRIFECTA · MMM · QUARTERLY REVIEW</div>
    <div className="p-cover-title">{title}</div>
    <div style={{ marginTop: 14, color: '#4f5773', fontSize: 11 }}>
      Prepared for <strong style={{ color: '#1d2030' }}>{client.name}</strong> · {period} · Model v3
    </div>
    <hr className="p-divider" />
  </div>
);

const PaperSection = ({ sec, story, pageNo }) => (
  <div style={{ marginTop: 16 }}>
    <div className="between" style={{ alignItems: 'baseline' }}>
      <div>
        <span className="p-eyebrow">SECTION {pageNo}</span>
        <h2 className="p-h2" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>{sec.title}</h2>
      </div>
      <div className="p-pageno">P. {pageNo + 1}</div>
    </div>
    {sec.id === 'exec' ? (
      <div className="p-kpi">
        <div><div className="l">REVENUE</div><div className="v">SGD 5.42m</div></div>
        <div><div className="l">PAID SHARE</div><div className="v">54%</div></div>
        <div><div className="l">TOP MOVER</div><div className="v" style={{ color: '#1c9a70' }}>Meta +2.1pp</div></div>
      </div>
    ) : (
      <div className="p-row" style={{ marginTop: 8 }}>
        <div className="p-chart">[ {sec.dataLbl} ]</div>
      </div>
    )}
    <div className="p-story">{story}</div>
  </div>
);

const ReportPreview = ({ title, period, sections, sectionState, client }) => {
  const includedSections = sections.filter(s => sectionState[s.id].included);
  return (
    <div className="paper">
      <PaperCover title={title || 'Q1 2026 — Quarterly Performance'} period={period} client={client} />
      {includedSections.map((s, i) => (
        <PaperSection key={s.id} sec={s} story={sectionState[s.id].story} pageNo={i + 1} />
      ))}
      <div style={{ marginTop: 22, paddingTop: 12, borderTop: '1px solid #ece8da', display: 'flex', justifyContent: 'space-between' }}>
        <div className="mono" style={{ fontSize: 9, color: '#8a8567', letterSpacing: '0.14em' }}>TRIFECTA CONSULTING · {new Date().getFullYear()}</div>
        <div className="mono" style={{ fontSize: 9, color: '#8a8567', letterSpacing: '0.14em' }}>{includedSections.length + 1} PAGES · 90% CI</div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Send dialog

const SendDialog = ({ title, recipientsDefault, onClose, onSend }) => {
  const [recips, setRecips] = React.useState(recipientsDefault);
  const [subject, setSubject] = React.useState(`Your Q1 2026 MMM report — ${title.split(' — ')[0] || 'Quarterly review'}`);
  const [body, setBody] = React.useState("Hi Maya,\n\nAttached is your Q1 2026 MMM report. Headline: revenue up 11% YoY, Meta and YouTube driving the incremental growth. We're recommending a small reallocation out of Print and Radio for Q2 — full detail in section 4.\n\nHappy to walk you through it whenever suits. As always, Signal can answer follow-up questions live.\n\nRajeev");
  const toggle = (e) => setRecips(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  const allCandidates = ['maya@aeonskincare.com','sam@aeonskincare.com','rajeev@trifecta.sg'];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--panel3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', color: 'var(--sky)' }}>
            <I.Send size={15} />
          </div>
          <div style={{ flex: 1 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>Send report</div>
            <div className="dim" style={{ fontSize: 12 }}>Email the PDF to client viewers and file the sent copy in the archive.</div>
          </div>
          <button className="theme-toggle" onClick={onClose}><I.X size={13} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>To</label>
            <div className="row-h" style={{ gap: 6, flexWrap: 'wrap', padding: 6, border: '1px solid var(--line)', borderRadius: 6, background: 'var(--panel3)', minHeight: 38 }}>
              {recips.map(r => (
                <div key={r} className="row-h" style={{ gap: 6, padding: '3px 8px', background: 'var(--panel)', border: '1px solid var(--line2)', borderRadius: 999, fontSize: 12 }}>
                  <span className="mono">{r}</span>
                  <button onClick={() => toggle(r)} style={{ color: 'var(--faint)', display: 'inline-flex' }}><I.X size={10} /></button>
                </div>
              ))}
              {allCandidates.filter(c => !recips.includes(c)).map(c => (
                <button key={c} onClick={() => toggle(c)} className="row-h" style={{ gap: 4, padding: '3px 8px', border: '1px dashed var(--line2)', borderRadius: 999, fontSize: 11.5, color: 'var(--dim)', fontFamily: 'var(--f-mono)', cursor: 'pointer' }}>
                  <I.Plus size={10} /> {c}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Subject</label>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="field">
            <label>Message</label>
            <textarea className="story" style={{ minHeight: 160 }} value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div className="row-h" style={{ gap: 10, padding: '10px 12px', background: 'var(--panel3)', border: '1px solid var(--line)', borderRadius: 8 }}>
            <span style={{ color: 'var(--sky)', display: 'inline-flex' }}><I.FileText size={14} /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{title || 'Q1-2026-Quarterly-Performance.pdf'}</div>
              <div className="dim mono" style={{ fontSize: 11 }}>Generated just now · auto-attached</div>
            </div>
            <Tag kind="mint">90% CI</Tag>
          </div>
        </div>
        <div className="modal-foot">
          <div className="dim mono" style={{ fontSize: 11 }}>Sends from rajeev@trifecta.sg · BCC archive</div>
          <div className="row-h" style={{ gap: 8 }}>
            <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
            <Btn kind="ghost" leftIcon={<I.Clock size={12} />}>Schedule…</Btn>
            <Btn kind="primary" leftIcon={<I.Send size={12} />} onClick={onSend}>Send &amp; archive</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Report Builder

const buildInitialState = () => {
  const order = REPORT_SECTION_LIB.map(s => s.id);
  const sectionState = {};
  REPORT_SECTION_LIB.forEach(s => {
    sectionState[s.id] = {
      included: s.id !== 'changes' && s.id !== 'saturation', // 6 default
      story: s.story,
    };
  });
  return { order, sectionState };
};

const ReportBuilder = ({ client, onBack, onSent }) => {
  const [title, setTitle] = React.useState('Q1 2026 — Quarterly Performance');
  const [period, setPeriod] = React.useState('Jan – Mar 2026');
  const [type, setType] = React.useState('Quarterly');
  const [{ order, sectionState }, setBuild] = React.useState(buildInitialState);
  const [expanded, setExpanded] = React.useState('exec');
  const [showSend, setShowSend] = React.useState(false);

  const setSectionState = (id, patch) => {
    setBuild(prev => ({
      ...prev,
      sectionState: { ...prev.sectionState, [id]: { ...prev.sectionState[id], ...patch } }
    }));
  };

  const moveSection = (id, dir) => {
    setBuild(prev => {
      const i = prev.order.indexOf(id);
      const j = i + dir;
      if (j < 0 || j >= prev.order.length) return prev;
      const next = [...prev.order];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...prev, order: next };
    });
  };

  const sections = order.map(id => REPORT_SECTION_LIB.find(s => s.id === id));
  const includedCount = order.filter(id => sectionState[id].included).length;

  return (
    <div>
      {/* Builder header */}
      <div className="card" style={{ padding: '14px 18px', marginBottom: 16 }}>
        <div className="row-h" style={{ gap: 14 }}>
          <button onClick={onBack} className="theme-toggle" title="Back"><I.ArrowRight size={13} style={{ transform: 'rotate(180deg)' }} /></button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="input"
              style={{ background: 'transparent', border: 0, padding: 0, fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em', width: '100%' }}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <div className="row-h" style={{ gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
              <Tag kind="sky">DRAFT</Tag>
              <span className="dim mono" style={{ fontSize: 11 }}>{client.name.toUpperCase()} · v3 POSTERIOR · {includedCount} SECTIONS</span>
            </div>
          </div>
        </div>
        <div className="row-h" style={{ gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
          <div className="seg">
            {['Quarterly','Annual'].map(t => (
              <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(t)}>{t}</button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <Btn kind="ghost" leftIcon={<I.Eye size={12} />}>Preview fullscreen</Btn>
          <Btn kind="ghost">Save draft</Btn>
          <Btn kind="primary" leftIcon={<I.Send size={12} />} onClick={() => setShowSend(true)}>Send to client…</Btn>
        </div>
      </div>

      {/* Split: editor + preview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)', gap: 18, alignItems: 'flex-start' }}>
        {/* LEFT — section editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div className="card" style={{ padding: 14 }}>
            <div className="grid g2" style={{ gap: 14 }}>
              <div className="field"><label>Reporting period</label>
                <select className="input" value={period} onChange={e => setPeriod(e.target.value)}>
                  {['Jan – Mar 2026','Oct – Dec 2025','Jul – Sep 2025','Apr – Jun 2025','Jan – Dec 2025'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field"><label>Compared against</label>
                <select className="input">
                  {['Previous quarter','Same quarter last year','Trailing 12 months'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            </div>
          </div>

          <Callout icon={<I.Sparkles size={13} />}>
            <strong>Each section's story was drafted from the model — then it's yours.</strong> Edit the narrative
            inline, swap a chart, hide a section, or use Regenerate to pull a fresh draft from the latest posterior.
            Nothing leaves your hands until you click Send.
          </Callout>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sections.map((sec, i) => {
              const st = sectionState[sec.id];
              const includedIdx = order.slice(0, i + 1).filter(id => sectionState[id].included).length;
              return (
                <SectionEditor
                  key={sec.id}
                  sec={sec}
                  index={st.included ? includedIdx : '—'}
                  included={st.included}
                  story={st.story}
                  expanded={expanded === sec.id}
                  isFirst={i === 0}
                  isLast={i === sections.length - 1}
                  onToggle={() => setSectionState(sec.id, { included: !st.included })}
                  onStoryChange={(v) => setSectionState(sec.id, { story: v })}
                  onRegenerate={() => setSectionState(sec.id, { story: sec.story })}
                  onMove={(d) => moveSection(sec.id, d)}
                  onExpand={() => setExpanded(prev => prev === sec.id ? null : sec.id)}
                />
              );
            })}
          </div>

          <Btn kind="ghost" leftIcon={<I.Plus size={13} />}>Add custom section</Btn>
        </div>

        {/* RIGHT — live preview pane */}
        <div style={{ position: 'sticky', top: 78 }}>
          <div className="between" style={{ marginBottom: 8 }}>
            <div className="mono faint" style={{ fontSize: 10.5, letterSpacing: '0.14em' }}>LIVE PDF PREVIEW</div>
            <div className="row-h" style={{ gap: 6 }}>
              <Btn small kind="ghost" leftIcon={<I.Eye size={12} />}>Fullscreen</Btn>
              <Btn small kind="ghost" leftIcon={<I.Download size={12} />}>Download PDF</Btn>
            </div>
          </div>
          <div style={{ maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', borderRadius: 10, padding: 4 }}>
            <ReportPreview
              title={title}
              period={period}
              sections={REPORT_SECTION_LIB.filter(s => order.includes(s.id))}
              sectionState={sectionState}
              client={client}
            />
          </div>
        </div>
      </div>

      {showSend ? (
        <SendDialog
          title={title}
          recipientsDefault={['maya@aeonskincare.com','sam@aeonskincare.com']}
          onClose={() => setShowSend(false)}
          onSend={() => { setShowSend(false); onSent && onSent(); }}
        />
      ) : null}
    </div>
  );
};

// -----------------------------------------------------------------------------
// Top-level

const ReportsScreen = ({ client }) => {
  const [view, setView] = React.useState('archive');
  return view === 'archive'
    ? <ReportsArchive client={client} onNew={() => setView('builder')} onOpen={() => setView('builder')} />
    : <ReportBuilder client={client} onBack={() => setView('archive')} onSent={() => setView('archive')} />;
};

window.ReportsScreen = ReportsScreen;
