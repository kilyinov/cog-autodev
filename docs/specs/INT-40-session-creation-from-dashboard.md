# INT-40 — Session creation from dashboard

**Jira:** INT-40 · **Status:** Draft spec · **Repo:** `kilyinov/cog-autodev`

> Extend existing @cog-autodev app to allow creating a new Devin session based on user input for
> prompt and a dropdown for model selection. Use v3 Org API to create new sessions.

## 1. Goal

Add a "New session" form to the control-plane dashboard (`/`) that lets an operator type a prompt,
pick a Devin mode from a dropdown, and submit. The server creates the session via
`POST /v3/organizations/{org_id}/sessions` and the UI shows a link to the new session (or a
readable error). The dashboard should then reflect the new session on refresh.

## 2. Interpretation & assumptions

- **"Model selection"** — the v3 create-session API has no `model` field. The only per-session
  agent choice it exposes is `devin_mode` (`normal | fast | lite | ultra | fusion`). The dropdown
  therefore maps to `devin_mode`; label it "Mode" (or "Model / mode") in the UI. If a literal LLM
  model picker was intended, that is not supported by the API and the ticket owner should confirm.
- The existing client (`src/lib/devin/client.ts`) already targets the v3 org-scoped API with a
  service-user key (`DEVIN_API_KEY`) + `DEVIN_ORG_ID` + optional `DEVIN_API_BASE_URL`. Session
  creation reuses this configuration; no new env vars are required.
- When the API is not configured, the dashboard runs in demo/mock mode. Session creation must not
  fabricate a session in that mode — the form is disabled with an explanatory hint.
- Sessions are attributed to the service user unless `create_as_user_id` is passed. Out of scope for
  this ticket (see §9), but the client type should not preclude adding it later.

## 3. Functional requirements

### FR-1 New-session form on the dashboard
- Rendered on `/` below the live/demo banner and above the stat cards, as a panel matching the
  existing card style (`rounded-lg border border-slate-800 bg-slate-900/…`).
- Fields:
  - **Prompt** — `<textarea>`, required, trimmed, 1–10 000 chars, ~4 rows, placeholder e.g.
    "Describe the task for Devin…".
  - **Mode** — `<select>`, required, options in this order with these labels and values:
    | Label | Value |
    | --- | --- |
    | Normal (default) | `normal` |
    | Fast | `fast` |
    | Lite | `lite` |
    | Ultra | `ultra` |
    | Fusion | `fusion` |
    Default selection: `normal`.
  - **Submit button** — "Create session"; shows "Creating…" and is disabled while the request is in
    flight. Also disabled when prompt is empty/whitespace.
- Enter in the textarea inserts a newline; Ctrl/Cmd+Enter submits.

### FR-2 Server-side creation endpoint
- `POST /api/sessions` (Next.js route handler, `src/app/api/sessions/route.ts`,
  `export const dynamic = "force-dynamic"`).
- Request body (JSON): `{ prompt: string; devinMode: "normal" | "fast" | "lite" | "ultra" | "fusion" }`.
- Validation (return `400` with `{ error: string }`):
  - body is not JSON / not an object;
  - `prompt` missing, not a string, empty after trim, or > 10 000 chars;
  - `devinMode` not one of the five allowed values.
- If `!isDevinApiConfigured()` → `503 { error: "Devin API is not configured (DEVIN_API_KEY, DEVIN_ORG_ID)." }`.
- On success → `201 { sessionId, url, status, title, devinMode, createdAt }` (camelCase view of the
  API response; `createdAt` as ISO string, consistent with `SessionView`).
- On upstream failure → propagate a sanitized error: status `502` for network errors, otherwise
  mirror the upstream status (401/403/404/409/422/429/5xx) with
  `{ error: "<title>: <detail>" }` taken from the v3 problem-details body when present, else
  `"Devin API request failed: <status> <statusText>"`. Never echo the API key.
- The `DEVIN_API_KEY` must only be used server-side (route handler); never sent to the browser.

### FR-3 Devin client extension (`src/lib/devin/client.ts`)
```ts
export type DevinMode = "normal" | "fast" | "lite" | "ultra" | "fusion";
export const DEVIN_MODES: readonly DevinMode[] = ["normal", "fast", "lite", "ultra", "fusion"];

export type CreateSessionInput = {
  prompt: string;
  devinMode?: DevinMode;      // sent as `devin_mode`
  title?: string | null;
  tags?: string[];            // default ["cog-autodev"] so dashboard-created sessions are identifiable
};

export type CreatedSession = Pick<DevinSession, "session_id" | "url" | "status" | "title" | "created_at" | "updated_at" | "tags"> & {
  devin_mode: DevinMode | null;
};

export async function createSession(input: CreateSessionInput): Promise<CreatedSession>;
```
- Calls `POST {baseUrl}/v3/organizations/{encodeURIComponent(orgId)}/sessions` with headers
  `Authorization: Bearer <key>`, `Content-Type: application/json`, `cache: "no-store"`.
- Body: `{ prompt, devin_mode, tags, title }` — omit keys whose value is `undefined`.
- Throws `DevinApiError(message, status)` on non-2xx; message built from the problem-details body
  (`title`/`detail`) when parseable. Throws `DevinApiError(…, 401)` when key/org are unset (same as
  `fetchSessions`). Extract the shared key/org/baseUrl resolution into a small private helper used by
  both `fetchSessions` and `createSession`.
- `DevinSession` type gains optional `devin_mode?: DevinMode | null` (present on v3 responses).

### FR-4 Client component & result handling (`src/components/new-session-form.tsx`, `"use client"`)
- Submits to `/api/sessions` with `fetch`; keeps local state `idle | submitting | success | error`.
- On success: show an inline success notice "Session created — Open session ↗" linking to the
  returned `url` (`target="_blank" rel="noreferrer"`), clear the prompt, keep the selected mode, then
  call `router.refresh()` so the sessions table/stat cards pick up the new session (mirrors
  `RefreshButton`).
- On error: show the `error` string inline in the existing critical style
  (`border-rose-500/30 bg-rose-500/10 text-rose-300`); keep the prompt so the user can retry.
- Prevent double submission (ignore submit while `submitting`).

### FR-5 Demo / unconfigured mode
- `page.tsx` passes `enabled={data.source === "live" || isDevinApiConfigured()}`. When disabled, the
  form renders read-only with hint: "Set DEVIN_API_KEY and DEVIN_ORG_ID to create sessions." The
  API route independently enforces the 503 (FR-2) so the check is not client-only.

### FR-6 Documentation
- README: add a "Creating sessions" subsection (form, `POST /api/sessions` contract, mode values,
  note that `devin_mode` is the API's mode selector), and add `POST /api/sessions` to the endpoint
  list. Mention the service-user role needs permission to create sessions in the org.

## 4. Non-functional requirements

- **Security:** no API key exposure to the client; server validates every field; request body size
  limited by prompt cap. Rate-limiting is delegated to the Devin API (429 surfaced to the user).
- **Accessibility:** labelled inputs (`<label htmlFor>`), status messages in `role="status"` /
  `role="alert"`, keyboard submit, focus returns to the textarea after success.
- **Responsiveness:** single-column stack on mobile; matches existing `min-w-0` containment.
- **Style/tooling:** TypeScript strict, no `any`; `npm run lint`, `npm run typecheck`,
  `npm run build` must pass. Follow Next 16 conventions (read `node_modules/next/dist/docs/` per
  `AGENTS.md`).
- **No new dependencies.**

## 5. UX copy

| Element | Text |
| --- | --- |
| Panel title | New session |
| Panel subtitle | Start a Devin session from a prompt. It appears in the table below once created. |
| Prompt label | Prompt |
| Mode label | Mode |
| Submit | Create session / Creating… |
| Success | Session created · Open session |
| Disabled hint | Set DEVIN_API_KEY and DEVIN_ORG_ID to create sessions. |

## 6. Acceptance criteria

1. With valid credentials, entering a prompt, choosing "Fast", and submitting creates a session via
   the v3 org endpoint with `devin_mode: "fast"`; the UI shows a working link to the session and the
   sessions table includes it after refresh.
2. Submitting an empty/whitespace prompt is blocked client-side, and `POST /api/sessions` returns
   `400` for the same payload sent directly.
3. `POST /api/sessions` with `devinMode: "gpt-5"` returns `400`.
4. Without `DEVIN_API_KEY`/`DEVIN_ORG_ID`, the form is disabled with the hint, and the API returns
   `503`.
5. Upstream `401/403/429` responses are shown inline as readable errors; no stack traces or secrets.
6. `npm run lint`, `npm run typecheck`, `npm run build` succeed.

## 7. Test plan

- **Unit (client):** `createSession` builds the correct URL/headers/body (mock `fetch`), omits
  undefined fields, maps problem-details to `DevinApiError`, throws 401 when unconfigured.
- **Route:** validation matrix (missing prompt, long prompt, bad mode, bad JSON, unconfigured →
  503, upstream 429 → 429 with message, success → 201 shape).
- **UI (manual / testing agent):** happy path, error path (invalid key), disabled demo mode,
  Ctrl+Enter submit, mobile width.

## 8. Files touched (expected)

- `src/lib/devin/client.ts` — `createSession`, `DevinMode`, shared config helper
- `src/lib/devin/types.ts` — `DevinMode`, `devin_mode` on `DevinSession`, `CreatedSessionView`
- `src/app/api/sessions/route.ts` — new
- `src/components/new-session-form.tsx` — new
- `src/app/page.tsx` — mount form
- `README.md`, `.env.example` (comment only)

## 9. Out of scope / follow-ups

- `create_as_user_id` (attribute session to a human user), `repos`, `playbook_id`, `tags` editing,
  attachments, secrets, `platform`, `max_acu_limit` — could be added as an "Advanced" disclosure later.
- Polling the new session's status in-page; listing sessions filtered by the `cog-autodev` tag.
- Auth for the dashboard itself (anyone who can reach the app can create sessions) — flag to the
  ticket owner before deploying publicly.

## 10. Open questions

1. Confirm "model selection" == Devin **mode** (`devin_mode`); no LLM model field exists in the API.
2. Should dashboard-created sessions be tagged (`cog-autodev`) and/or attributed via
   `create_as_user_id`?
3. Should `ultra`/`fusion` be hidden if the org lacks the feature flag (API returns an error either
   way)? Default: show all five and surface the API error.

## References

- Create Session (v3): https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions
- Session attribution / service users: https://docs.devin.ai/api-reference/overview#session-attribution
- Existing v3 list client: `src/lib/devin/client.ts`
