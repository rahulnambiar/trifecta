// POST /api/signal/followups — propose the CMO's next questions from the conversation.
// A cheap, fast Sonnet call (no tools) that returns 3 short, specific follow-ups so the
// chat feels contextual and alive. Returns { followups: string[] }.
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

const MODEL = process.env.SIGNAL_MODEL_DEFAULT || 'claude-sonnet-4-6';

const SYSTEM = `You suggest the next questions a CMO would naturally ask Signal (a marketing-mix
decision assistant for their brand). Given the conversation so far, propose THREE short,
specific, action-oriented follow-ups that build on the last answer — the kind that pull the
CMO deeper (drill into a channel, test a budget move, check saturation or confidence, compare).
Each must be <9 words, phrased as the CMO speaking, no numbering. Return ONLY a JSON array of
3 strings, nothing else.`;

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return Response.json({ followups: [] });
  try {
    const { messages } = await req.json();
    const convo = (messages || []).slice(-6)
      .map((m) => `${m.role === 'user' ? 'CMO' : 'Signal'}: ${String(m.content || '').slice(0, 700)}`)
      .join('\n');
    const client = new Anthropic({ apiKey });
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Conversation:\n${convo}\n\nReturn the JSON array of 3 follow-ups.` }],
    });
    const text = (r.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    const match = text.match(/\[[\s\S]*\]/);
    let followups = [];
    try { followups = JSON.parse(match ? match[0] : text); } catch { followups = []; }
    followups = (Array.isArray(followups) ? followups : []).filter((s) => typeof s === 'string').slice(0, 3);
    return Response.json({ followups });
  } catch {
    return Response.json({ followups: [] });
  }
}
