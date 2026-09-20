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
cp .env.example .env.local   # optional, add DEVIN_API_KEY + DEVIN_ORG_ID for live data
npm run dev
```

Open http://localhost:3000.

## Data source

With `DEVIN_API_KEY` and `DEVIN_ORG_ID` set, data is pulled from the Devin API
(`GET /v3/organizations/{org_id}/sessions`). Without them — or if the API call fails — the
dashboard falls back to deterministic demo data and says so in a banner.

Authentication uses a [service user](https://docs.devin.ai/api-reference/authentication) API key
(`cog_…`, provisioned under **Settings > Devin API > Service users**) or a Personal Access Token.
The organization ID (`org-…`) is shown at the top of the same settings page. The base URL stays
`https://api.devin.ai` unless you are on a dedicated Devin Enterprise deployment, in which case set
`DEVIN_API_BASE_URL` to your custom API domain. Aggregated metrics are also served as JSON from `/api/dashboard?windowDays=7`.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
