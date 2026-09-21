# cog-autodev

Cognition-based autodev (autonomous developer) — a Next.js control plane for Devin-based
workflow automation.

The dashboard at `/` shows, for a selectable window (1/7/14/30 days):

- session volume, active sessions, completion rate and median run time
- pull requests opened by sessions, with links to each PR
- agent issues: blocked, expired, stalled (working but idle > 4h) and finished-without-a-PR sessions
- daily activity (sessions vs. pull requests)
- ACU spend per session (average, median, max, total, top sessions), sourced from
  `GET /v3/organizations/{org_id}/sessions/insights` (falls back to the plain sessions
  list without spend data if unavailable)

## Getting started

```bash
npm install
cp .env.example .env.local   # optional, add DEVIN_API_KEY + DEVIN_ORG_ID for live data
npm run dev
```

Open http://localhost:3000.

## Data source

With `DEVIN_API_KEY` and `DEVIN_ORG_ID` set, data is pulled from the Devin API
(`GET /v3/organizations/{org_id}/sessions/insights`, falling back to
`GET /v3/organizations/{org_id}/sessions` when the insights endpoint is unavailable). Without them — or if the API call fails — the
dashboard falls back to deterministic demo data and says so in a banner.

Authentication uses a [service user](https://docs.devin.ai/api-reference/authentication) API key
(`cog_…`, provisioned under **Settings > Devin API > Service users**) or a Personal Access Token.
The organization ID (`org-…`) is shown at the top of the same settings page. The base URL stays
`https://api.devin.ai` unless you are on a dedicated Devin Enterprise deployment, in which case set
`DEVIN_API_BASE_URL` to your custom API domain. Aggregated metrics are also served as JSON from `/api/dashboard?windowDays=7`.

## API endpoints

- `GET /api/dashboard?windowDays=7` — aggregated dashboard metrics
- `POST /api/sessions` — create a Devin session

## Creating sessions

The **New session** form on `/` creates a Devin session from a prompt and mode. It calls
`POST /api/sessions` with `{ "prompt": string, "devinMode": string }` and returns the new
session's ID, URL, status, title, mode, and ISO creation timestamp. Supported mode values are
`normal`, `fast`, `lite`, `ultra`, and `fusion`; `devin_mode` is Devin's API mode selector
(not a literal LLM model picker). The service user must have permission to create sessions in
the organization.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
