'use client';
// Signal — the client-facing decision chat. Streams from /api/signal (Claude + the
// Trifecta MCP server). Answers are grounded in the fitted Meridian model and rendered
// as clean markdown so they read like a consultant's note, not a text dump.
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SignalArtifact from './SignalArtifact';
import SignalOverview from './SignalOverview';
import { formatAsOf, ciLabel } from '../../lib/exportIntegrity';
import { useBrand } from '../../lib/brand';

const SUGGESTIONS = [
  'Which channels drive revenue?',
  'Where should I move budget?',
  'Is TikTok saturated?',
  'How much can I cut without hurting sales?',
];
const TOOL_LABELS = {
  get_channel_contribution: 'channel contribution', get_marginal_roi: 'marginal ROI',
  get_response_curve: 'response curve', run_budget_scenario: 'budget scenario',
  optimize_budget: 'budget optimiser', get_model_health: 'model health',
};
const MODEL_LABELS = {
  'claude-sonnet-4-6': 'Sonnet 4.6', 'claude-opus-4-8': 'Opus 4.8',
  'glm-4.7': 'GLM-4.7', 'glm-5': 'GLM-5', 'glm-5.1': 'GLM-5.1', 'glm-5.2': 'GLM-5.2',
};

function getRecognition() {
  if (typeof window === 'undefined') return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SR ? new SR() : null;
}

export default function SignalChat({ client, surface = 'operator', email, theme, setTheme, onSignOut }) {
  const cmo = surface === 'cmo';
  const brand = useBrand();
  const BrandMark = ({ size }) => brand.logoSrc
    ? <img src={brand.logoSrc} alt={brand.name} style={{ width: size, height: size, borderRadius: size * 0.24, objectFit: 'contain' }} />
    : <span className="logomark" style={{ width: size, height: size, flexBasis: size }} />;
  const clientName = client?.name || 'Aeon Skincare';
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [model, setModel] = React.useState('claude-sonnet-4-6');
  const [provenance, setProvenance] = React.useState(null);
  const [listening, setListening] = React.useState(false);
  const [followups, setFollowups] = React.useState([]);
  const [conversations, setConversations] = React.useState([]);
  const [convoId, setConvoId] = React.useState(null);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [overviewOpen, setOverviewOpen] = React.useState(false);
  const [guideOpen, setGuideOpen] = React.useState(false);
  const clientUuid = client?.dbId;
  const scrollRef = React.useRef(null);

  // First-run guide: show a one-time welcome the first time a user opens Signal.
  // Remembered per user in the browser, so it never nags on return visits.
  const guideKey = `trifecta.signalGuide.v1.${email || 'anon'}`;
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try { if (!window.localStorage.getItem(guideKey)) setGuideOpen(true); } catch { /* */ }
  }, [guideKey]);
  const dismissGuide = () => {
    try { window.localStorage.setItem(guideKey, '1'); } catch { /* */ }
    setGuideOpen(false);
  };

  const loadConversations = React.useCallback(async () => {
    if (!clientUuid) return;
    try {
      const r = await fetch(`/api/signal/conversations?client_id=${clientUuid}`);
      if (r.ok) { const j = await r.json(); setConversations(j.conversations || []); }
    } catch { /* */ }
  }, [clientUuid]);
  React.useEffect(() => { loadConversations(); }, [loadConversations]);

  const newChat = () => { setMessages([]); setConvoId(null); setFollowups([]); setHistoryOpen(false); };
  const openConversation = async (id) => {
    try {
      const r = await fetch(`/api/signal/messages?conversation_id=${id}`);
      if (!r.ok) return;
      const j = await r.json();
      setMessages((j.messages || []).map((m) => ({ role: m.role, text: m.content || '', tools: [], artifacts: m.artifacts || [], model: null })));
      setConvoId(id); setFollowups([]); setHistoryOpen(false);
    } catch { /* */ }
  };
  const deleteConversation = async (id) => {
    try { await fetch(`/api/signal/conversations?id=${id}`, { method: 'DELETE' }); } catch { /* */ }
    if (id === convoId) newChat();
    loadConversations();
  };
  const persistMessage = (cid, role, content, artifacts) => {
    if (!cid) return;
    fetch('/api/signal/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conversation_id: cid, role, content, artifacts: artifacts && artifacts.length ? artifacts : null }) }).catch(() => {});
  };
  const taRef = React.useRef(null);
  const recRef = React.useRef(null);
  const micSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  React.useEffect(() => {
    let on = true;
    fetch('/api/results?slug=' + encodeURIComponent(client?.id || 'aeon')).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!on || !j) return;
      const meta = j.meta || {};
      setProvenance({
        modelVersion: client?.version ? `${clientName} · ${client.version}` : `${clientName} · live`,
        asOf: meta.generated_at || null,
        confidenceLevel: typeof meta.confidence_level === 'number' ? meta.confidence_level : 0.9,
      });
    }).catch(() => {});
    return () => { on = false; };
  }, [clientName, client?.version]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  React.useEffect(() => {
    const ta = taRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'; }
  }, [input]);

  async function ask(question) {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);
    setFollowups([]);
    let assistantText = '';
    let assistantArtifacts = [];
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const next = [...messages, { role: 'user', text: q }, { role: 'assistant', text: '', tools: [], artifacts: [], model: null }];
    setMessages(next);
    const aIdx = next.length - 1;
    const update = (fn) => setMessages((cur) => { const c = cur.slice(); c[aIdx] = fn(c[aIdx]); return c; });

    // Ensure a saved conversation exists, then persist the question (history).
    let cid = convoId;
    if (clientUuid && !cid) {
      try {
        const cr = await fetch('/api/signal/conversations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: clientUuid, title: q.slice(0, 80) }) });
        if (cr.ok) { cid = (await cr.json()).conversation.id; setConvoId(cid); }
      } catch { /* */ }
    }
    if (cid) persistMessage(cid, 'user', q);

    try {
      const res = await fetch('/api/signal', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: q }], model, client: client?.id }),
      });
      if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt; try { evt = JSON.parse(line); } catch { continue; }
          if (evt.type === 'model') update((m) => ({ ...m, model: evt.model, advanced: evt.advanced }));
          else if (evt.type === 'tool') update((m) => ({ ...m, tools: [...(m.tools || []), evt.name] }));
          else if (evt.type === 'tool_result') { if (evt.data && !evt.is_error) { assistantArtifacts.push({ name: evt.name, data: evt.data }); update((m) => ({ ...m, artifacts: [...(m.artifacts || []), { name: evt.name, data: evt.data }] })); } }
          else if (evt.type === 'text') { assistantText += evt.text; update((m) => ({ ...m, text: m.text + evt.text })); }
          else if (evt.type === 'error') update((m) => ({ ...m, text: m.text + `\n\n⚠️ ${evt.message}` }));
        }
      }
      if (cid) { persistMessage(cid, 'assistant', assistantText, assistantArtifacts); loadConversations(); }
      // contextual follow-ups — propose the CMO's next questions
      const convo = [...history, { role: 'user', content: q }, { role: 'assistant', content: assistantText }];
      fetch('/api/signal/followups', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: convo }) })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (j && Array.isArray(j.followups) && j.followups.length) setFollowups(j.followups); })
        .catch(() => {});
    } catch (e) {
      update((m) => ({ ...m, text: m.text || `⚠️ ${String(e.message || e)}` }));
    } finally { setBusy(false); }
  }

  function toggleMic() {
    if (listening) { try { recRef.current?.stop(); } catch { /* */ } return; }
    const rec = getRecognition();
    if (!rec) return;
    const base = input ? input.trim() + ' ' : '';
    rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (e) => setInput(base + Array.from(e.results).map((r) => r[0].transcript).join(''));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec; setListening(true);
    try { rec.start(); } catch { setListening(false); }
  }

  const empty = messages.length === 0;
  const freshness = provenance
    ? [ciLabel(provenance.confidenceLevel) || '90% CI', client?.version ? `model ${client.version}` : null,
       provenance.asOf && formatAsOf(provenance.asOf) ? `refreshed ${formatAsOf(provenance.asOf)}` : null].filter(Boolean).join('  ·  ')
    : null;

  return (
    <div className="signal-wrap">
      <div className={'card signal-card' + (cmo ? ' cmo' : '')}>
        {cmo ? (
          <>
            <header className="signal-header">
              <div className="signal-brand">
                <BrandMark size={26} />
                <div className="signal-brand-text">
                  <div className="bn">{brand.name}</div>
                  <div className="bf">Signal · {clientName}</div>
                </div>
              </div>
              <div className="signal-header-actions">
                <button className="signal-iconbtn-sm" onClick={() => setOverviewOpen(true)} title="Snapshot" aria-label="Snapshot"><ChartIcon /></button>
                <button className="signal-iconbtn-sm" onClick={() => setHistoryOpen(true)} title="Your chats" aria-label="Chats"><ListIcon /></button>
                <button className="signal-iconbtn-sm" onClick={() => setGuideOpen(true)} title="How to use Signal" aria-label="Help">?</button>
                <button className="signal-iconbtn-sm" onClick={newChat} title="New chat" aria-label="New chat"><PlusIcon /></button>
                {setTheme ? <button className="signal-iconbtn-sm" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="Theme" aria-label="Theme">{theme === 'dark' ? '☀' : '☾'}</button> : null}
                {onSignOut ? <button className="signal-iconbtn-sm" onClick={onSignOut} title="Sign out" aria-label="Sign out"><SignOutIcon /></button> : null}
              </div>
            </header>
            {freshness ? <div className="signal-fresh-line"><span className="live-dot" /> {freshness}</div> : null}
          </>
        ) : (
          <div className="card-head">
            <BrandMark size={18} />
            <div>
              <h3>Signal · {clientName}</h3>
              <div className="sub">Grounded in the latest Meridian model · answers carry {ciLabel(provenance?.confidenceLevel) || '90% CI'}</div>
            </div>
            <div className="actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn ghost small" onClick={() => setGuideOpen(true)}>Guide</button>
              <button className="btn ghost small" onClick={() => setOverviewOpen(true)}>Snapshot</button>
              <button className="btn ghost small" onClick={() => setHistoryOpen(true)}>History</button>
              <button className="btn ghost small" onClick={newChat}>New</button>
              <span className="tag mint">● LIVE{client?.version ? ' · ' + client.version : ''}</span>
            </div>
          </div>
        )}

        <div ref={scrollRef} className="signal-msgs">
          {empty ? (
            <div className="signal-landing">
              <SignalOverview clientName={clientName} slug={client?.id} />
              <div className="signal-ask-cue">
                <div className="display" style={{ fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>Ask {clientName}'s model anything</div>
                <div className="dim" style={{ fontSize: 12.5, marginBottom: 12, lineHeight: 1.5 }}>
                  Grounded in the live model — every answer carries its 90% credible interval.
                </div>
                <div className="signal-starters">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="signal-starter" onClick={() => ask(s)} disabled={busy}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                <Bubble m={m} busy={busy && i === messages.length - 1} cmo={cmo} />
                {m.role === 'assistant' && m.artifacts && m.artifacts.length ? (
                  <div>{m.artifacts.map((a, j) => <SignalArtifact key={j} name={a.name} data={a.data} provenance={provenance} cmo={cmo} />)}</div>
                ) : null}
              </div>
            ))
          )}
          {!empty && !busy && followups.length ? (
            <div className="signal-followups">
              {followups.map((f, i) => (
                <button key={i} className="signal-followup" onClick={() => ask(f)}>
                  <span className="fu-arrow">↳</span> {f}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="signal-foot">
          <div className="between" style={{ marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
            <div className="row-h" style={{ gap: 6, flexWrap: 'wrap' }}>
              {!cmo ? SUGGESTIONS.map((s) => <button key={s} className="btn ghost small" onClick={() => ask(s)} disabled={busy}>{s}</button>) : null}
            </div>
            <label className="row-h" style={{ gap: 6, whiteSpace: 'nowrap' }} title="Model used to answer (all grounded in the Meridian model)">
              <span className="faint mono" style={{ fontSize: 9.5 }}>MODEL</span>
              <select value={model} onChange={(e) => setModel(e.target.value)} disabled={busy}
                style={{ fontSize: 11, padding: '3px 6px', borderRadius: 6, border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text)' }}>
                <optgroup label="Claude">
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                  <option value="claude-opus-4-8">Claude Opus 4.8</option>
                </optgroup>
                <optgroup label="GLM · Z.ai">
                  <option value="glm-4.7">GLM-4.7</option>
                  <option value="glm-5">GLM-5</option>
                  <option value="glm-5.1">GLM-5.1</option>
                  <option value="glm-5.2">GLM-5.2</option>
                </optgroup>
              </select>
            </label>
          </div>
          <form className="signal-input" onSubmit={(e) => { e.preventDefault(); ask(); }}>
            {micSupported ? (
              <button type="button" className={'signal-icon-btn' + (listening ? ' on' : '')} onClick={toggleMic}
                title={listening ? 'Stop' : 'Dictate'} aria-label="Dictate">
                <MicIcon />
              </button>
            ) : null}
            <textarea
              ref={taRef} rows={1}
              placeholder={busy ? 'Signal is thinking…' : `Ask about ${clientName}…`}
              value={input} disabled={busy}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
            />
            <button type="submit" className="signal-icon-btn send" disabled={busy || !input.trim()} aria-label="Send"><SendIcon /></button>
          </form>
        </div>

        {guideOpen ? (
          <div
            onClick={dismissGuide}
            style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(8,12,20,0.55)', backdropFilter: 'blur(2px)' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: 'min(440px, 100%)', background: 'var(--panel)', border: '1px solid var(--line, rgba(140,150,170,0.22))', borderRadius: 16, padding: '22px 22px 18px', boxShadow: '0 24px 60px rgba(0,0,0,0.32)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <BrandMark size={22} />
                <div className="display" style={{ fontSize: 17, color: 'var(--text)' }}>Welcome to Signal</div>
              </div>
              <div className="dim" style={{ fontSize: 12.5, marginBottom: 16, lineHeight: 1.5 }}>
                Ask {clientName}'s model anything. Here is how it works.
              </div>
              {[
                ['1', 'Ask in plain language', 'Type a question like "Which channels drive revenue?", or tap a suggested prompt. No dashboards to learn.'],
                ['2', 'Answers you can trust', 'Every reply reads your live model and shows the number with its 90% confidence range, plus the chart behind it.'],
                ['3', 'Your chats are saved', 'Reopen any past chat from the chats list and continue right where you left off.'],
              ].map(([n, h, b]) => (
                <div key={n} style={{ display: 'flex', gap: 11, marginBottom: 13 }}>
                  <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, background: 'var(--blue)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{h}</div>
                    <div className="dim" style={{ fontSize: 12, lineHeight: 1.45 }}>{b}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button className="btn primary small" style={{ flex: 1 }} onClick={() => { dismissGuide(); ask(SUGGESTIONS[0]); }}>Try an example</button>
                <button className="btn ghost small" onClick={dismissGuide}>Explore on my own</button>
              </div>
            </div>
          </div>
        ) : null}

        {overviewOpen ? (
          <div className="signal-sheet-backdrop" onClick={() => setOverviewOpen(false)}>
            <div className="signal-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="signal-sheet-head">
                <span style={{ fontWeight: 700, fontSize: 14 }}>Marketing snapshot</span>
                <button className="signal-iconbtn-sm" onClick={() => setOverviewOpen(false)} aria-label="Close"><CloseIcon /></button>
              </div>
              <div className="signal-sheet-body"><SignalOverview clientName={clientName} slug={client?.id} /></div>
            </div>
          </div>
        ) : null}

        {historyOpen ? (
          <div className="signal-history-backdrop" onClick={() => setHistoryOpen(false)}>
            <div className="signal-history" onClick={(e) => e.stopPropagation()}>
              <div className="signal-history-head">
                <span style={{ fontWeight: 700, fontSize: 14 }}>Your chats</span>
                <button className="btn primary small" onClick={newChat}>+ New chat</button>
              </div>
              <div className="signal-history-list">
                {conversations.length ? conversations.map((c) => (
                  <div key={c.id} className={'signal-history-item' + (c.id === convoId ? ' active' : '')} onClick={() => openConversation(c.id)}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="title">{c.title || 'Untitled chat'}</div>
                      <div className="date">{new Date(c.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    </div>
                    <button className="signal-history-del" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }} aria-label="Delete chat">×</button>
                  </div>
                )) : <div className="dim" style={{ padding: 14, fontSize: 12.5 }}>No saved chats yet — ask a question to start one.</div>}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      {!cmo ? (
        <div className="faint mono signal-hide-sm" style={{ fontSize: 10.5 }}>
          {brand.poweredBy}
        </div>
      ) : null}
    </div>
  );
}

function Bubble({ m, busy, cmo }) {
  const isUser = m.role === 'user';
  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="signal-bubble-row"><div className="signal-user-bubble">{m.text}</div></div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div className="signal-answer-row">
        {!cmo && m.tools && m.tools.length ? (
          <div className="row-h" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {m.tools.map((t, i) => <span key={i} className="tag sky" style={{ fontSize: 9.5 }}>↳ {TOOL_LABELS[t] || t}</span>)}
          </div>
        ) : null}
        <div className="signal-answer md">
          {m.text ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
            : (busy ? <span className="signal-typing"><i /><i /><i /></span> : '')}
        </div>
        {!cmo && m.model ? (
          <div className="faint mono" style={{ fontSize: 9.5, marginTop: 4 }}>{MODEL_LABELS[m.model] || m.model}{m.advanced ? ' · deep reasoning' : ''}</div>
        ) : null}
      </div>
    </div>
  );
}

function MicIcon() {
  return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 19v3" /></svg>);
}
function SendIcon() {
  return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
}
function ListIcon() {
  return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>);
}
function PlusIcon() {
  return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>);
}
function SignOutIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>);
}
function ChartIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18M8 17V9M13 17V5M18 17v-6" /></svg>);
}
function CloseIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>);
}
