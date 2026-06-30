// POST /api/signal — the Signal chat backend. Two providers, one NDJSON contract:
//   - Anthropic (Claude): grounded via the hosted MCP connector (Anthropic runs the
//     Meridian tools server-side).
//   - Z.ai (GLM): the hosted MCP connector is Anthropic-only, so GLM is grounded by
//     exposing the SAME Meridian outputs as local tools, executed here against the
//     bundled posterior. Same numbers, same answer style.
// Streams NDJSON lines: {type:"model"|"tool"|"tool_result"|"text"|"done"|"error"}.
import Anthropic from '@anthropic-ai/sdk';
import aeon from '@/data/results.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MCP_BETA = 'mcp-client-2025-11-20';
const TURN_TIMEOUT_MS = 55_000;

// Model registry. provider routes the request; thinking enables Opus reasoning.
const MODELS = {
  'claude-sonnet-4-6': { provider: 'anthropic' },
  'claude-opus-4-8':   { provider: 'anthropic', thinking: true },
  'glm-4.7':           { provider: 'zai' },
  'glm-5':             { provider: 'zai' },
  'glm-5.1':           { provider: 'zai' },
};
const DEFAULT_MODEL = 'claude-sonnet-4-6';

const SYSTEM = `You are Signal — the senior growth strategist for the CMO of Aeon Skincare.
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
- The data is genuine Meridian output on a public simulated dataset; Aeon and the channel labels
  are a demo. Be honest if asked. Only answer marketing-measurement questions for this client.`;

// ── GLM grounding: the Meridian tools, executed locally against the bundled posterior.
const TOOLS = [
  { name: 'get_channel_contribution', description: 'Per-channel incremental revenue, contribution share, and ROI (median + 90% CI) from the fitted Meridian model.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_marginal_roi', description: 'Return on the next dollar of spend per channel (median + 90% CI).', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_response_curve', description: 'Saturation / response curve points for one channel.', input_schema: { type: 'object', properties: { channel: { type: 'string', description: 'channel name or id' } }, required: ['channel'] } },
  { name: 'optimize_budget', description: 'Optimal budget reallocation vs the current plan, with expected lift.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_model_health', description: 'Model convergence (R-hat) and holdout accuracy.', input_schema: { type: 'object', properties: {}, required: [] } },
];

function runTool(name, input) {
  const cl = aeon.meta?.confidence_level ?? 0.9;
  const wrap = (o) => ({ client: aeon.meta?.client, confidence_level: cl, ...o });
  if (name === 'get_channel_contribution') return wrap({ channels: aeon.channel_contribution });
  if (name === 'get_marginal_roi') return wrap({ channels: aeon.marginal_roi });
  if (name === 'get_model_health') return aeon.model_health || {};
  if (name === 'optimize_budget') return aeon.budget_optimization || {};
  if (name === 'get_response_curve') {
    const q = String(input?.channel || '').toLowerCase();
    const chans = aeon.channel_contribution || [];
    const m = chans.find((c) => c.channel_id?.toLowerCase() === q || c.channel?.toLowerCase() === q) || chans[0];
    const pts = (aeon.response_curves?.points || []).filter((p) => p.channel === m?.channel_id);
    return wrap({ channel: m?.channel, points: pts });
  }
  return { error: `unknown tool ${name}` };
}

// ── Anthropic (Claude) path: hosted MCP connector.
async function runAnthropic({ model, spec, messages, apiKey, mcpUrl, send, signal }) {
  const client = new Anthropic({ apiKey });
  const params = {
    model, max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages,
    mcp_servers: [{ type: 'url', url: mcpUrl, name: 'trifecta' }],
    tools: [{ type: 'mcp_toolset', mcp_server_name: 'trifecta' }],
    betas: [MCP_BETA],
    stream: true,
  };
  if (spec.thinking) params.thinking = { type: 'adaptive' };
  const events = await client.beta.messages.create(params, { signal });
  const toolNames = {};
  for await (const event of events) {
    if (event.type === 'content_block_start') {
      const block = event.content_block;
      if (block?.type === 'mcp_tool_use') {
        toolNames[block.id] = block.name;
        send({ type: 'tool', id: block.id, name: block.name, input: block.input });
      } else if (block?.type === 'mcp_tool_result') {
        const text = (block.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
        let data = null; try { data = JSON.parse(text); } catch { /* */ }
        send({ type: 'tool_result', id: block.tool_use_id, name: toolNames[block.tool_use_id], is_error: !!block.is_error, data });
      }
    } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      send({ type: 'text', text: event.delta.text });
    }
  }
}

// ── Z.ai (GLM) path: local tool loop against the bundled posterior.
async function runZai({ model, messages, send, signal }) {
  const client = new Anthropic({
    apiKey: process.env.ZAI_API_KEY,
    baseURL: process.env.ZAI_BASE_URL || 'https://api.z.ai/api/anthropic',
  });
  const convo = [...messages];
  for (let step = 0; step < 6; step++) {
    const resp = await client.messages.create({
      model, max_tokens: 2048, system: SYSTEM, messages: convo, tools: TOOLS,
    }, { signal });
    const toolUses = (resp.content || []).filter((b) => b.type === 'tool_use');
    if (resp.stop_reason === 'tool_use' && toolUses.length) {
      const results = [];
      for (const tu of toolUses) {
        send({ type: 'tool', id: tu.id, name: tu.name, input: tu.input });
        const data = runTool(tu.name, tu.input);
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
  const { messages, model: reqModel, deep } = await req.json();
  let model = MODELS[reqModel] ? reqModel : DEFAULT_MODEL;
  if (!MODELS[reqModel] && deep === true) model = 'claude-opus-4-8'; // back-compat with the old deep toggle
  const spec = MODELS[model];

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mcpUrl = process.env.MCP_SERVER_URL;
  if (spec.provider === 'anthropic' && (!apiKey || !mcpUrl)) return new Response('ANTHROPIC_API_KEY / MCP_SERVER_URL not set', { status: 500 });
  if (spec.provider === 'zai' && !process.env.ZAI_API_KEY) return new Response('ZAI_API_KEY not set', { status: 500 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'));
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TURN_TIMEOUT_MS);
      try {
        send({ type: 'model', model, advanced: !!spec.thinking });
        if (spec.provider === 'anthropic') {
          await runAnthropic({ model, spec, messages, apiKey, mcpUrl, send, signal: abort.signal });
        } else {
          await runZai({ model, messages, send, signal: abort.signal });
        }
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
