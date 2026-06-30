// POST /api/signal — the Signal chat backend. Provider- and client-aware, ONE source.
//
// Every model (Claude or GLM) is grounded the same way: a local tool loop over the
// Meridian outputs read from the active client's posterior bundle — the SAME file
// /api/results and the Results screen use. So Signal numbers always match the Results
// screen and match across models. (The hosted MCP connector was a second source and
// is Anthropic-only, so it's no longer in the path.)
// Streams NDJSON: {type:"model"|"tool"|"tool_result"|"text"|"done"|"error"}.
import Anthropic from '@anthropic-ai/sdk';
import aeon from '@/data/results.json';
import claritin from '@/data/claritin-results.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const TURN_TIMEOUT_MS = 55_000;

// Per-client posterior bundles — the single source of truth, shared with /api/results.
const BUNDLES = { aeon, claritin };

const MODELS = {
  'claude-sonnet-4-6': { provider: 'anthropic' },
  'claude-opus-4-8':   { provider: 'anthropic' },
  'glm-4.7':           { provider: 'zai' },
  'glm-5':             { provider: 'zai' },
  'glm-5.1':           { provider: 'zai' },
  'glm-5.2':           { provider: 'zai' },
};
const DEFAULT_MODEL = 'claude-sonnet-4-6';

function systemFor(bundle) {
  const name = bundle?.meta?.client || 'this brand';
  return `You are Signal — the senior growth strategist for the CMO of ${name}.
Think Bain/McKinsey partner: sharp, decisive, commercially fluent, never robotic. You are
backed by a fitted Bayesian marketing-mix model (Google Meridian) via the connected tools.

For ANY question about channel performance, ROI, marginal returns, saturation, budget
allocation, "what if" spend changes, or model trustworthiness, you MUST call the right tool
first — the numbers come from the model, never from memory.
Tools: get_channel_contribution, get_marginal_roi, get_response_curve, optimize_budget,
get_model_health.

HOW TO ANSWER (this is what makes the CMO trust you):
- Lead with the decision/headline in ONE bold sentence. No preamble. Never say "Let me pull…",
  "Sure", "Here's…", and never restate the question.
- Then 2–4 tight points — short markdown bullets, each a crisp insight with the number and its
  90% credible interval, e.g. "**Paid Search** returns **$2.80** per $1, 90% CI $2.1–3.4".
- Close with one **So what** line: the concrete move you'd make.
- Keep it scannable on a phone. Bold the numbers that matter. No walls of text, no raw tables
  unless explicitly asked, no JSON, no restating tool output verbatim.
- Always carry the credible interval; never present a point estimate as certainty.
- Money is in the model's revenue units; format readably ($57M, $2.8M).
- The data is genuine Meridian output on representative data; ${name} and the channel labels
  are a demo. Be honest if asked. Only answer marketing-measurement questions for this client.`;
}

// The Meridian tools, executed locally against the active client's bundle.
const TOOLS = [
  { name: 'get_channel_contribution', description: 'Per-channel incremental revenue, contribution share, and ROI (median + 90% CI) from the fitted Meridian model.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_marginal_roi', description: 'Return on the next dollar of spend per channel (median + 90% CI).', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_response_curve', description: 'Saturation / response curve points for one channel.', input_schema: { type: 'object', properties: { channel: { type: 'string', description: 'channel name or id' } }, required: ['channel'] } },
  { name: 'optimize_budget', description: 'Optimal budget reallocation vs the current plan, with expected lift.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_model_health', description: 'Model convergence (R-hat) and holdout accuracy.', input_schema: { type: 'object', properties: {}, required: [] } },
];

function runTool(name, input, bundle) {
  const cl = bundle.meta?.confidence_level ?? 0.9;
  const wrap = (o) => ({ client: bundle.meta?.client, confidence_level: cl, ...o });
  if (name === 'get_channel_contribution') return wrap({ channels: bundle.channel_contribution });
  if (name === 'get_marginal_roi') return wrap({ channels: bundle.marginal_roi });
  if (name === 'get_model_health') return bundle.model_health || {};
  if (name === 'optimize_budget') return bundle.budget_optimization || {};
  if (name === 'get_response_curve') {
    const q = String(input?.channel || '').toLowerCase();
    const chans = bundle.channel_contribution || [];
    const m = chans.find((c) => c.channel_id?.toLowerCase() === q || c.channel?.toLowerCase() === q) || chans[0];
    const pts = (bundle.response_curves?.points || []).filter((p) => p.channel === m?.channel_id);
    return wrap({ channel: m?.channel, points: pts });
  }
  return { error: `unknown tool ${name}` };
}

// Generic tool loop — works with any Anthropic-compatible client (Claude via the
// Anthropic API, or GLM via Z.ai's Anthropic-compatible endpoint).
// Put a cache breakpoint on the last block of the conversation, so the growing
// system+tools+history prefix is cached and re-read across turns and across the
// user's successive questions. (No effect until the prefix exceeds the model's
// cache minimum — Sonnet 2048 / Opus 4096 tokens — so short single-tool queries
// don't benefit, but long conversations do.) Both Anthropic and Z.ai honor it.
function cacheLastBlock(messages) {
  if (!messages.length) return messages;
  const out = messages.slice();
  const i = out.length - 1;
  const m = out[i];
  const cc = { type: 'ephemeral' };
  if (typeof m.content === 'string') {
    out[i] = { ...m, content: [{ type: 'text', text: m.content, cache_control: cc }] };
  } else if (Array.isArray(m.content) && m.content.length) {
    const c = m.content.slice();
    c[c.length - 1] = { ...c[c.length - 1], cache_control: cc };
    out[i] = { ...m, content: c };
  }
  return out;
}

async function runLocalTools({ api, model, messages, send, signal, bundle }) {
  const system = [{ type: 'text', text: systemFor(bundle), cache_control: { type: 'ephemeral' } }];
  const convo = [...messages];
  for (let step = 0; step < 6; step++) {
    const resp = await api.messages.create({ model, max_tokens: 2048, system, messages: cacheLastBlock(convo), tools: TOOLS }, { signal });
    const toolUses = (resp.content || []).filter((b) => b.type === 'tool_use');
    if (resp.stop_reason === 'tool_use' && toolUses.length) {
      const results = [];
      for (const tu of toolUses) {
        send({ type: 'tool', id: tu.id, name: tu.name, input: tu.input });
        const data = runTool(tu.name, tu.input, bundle);
        send({ type: 'tool_result', id: tu.id, name: tu.name, is_error: false, data });
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(data) });
      }
      convo.push({ role: 'assistant', content: resp.content });
      convo.push({ role: 'user', content: results });
      continue;
    }
    const text = (resp.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (text) send({ type: 'text', text });
    return;
  }
  send({ type: 'text', text: '_(stopped after several tool steps)_' });
}

export async function POST(req) {
  const { messages, model: reqModel, deep, client: reqClient } = await req.json();
  let model = MODELS[reqModel] ? reqModel : DEFAULT_MODEL;
  if (!MODELS[reqModel] && deep === true) model = 'claude-opus-4-8'; // back-compat with the old deep toggle
  const spec = MODELS[model];
  const slug = BUNDLES[reqClient] ? reqClient : 'aeon';
  const bundle = BUNDLES[slug];

  if (spec.provider === 'zai' && !process.env.ZAI_API_KEY) return new Response('ZAI_API_KEY not set', { status: 500 });
  if (spec.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) return new Response('ANTHROPIC_API_KEY not set', { status: 500 });

  const api = spec.provider === 'zai'
    ? new Anthropic({ apiKey: process.env.ZAI_API_KEY, baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/anthropic' })
    : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'));
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TURN_TIMEOUT_MS);
      try {
        send({ type: 'model', model, advanced: false });
        await runLocalTools({ api, model, messages, send, signal: abort.signal, bundle });
        send({ type: 'done' });
      } catch (err) {
        const aborted = abort.signal.aborted || err?.name === 'AbortError';
        send({
          type: 'error',
          message: aborted
            ? 'That one took too long. Try a more specific question, or a faster model.'
            : (err?.message || String(err)),
        });
      } finally {
        clearTimeout(timer);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
}
