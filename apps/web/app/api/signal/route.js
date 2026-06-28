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

// Routing: the fast model (Sonnet 4.6) handles every turn by default. Opus 4.8 is
// used ONLY when the user explicitly flips the "deep reasoning" toggle — auto-
// escalating common questions to Opus + thinking is what pushed turns past the
// timeout and left the chat "not responding".
const SONNET = process.env.SIGNAL_MODEL_DEFAULT || 'claude-sonnet-4-6';
const OPUS = process.env.SIGNAL_MODEL_ADVANCED || 'claude-opus-4-8';
const MCP_BETA = 'mcp-client-2025-11-20';

// Hard ceiling for a single turn. Vercel kills the function at maxDuration (60s),
// so we abort a little before that and send a clean message instead of letting the
// connection die silently.
const TURN_TIMEOUT_MS = 55_000;

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

  const advanced = deep === true;
  const model = advanced ? OPUS : SONNET;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'));
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TURN_TIMEOUT_MS);
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
        // Opus reasons on deep questions with adaptive thinking (the only mode it
        // supports; thinking stays server-side, only the final answer streams). The
        // 55s abort below is what bounds the turn, so a long deep question fails
        // clean instead of hanging.
        if (advanced) params.thinking = { type: 'adaptive' };
        const events = await client.beta.messages.create(params, { signal: abort.signal });

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
        const aborted = abort.signal.aborted || err?.name === 'AbortError';
        send({
          type: 'error',
          message: aborted
            ? 'That one took too long. Try a more specific question, or turn off deep reasoning for a faster answer.'
            : (err?.message || String(err)),
        });
      } finally {
        clearTimeout(timer);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
