'use client';
// Signal — the working client-facing chat. Streams from /api/signal, which calls
// Claude with the Trifecta MCP server attached; answers are grounded in the
// fitted Meridian model and carry credible intervals.
import React from 'react';
import SignalArtifact from './SignalArtifact';
import { formatAsOf, ciLabel } from '../../lib/exportIntegrity';

const SUGGESTIONS = [
  'Which channels drive revenue?',
  'Optimise my budget',
  'Is TikTok saturated?',
  'What if I move $40M into Meta?',
  'How healthy is the model?',
];

const TOOL_LABELS = {
  get_channel_contribution: 'channel contribution',
  get_marginal_roi: 'marginal ROI',
  get_response_curve: 'response curve',
  run_budget_scenario: 'budget scenario',
  optimize_budget: 'budget optimiser',
  get_model_health: 'model health',
};

const MODEL_LABELS = {
  'claude-sonnet-4-6': 'Sonnet 4.6',
  'claude-opus-4-8': 'Opus 4.8',
};

export default function SignalChat({ client }) {
  const clientName = client?.name || 'Aeon Skincare';
  const [messages, setMessages] = React.useState([]); // {role, text, tools?: []}
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [deep, setDeep] = React.useState(false); // force Opus 4.8
  // Export-integrity provenance (brief §2): every chart/export carries the interval,
  // the as-of date and the model version. Sourced from the live model's results meta.
  const [provenance, setProvenance] = React.useState(null);
  const scrollRef = React.useRef(null);

  React.useEffect(() => {
    let on = true;
    fetch('/api/results')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!on || !j) return;
        const meta = j.meta || {};
        setProvenance({
          modelVersion: client?.version ? `${clientName} · ${client.version}` : 'live model',
          asOf: meta.generated_at || null,
          confidenceLevel: typeof meta.confidence_level === 'number' ? meta.confidence_level : 0.9,
        });
      })
      .catch(() => {});
    return () => { on = false; };
  }, [clientName, client?.version]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  async function ask(question) {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setBusy(true);

    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    const next = [...messages, { role: 'user', text: q }, { role: 'assistant', text: '', tools: [], artifacts: [], model: null }];
    setMessages(next);
    const aIdx = next.length - 1;

    const update = (fn) =>
      setMessages((cur) => {
        const copy = cur.slice();
        copy[aIdx] = fn(copy[aIdx]);
        return copy;
      });

    try {
      const res = await fetch('/api/signal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          let evt;
          try { evt = JSON.parse(line); } catch { continue; }
          if (evt.type === 'model') {
            update((m) => ({ ...m, model: evt.model, advanced: evt.advanced }));
          } else if (evt.type === 'tool') {
            update((m) => ({ ...m, tools: [...(m.tools || []), evt.name] }));
          } else if (evt.type === 'tool_result') {
            if (evt.data && !evt.is_error) {
              update((m) => ({ ...m, artifacts: [...(m.artifacts || []), { name: evt.name, data: evt.data }] }));
            }
          } else if (evt.type === 'text') {
            update((m) => ({ ...m, text: m.text + evt.text }));
          } else if (evt.type === 'error') {
            update((m) => ({ ...m, text: m.text + `\n\n⚠️ ${evt.message}` }));
          }
        }
      }
    } catch (e) {
      update((m) => ({ ...m, text: m.text || `⚠️ ${String(e.message || e)}` }));
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 860 }}>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 420 }}>
        <div className="card-head">
          <span className="logomark" style={{ width: 18, height: 18, flexBasis: 18 }} />
          <div>
            <h3>Signal · {clientName}</h3>
            <div className="sub">Grounded in the latest Meridian model · answers carry {ciLabel(provenance?.confidenceLevel) || '90% CI'}</div>
          </div>
          <div className="actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <span className="tag mint">● LIVE{client?.version ? ' · ' + client.version : ''}</span>
            {provenance?.asOf && formatAsOf(provenance.asOf) ? (
              <span className="faint mono" style={{ fontSize: 9.5 }} title="When the live model was last refreshed">
                refreshed {formatAsOf(provenance.asOf)}
              </span>
            ) : null}
          </div>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {empty ? (
            <div className="dim" style={{ margin: 'auto', textAlign: 'center', maxWidth: 460 }}>
              <div className="display" style={{ fontSize: 18, color: 'var(--text)', marginBottom: 6 }}>Ask about your marketing performance</div>
              <div style={{ fontSize: 13 }}>Signal answers from the fitted MMM — contribution, ROI, saturation, and budget — always with the model's uncertainty.</div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                <Bubble m={m} busy={busy && i === messages.length - 1} />
                {m.role === 'assistant' && m.artifacts && m.artifacts.length ? (
                  <div>{m.artifacts.map((a, j) => <SignalArtifact key={j} name={a.name} data={a.data} provenance={provenance} />)}</div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--line)', padding: 12 }}>
          <div className="between" style={{ marginBottom: 10, gap: 8 }}>
            <div className="row-h" style={{ gap: 8, flexWrap: 'wrap' }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} className="btn ghost small" onClick={() => ask(s)} disabled={busy}>{s}</button>
              ))}
            </div>
            <label className="row-h" style={{ gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }} title="Force Claude Opus 4.8 for deeper reasoning (otherwise Sonnet 4.6 unless the question looks advanced)">
              <span className={'tog' + (deep ? ' on' : '')} onClick={() => setDeep((v) => !v)} role="switch" aria-checked={deep} />
              <span className="faint mono" style={{ fontSize: 10 }}>DEEP · OPUS</span>
            </label>
          </div>
          <form
            className="row-h"
            style={{ gap: 8 }}
            onSubmit={(e) => { e.preventDefault(); ask(); }}
          >
            <input
              className="input"
              placeholder={busy ? 'Signal is thinking…' : `Ask Signal about ${clientName}…`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
            />
            <button type="submit" className="btn primary" disabled={busy || !input.trim()}>Send</button>
          </form>
        </div>
      </div>
      <div className="faint mono" style={{ fontSize: 10.5 }}>
        Powered by Claude + the Trifecta MCP server · genuine Meridian outputs · fictional demo data.
      </div>
    </div>
  );
}

function Bubble({ m, busy }) {
  const isUser = m.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '78%' }}>
        {!isUser && m.tools && m.tools.length > 0 ? (
          <div className="row-h" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {m.tools.map((t, i) => (
              <span key={i} className="tag sky" style={{ fontSize: 9.5 }}>↳ {TOOL_LABELS[t] || t}</span>
            ))}
          </div>
        ) : null}
        <div
          style={{
            background: isUser ? 'rgba(79,110,242,0.14)' : 'var(--panel2)',
            border: '1px solid ' + (isUser ? 'rgba(79,110,242,0.4)' : 'var(--line)'),
            borderRadius: 10,
            padding: '10px 13px',
            fontSize: 13.5,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            color: 'var(--text)',
          }}
        >
          {m.text || (busy ? <span className="dim mono" style={{ fontSize: 12 }}>…</span> : '')}
        </div>
        {!isUser && m.model ? (
          <div className="faint mono" style={{ fontSize: 9.5, marginTop: 4 }}>
            {MODEL_LABELS[m.model] || m.model}{m.advanced ? ' · deep reasoning' : ''}
          </div>
        ) : null}
      </div>
    </div>
  );
}
