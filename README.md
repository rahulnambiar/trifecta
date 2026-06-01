# Trifecta Platform

Internal operator console for **Trifecta Consulting Group** — Marketing Mix Modelling (MMM)
delivered as a managed service, built on Google's open-source **Meridian** library.

This monorepo holds the **Phase 0 showcase prototype**: a navigable platform backed by a real
Meridian model trained on Google's public simulated dataset. One hardcoded demo client
("Aeon Skincare"), read-mostly — but the Results and Signal figures are genuine Meridian outputs.

**🔗 Live demo: https://trifecta-platform.vercel.app** — sign in (mock auth), open **Results** for
real Meridian charts, and **Signal** to chat with the model (grounded answers, with credible intervals).

## Structure

```
apps/web/             Next.js operator console (the Claude Design handoff, built out) → Vercel
services/
  meridian-runner/    Python — Meridian training job → Vertex AI GPU
  mcp-server/         Python — MCP server (Signal backend) → Cloud Run
packages/db/          Supabase schema + seed
data/sample/          Meridian simulated dataset
docs/                 Design PRD · Technical Architecture · Phase 0 build brief
trifecta-design/      Original Claude Design handoff bundle (reference)
CLAUDE.md             Project context for Claude Code
```

## The web console

The operator console in `apps/web` was recreated from the **Claude Design → Claude Code** handoff
(`trifecta-design/project/`). It is the faithful, navigable wireframe: Login, Dashboard, Data
Pipeline, Model Studio, Training Runs, Results, Reports, Signal, Client Settings and Settings,
with working navigation, dark/light themes, and the full Trifecta design system.

```bash
cd apps/web
npm install
npm run dev      # http://localhost:3000
```

Sign in (any credentials — auth is wired in milestone M3) to enter the console.

## Build phases

See `docs/phase0-build-brief.md` and `CLAUDE.md`. Phase 0 = showcase prototype;
Phase 1 = real client data; Phase 2 = scale. The web design is built; the Meridian runner,
MCP server, and live-data wiring are the remaining Phase 0 milestones.

> Design blueprint · navigable wireframe · **fictional data**.
