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

const MODEL = 'claude-opus-4-8';
const MCP_BETA = 'mcp-client-2025-11-20';

// Stable system prompt → cache it (prompt caching, prefix match).
const SYSTEM = `You are Signal, the decision assistant for Trifecta Consulting Group's
Marketing Mix Modelling service, speaking to the team at Aeon Skincare.

You are backed by a fitted Bayesian MMM (Google Meridian) via the connected Trifecta
tools. For ANY question about channel performance, ROI, marginal returns, saturation,
budget allocation, "what if" spend changes, or model trustworthiness, you MUST call the
appropriate tool rather than answering from memory — the numbers must come from the model.

Tools available: get_channel_contribution, get_marginal_roi, get_response_curve,
run_budget_scenario, optimize_budget, get_model_health.

Rules:
- Always report the credible interval alongside any figure (e.g. "ROI 1.4x, 90% CI [0.4–3.1]").
  Never present a point estimate as certainty.
- Be concise and decision-oriented. Lead with the answer, then the supporting numbers.
- Money figures are in the model's revenue units; format large numbers readably (e.g. $57M).
- If the model's confidence is low (wide intervals, or get_model_health shows a high R-hat),
  say so plainly.
- The data is genuine Meridian output trained on a public simulated dataset — the client
  (Aeon Skincare) and channel labels are a demo. If asked, be honest about this.
- Only answer marketing-measurement questions for this client; politely decline unrelated requests.`;

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const mcpUrl = process.env.MCP_SERVER_URL;
  if (!apiKey) return new Response('ANTHROPIC_API_KEY not set', { status: 500 });
  if (!mcpUrl) return new Response('MCP_SERVER_URL not set', { status: 500 });

  const { messages } = await req.json();
  const client = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o) => controller.enqueue(encoder.encode(JSON.stringify(o) + '\n'));
      try {
        const events = await client.beta.messages.create({
          model: MODEL,
          max_tokens: 4096,
          system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
          messages,
          mcp_servers: [{ type: 'url', url: mcpUrl, name: 'trifecta' }],
          tools: [{ type: 'mcp_toolset', mcp_server_name: 'trifecta' }],
          betas: [MCP_BETA],
          stream: true,
        });

        for await (const event of events) {
          if (event.type === 'content_block_start' && event.content_block?.type === 'mcp_tool_use') {
            send({ type: 'tool', name: event.content_block.name });
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
