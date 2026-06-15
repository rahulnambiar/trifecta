// POST /api/signal — the Signal chat backend.
//
// Calls the Anthropic Messages API with the Trifecta MCP server attached via the
// MCP connector (mcp_servers + mcp_toolset, beta header mcp-client-2025-11-20).
// Claude calls the MCP tools server-side and answers grounded in the fitted
// Meridian model. The reply is streamed back to the chat UI as NDJSON lines:
//   {type:"tool", name}        — Claude invoked an MCP tool
//   {type:"text", text}        — a chunk of the answer
//   {type:"done"} | {type:"error", message}
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Cost-aware routing: Sonnet 4.6 handles the common "call a tool, explain the
// number" turns (cheaper + faster); Opus 4.8 is reserved for genuinely advanced
// questions (reasoning, strategy, comparison, multi-part) where its edge pays off.
const SONNET = process.env.SIGNAL_MODEL_DEFAULT || 'claude-sonnet-4-6';
const OPUS = process.env.SIGNAL_MODEL_ADVANCED || 'claude-opus-4-8';
const MCP_BETA = 'mcp-client-2025-11-20';

// Signals that a question wants reasoning/synthesis rather than a single lookup.
const ADVANCED_RE = /\b(why|because|recommend|recommendation|advice|advise|suggest|should\s+(i|we)|strateg|compare|comparison|versus|\bvs\b|explain|reason|trade[-\s]?off|prioriti[sz]|how\s+(should|would|do|can)\s+(i|we)|what\s+should|implication|forecast|predict|holistic|justify|defend|pros\s+and\s+cons|cut\s+and|and\s+why)\b/i;

function isAdvanced(text) {
  if (!text) return false;
  const questions = (text.match(/\?/g) || []).length;
  const words = text.trim().split(/\s+/).length;
  return ADVANCED_RE.test(text) || questions >= 2 || words > 40;
}

// Stable system prompt → cache it (prompt caching, prefix match).
const SYSTEM = `You are Signal — the senior growth strategist for the CMO of Aeon Skincare.
Think Bain/McKinsey partner: sharp, decisive, commercially fluent, never robotic. You are
backed by a fitted Bayesian marketing-mix model (Google Meridian) via the connected tools.

For ANY question about channel performance, ROI, marginal returns, saturation, budget
allocation, "what if" spend changes, or model trustworthiness, you MUST call the right tool
first — the numbers come from the model, never from memory.
Tools: get_channel_contribution, get_marginal_roi, get_response_curve, run_budget_scenario,
optimize_budget, get_model_health.

HOW TO ANSWER (this is what makes the CMO trust you):
- Lead with the decision/headline in ONE bold sentence. No preamble. Never say "Let me pull…",
  "Sure", "Here's…", and never restate the question.
- Then 2–4 tight points — short markdown bullets, each a crisp insight with the number and its
  90% credible interval, e.g. "**Paid Search** returns **$2.80** per $1, 90% CI $2.1–3.4".
- Close with one **So what** line: the concrete move you'd make.
- Keep it scannable on a phone. Bold the numbers that matter. No walls of text, no raw tables
  unless explicitly asked, no JSON, no restating tool output verbatim.
- Always carry the credible interval; never present a point estimate as certainty. If the
  interval is wide or model health is shaky (high R-hat), say so plainly and hedge the call.
- Money is in the model's revenue units; format readably ($57M, $2.8M).
- Talk like a trusted advisor in the room — confident, specific, a little opinionated. Make the
  CMO feel they're getting elite counsel, not a chatbot.
- The data is genuine Meridian output on a public simulated dataset; Aeon and the channel labels
  are a demo. Be honest if asked. Only answer marketing-measurement questions for this client;
  politely decline anything else.`;

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mcpUrl = process.env.MCP_SERVER_URL;
  if (!apiKey) return new Response('ANTHROPIC_API_KEY not set', { status: 500 });
  if (!mcpUrl) return new Response('MCP_SERVER_URL not set', { status: 500 });

  const { messages, deep } = await req.json();
  const client = new Anthropic({ apiKey });

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const advanced = deep === true || isAdvanced(typeof lastUser?.content === 'string' ? lastUser.content : '');
  const model = advanced ? OPUS : SONNET;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'));
      try {
        send({ type: 'model', model, advanced });
        const params = {
          model,
          max_tokens: 4096,
          system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
          messages,
          mcp_servers: [{ type: 'url', url: mcpUrl, name: 'trifecta' }],
          tools: [{ type: 'mcp_toolset', mcp_server_name: 'trifecta' }],
          betas: [MCP_BETA],
          stream: true,
        };
        // Let Opus reason on advanced questions (thinking stays server-side; only
        // the final answer text streams to the user).
        if (advanced) params.thinking = { type: 'adaptive' };
        const events = await client.beta.messages.create(params);

        const toolNames = {}; // tool_use id -> tool name
        for await (const event of events) {
          if (event.type === 'content_block_start') {
            const block = event.content_block;
            if (block?.type === 'mcp_tool_use') {
              toolNames[block.id] = block.name;
              send({ type: 'tool', id: block.id, name: block.name, input: block.input });
            } else if (block?.type === 'mcp_tool_result') {
              const text = (block.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
              let data = null;
              try { data = JSON.parse(text); } catch { /* non-JSON result */ }
              send({
                type: 'tool_result',
                id: block.tool_use_id,
                name: toolNames[block.tool_use_id],
                is_error: !!block.is_error,
                data,
              });
            }
          } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            send({ type: 'text', text: event.delta.text });
          }
        }
        send({ type: 'done' });
      } catch (err) {
        send({ type: 'error', message: err?.message || String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
