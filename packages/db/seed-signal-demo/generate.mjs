// Regenerate sessions.json: 10 demo Signal chat sessions, each a genuine Aeon
// Skincare Meridian conversation (text + chart artifacts) produced by calling the
// real model + Trifecta MCP server. Mirrors apps/web/app/api/signal/route.js wiring,
// but runs locally with no 60s cap so every turn completes.
//
//   cd <repo> && node --env-file=apps/web/.env.local packages/db/seed-signal-demo/generate.mjs
//
// Needs ANTHROPIC_API_KEY + MCP_SERVER_URL in the env file. Costs a little Anthropic
// usage. You normally DON'T need this — sessions.json is committed; only re-run to
// refresh the demo content.
import Anthropic from '../../../apps/web/node_modules/@anthropic-ai/sdk/index.mjs';
import { writeFileSync } from 'node:fs';

const apiKey = process.env.ANTHROPIC_API_KEY;
const mcpUrl = process.env.MCP_SERVER_URL;
if (!apiKey || !mcpUrl) { console.error('Set ANTHROPIC_API_KEY and MCP_SERVER_URL (e.g. --env-file=apps/web/.env.local)'); process.exit(1); }
const client = new Anthropic({ apiKey, maxRetries: 1 });

const MODEL = process.env.SIGNAL_MODEL_DEFAULT || 'claude-sonnet-4-6';
const MCP_BETA = 'mcp-client-2025-11-20';
const SYSTEM = `You are Signal — the senior growth strategist for the CMO of Aeon Skincare.
Think Bain/McKinsey partner: sharp, decisive, commercially fluent, never robotic. You are
backed by a fitted Bayesian marketing-mix model (Google Meridian) via the connected tools.
For ANY question about channel performance, ROI, marginal returns, saturation, budget
allocation, "what if" spend changes, or model trustworthiness, you MUST call the right tool
first — the numbers come from the model, never from memory.
Tools: get_channel_contribution, get_marginal_roi, get_response_curve, run_budget_scenario,
optimize_budget, get_model_health.
HOW TO ANSWER:
- Lead with the decision/headline in ONE bold sentence. No preamble, no restating the question.
- Then 2–4 tight markdown bullets, each with the number and its 90% credible interval.
- Close with one **So what** line: the concrete move you'd make.
- Scannable on a phone. Bold the numbers. Always carry the credible interval.
- Money in the model's revenue units, formatted readably ($57M, $2.8M).
- Genuine Meridian output on a public simulated dataset; Aeon is a demo. Only answer
  marketing-measurement questions for this client.`;

// 10 sessions a CMO would actually run (1–2 turns each).
const SESSIONS = [
  { key: 'budget-plan', turns: ["We're planning next quarter's budget. Where should the money go?", "And if the board only approves a flat budget, what should I shift?"] },
  { key: 'what-drives-revenue', turns: ["Which channels are actually driving our revenue?", "Which of those is the most efficient per dollar?"] },
  { key: 'tiktok-saturation', turns: ["Is TikTok saturating? We have been pouring money in.", "At what weekly spend does it stop paying back?"] },
  { key: 'search-vs-meta', turns: ["What is the ROI on Paid Search versus Meta right now?"] },
  { key: 'tv-cut-scenario', turns: ["If I cut TV by 30% and move it to digital, what happens to revenue?"] },
  { key: 'can-i-trust-it', turns: ["Before I take this to the board, can I trust this model?"] },
  { key: 'under-invested', turns: ["What is our most under-invested channel, where the next dollar works hardest?"] },
  { key: 'board-headline', turns: ["Give me the one-line story for the board: what is working and what is not."] },
  { key: 'defensive-cut', turns: ["We may face a 20% budget cut. Where can I take it with the least damage?"] },
  { key: 'youtube-grow', turns: ["How is YouTube performing, and should we spend more on it?"] },
];

async function askOnce(messages) {
  const msg = await client.beta.messages.create({
    model: MODEL, max_tokens: 4096,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages,
    mcp_servers: [{ type: 'url', url: mcpUrl, name: 'trifecta' }],
    tools: [{ type: 'mcp_toolset', mcp_server_name: 'trifecta' }],
    betas: [MCP_BETA],
  }, { timeout: 75000 });
  let text = ''; const artifacts = []; const tools = []; const names = {};
  for (const b of msg.content) {
    if (b.type === 'text') text += b.text;
    else if (b.type === 'mcp_tool_use') { names[b.id] = b.name; tools.push(b.name); }
    else if (b.type === 'mcp_tool_result' && !b.is_error) {
      const t = (b.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('');
      let d = null; try { d = JSON.parse(t); } catch { /* */ }
      if (d) artifacts.push({ name: names[b.tool_use_id] || 'tool', data: d });
    }
  }
  return { text: text.trim(), artifacts, tools };
}

async function runSession(s) {
  const messages = []; const turns = [];
  for (const q of s.turns) {
    messages.push({ role: 'user', content: q });
    let out;
    for (let a = 0; a < 3; a++) {
      try { out = await askOnce(messages); if (out.text) break; } catch (e) { console.error(`  [${s.key}] retry ${a}:`, e.message); }
      await new Promise((r) => setTimeout(r, 1200));
    }
    if (!out || !out.text) throw new Error(`[${s.key}] could not produce an answer for: ${q}`);
    messages.push({ role: 'assistant', content: out.text });
    turns.push({ q, answer: out.text, artifacts: out.artifacts, tools: out.tools });
    console.log(`  [${s.key}] "${q.slice(0, 40)}" -> ${out.text.length} chars, ${out.artifacts.length} artifact(s)`);
  }
  return { key: s.key, title: s.turns[0].replace(/\s+/g, ' ').slice(0, 80), turns };
}

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); } }));
  return out;
}

console.log(`Generating ${SESSIONS.length} sessions (model ${MODEL}) ...`);
const results = await pool(SESSIONS, 3, runSession);
const outPath = new URL('./sessions.json', import.meta.url);
writeFileSync(outPath, JSON.stringify(results, null, 2));
const turns = results.reduce((a, r) => a + r.turns.length, 0);
console.log(`DONE: ${results.length} sessions, ${turns} turns -> ${outPath.pathname}`);
