# cog-autodev

Cognition-based autodev (autonomous developer) — a Next.js control plane for Devin-based
workflow automation.

The dashboard at `/` shows, for a selectable window (1/7/14/30 days):

- session volume, active sessions, completion rate and median run time
- pull requests opened by sessions, with links to each PR
- agent issues: blocked, expired, stalled (working but idle > 4h) and finished-without-a-PR sessions
- daily activity (sessions vs. pull requests)

## Getting started

```bash
npm install
cp .env.example .env.local   # optional, add DEVIN_API_KEY for live data
npm run dev
```

Open http://localhost:3000.

## Data source

With `DEVIN_API_KEY` set, data is pulled from the Devin API (`GET /v1/sessions`). Without it —
or if the API call fails — the dashboard falls back to deterministic demo data and says so in a
banner. Aggregated metrics are also served as JSON from `/api/dashboard?windowDays=7`.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
