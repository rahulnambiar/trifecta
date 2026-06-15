'use client';
// Signal — the client-facing decision chat. Streams from /api/signal (Claude + the
// Trifecta MCP server). Answers are grounded in the fitted Meridian model and rendered
// as clean markdown so they read like a consultant's note, not a text dump.
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SignalArtifact from './SignalArtifact';
import { formatAsOf, ciLabel } from '../../lib/exportIntegrity';

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
const MODEL_LABELS = { 'claude-sonnet-4-6': 'Sonnet 4.6', 'claude-opus-4-8': 'Opus 4.8' };

function getRecognition() {
  if (typeof window === 'undefined') return null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return SR ? new SR() : null;
}

export default function SignalChat({ client, surface = 'operator' }) {
  const cmo = surface === 'cmo';
  const clientName = client?.name || 'Aeon Skincare';
  const [messages, setMessages] = React.useState([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [deep, setDeep] = React.useState(false);
  const [provenance, setProvenance] = React.useState(null);
  const [listening, setListening] = React.useState(false);
  const scrollRef = React.useRef(null);
  const taRef = React.useRef(null);
  const recRef = React.useRef(null);
  const micSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  React.useEffect(() => {
    let on = true;
    fetch('/api/results').then((r) => (r.ok ? r.json() : null)).then((j) => {
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
    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const next = [...messages, { role: 'user', text: q }, { role: 'assistant', text: '', tools: [], artifacts: [], model: null }];
    setMessages(next);
    const aIdx = next.length - 1;
    const update = (fn) => setMessages((cur) => { const c = cur.slice(); c[aIdx] = fn(c[aIdx]); return c; });
    try {
      const res = await fetch('/api/signal', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: q }], deep }),
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
          else if (evt.type === 'tool_result') { if (evt.data && !evt.is_error) update((m) => ({ ...m, artifacts: [...(m.artifacts || []), { name: evt.name, data: evt.data }] })); }
          else if (evt.type === 'text') update((m) => ({ ...m, text: m.text + evt.text }));
          else if (evt.type === 'error') update((m) => ({ ...m, text: m.text + `\n\n⚠️ ${evt.message}` }));
        }
      }
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
          freshness ? <div className="signal-fresh"><span className="live-dot" /> {freshness}</div> : <div className="signal-fresh" />
        ) : (
          <div className="card-head">
            <span className="logomark" style={{ width: 18, height: 18, flexBasis: 18 }} />
            <div>
              <h3>Signal · {clientName}</h3>
              <div className="sub">Grounded in the latest Meridian model · answers carry {ciLabel(provenance?.confidenceLevel) || '90% CI'}</div>
            </div>
            <div className="actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <span className="tag mint">● LIVE{client?.version ? ' · ' + client.version : ''}</span>
              {provenance?.asOf && formatAsOf(provenance.asOf) ? (
                <span className="faint mono" style={{ fontSize: 9.5 }}>refreshed {formatAsOf(provenance.asOf)}</span>
              ) : null}
            </div>
          </div>
        )}

        <div ref={scrollRef} className="signal-msgs">
          {empty ? (
            <div className="signal-empty">
              <div className="display" style={{ fontSize: cmo ? 22 : 18, color: 'var(--text)', marginBottom: 8 }}>
                {cmo ? `Ask about ${clientName}'s growth` : 'Ask about your marketing performance'}
              </div>
              <div className="dim" style={{ fontSize: 13.5, lineHeight: 1.5, maxWidth: 420 }}>
                Signal reads the fitted marketing-mix model — what's driving revenue, where the next dollar works hardest, and what happens if you move budget. Every answer carries the model's uncertainty.
              </div>
              <div className="signal-starters">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="signal-starter" onClick={() => ask(s)} disabled={busy}>{s}</button>
                ))}
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
        </div>

        <div className="signal-foot">
          {!cmo ? (
            <div className="between" style={{ marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
              <div className="row-h" style={{ gap: 6, flexWrap: 'wrap' }}>
                {SUGGESTIONS.map((s) => <button key={s} className="btn ghost small" onClick={() => ask(s)} disabled={busy}>{s}</button>)}
              </div>
              <label className="row-h" style={{ gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }} title="Force Claude Opus 4.8 for deeper reasoning">
                <span className={'tog' + (deep ? ' on' : '')} onClick={() => setDeep((v) => !v)} role="switch" aria-checked={deep} />
                <span className="faint mono" style={{ fontSize: 10 }}>DEEP · OPUS</span>
              </label>
            </div>
          ) : null}
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
      </div>
      {!cmo ? (
        <div className="faint mono signal-hide-sm" style={{ fontSize: 10.5 }}>
          Powered by Claude + the Trifecta MCP server · genuine Meridian outputs · fictional demo data.
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
