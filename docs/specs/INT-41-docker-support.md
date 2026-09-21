# INT-41 — Add Docker support

**Jira:** INT-41 · **Status:** Draft spec · **Repo:** `kilyinov/cog-autodev`

> Create Dockerfile for the @cog-autodev

## 1. Goal

Make the control plane runnable as a single OCI image: `docker build` produces a small, non-root,
production image of the Next.js app; `docker run -p 3000:3000 -e DEVIN_API_KEY=… -e DEVIN_ORG_ID=…`
serves the dashboard on port 3000. Without credentials the container serves the existing demo mode.

## 2. Interpretation & assumptions

- The ticket asks for a **Dockerfile**; this spec also covers the minimal companion files needed for
  it to be correct and reproducible (`.dockerignore`, `next.config.ts` `output: "standalone"`,
  README section). A `docker-compose.yml` is a small optional convenience (§3 FR-6), not required.
- **Runtime target is production** (`next build` + standalone server). A dev container with hot
  reload is out of scope (§9).
- Node version: the blueprint runs Node 24 (`nvm`), `package.json` pins Next `16.3.5` /
  React `19.2.8`. Use the official `node:24-alpine` image, pinned by minor (`node:24-alpine`) —
  not `latest`.
- Package manager is npm with a committed `package-lock.json` → use `npm ci`.
- All Devin API config (`DEVIN_API_KEY`, `DEVIN_ORG_ID`, `DEVIN_API_BASE_URL`) is read
  **at request time** on the server (`src/lib/devin/client.ts`, every page/route is
  `force-dynamic`), so credentials are supplied as **runtime** env vars and must never be baked
  into the image or passed as build args.
- `src/app/layout.tsx` uses `next/font/google` (Geist, Geist Mono). `next build` therefore downloads
  fonts from Google at **build time**; the Docker build needs outbound network. In fully
  network-restricted CI the build fails — see open question §10.1.

## 3. Functional requirements

### FR-1 `Dockerfile` (repo root), multi-stage
```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```
- Three stages: `deps` (install), `builder` (`next build`), `runner` (standalone output only —
  no `node_modules` from the builder, no source, no devDependencies).
- Runs as the non-root `nextjs` user; listens on `0.0.0.0:3000`.
- No `ARG`/`ENV` for `DEVIN_API_KEY`, `DEVIN_ORG_ID`, or `DEVIN_API_BASE_URL` in the Dockerfile.
- `NEXT_TELEMETRY_DISABLED=1` in build and run stages.
- Optional `HEALTHCHECK` hitting `GET /api/dashboard?windowDays=1` is **not** used (it would call
  the Devin API every interval); if a health check is wanted, add a dependency-free
  `GET /api/health` route returning `{ ok: true }` (see §9).

### FR-2 `next.config.ts` — standalone output
```ts
const nextConfig: NextConfig = {
  output: "standalone",
};
```
- Required for the `runner` stage above (`.next/standalone/server.js`). Does not change
  `npm run dev` / `npm run start` behaviour otherwise.
- Verify against Next 16 docs in `node_modules/next/dist/docs/` (per `AGENTS.md`) that the option
  name and the `public`/`.next/static` copy requirements are unchanged.

### FR-3 `.dockerignore` (repo root)
```
node_modules
.next
out
build
coverage
.git
.env*
!.env.example
*.md
!README.md
docs
.vscode
.idea
npm-debug.log*
*.tsbuildinfo
```
- Must exclude `.env*` so local credentials cannot leak into the build context/image.
- Must exclude `node_modules` and `.next` so the image is built from a clean install.

### FR-4 Runtime configuration contract
| Variable | Required | Notes |
| --- | --- | --- |
| `DEVIN_API_KEY` | no | Without it (or `DEVIN_ORG_ID`) the app serves demo data with a banner. |
| `DEVIN_ORG_ID` | no | See above. |
| `DEVIN_API_BASE_URL` | no | Defaults to `https://api.devin.ai`. |
| `PORT` | no | Defaults to `3000`. |
| `HOSTNAME` | no | Defaults to `0.0.0.0` in the image. |
- Supplied via `-e`, `--env-file .env.local`, or compose `environment:`; never via build args.

### FR-5 README section "Running with Docker"
```bash
docker build -t cog-autodev .
docker run --rm -p 3000:3000 \
  -e DEVIN_API_KEY=cog_… -e DEVIN_ORG_ID=org-… \
  cog-autodev
```
- Document: image is production-only, credentials are runtime env vars, `--env-file .env.local`
  alternative, and that the build needs network access for Google Fonts.
- Add `docker compose up --build` if FR-6 is implemented.

### FR-6 (optional) `docker-compose.yml`
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
    restart: unless-stopped
```
- `env_file` is optional-missing (`required: false`) so `docker compose up` works in demo mode
  without `.env.local`.

### FR-7 (optional) CI build check
- Add a `.github/workflows/docker.yml` job running `docker build .` on PRs so the Dockerfile cannot
  silently rot. No push/registry publish in this ticket.

## 4. Non-functional requirements

- **Image size:** runner stage < ~250 MB (alpine + standalone output). No dev dependencies,
  no source, no `.git`.
- **Security:** non-root user; no secrets in layers or `docker history`; base image pinned to a
  major/minor tag (consider a digest pin as a follow-up). `.env*` excluded from the context.
- **Reproducibility:** `npm ci` against the lockfile; layer order (lockfile → install → source)
  so dependency layers are cached across source changes.
- **Behaviour parity:** the containerised app must behave identically to `npm run build && npm start`
  — same routes (`/`, `/api/dashboard`, `/api/sessions`), same demo fallback.
- **No new npm dependencies.** `npm run lint`, `npm run typecheck`, `npm run build` must still pass
  locally.

## 5. Acceptance criteria

1. `docker build -t cog-autodev .` succeeds from a clean checkout (with network access).
2. `docker run --rm -p 3000:3000 cog-autodev` → `GET http://localhost:3000/` returns 200 and shows
   the demo-data banner; `GET /api/dashboard?windowDays=7` returns JSON with `source: "demo"`.
3. Running with valid `-e DEVIN_API_KEY -e DEVIN_ORG_ID` shows live data (`source: "live"`) and
   `POST /api/sessions` works — credentials are not present in `docker history` or image layers.
4. `docker run … id -u` (or `docker inspect`) shows the process runs as UID 1001, not root.
5. `.env.local` present in the working tree is **not** copied into the image (`docker run … ls -a /app`
   shows no `.env*`).
6. `npm run lint`, `npm run typecheck`, `npm run build` pass after the `next.config.ts` change.
7. README documents build/run and the runtime env contract.

## 6. Test plan

- **Local:** build image; run in demo mode and with credentials; curl `/`, `/api/dashboard`,
  `/api/sessions` (400 on empty body); check UID, image size (`docker images`), absence of `.env*`.
- **Negative:** build with `.env.local` containing a dummy key → `docker history` / `grep` on
  exported filesystem does not contain the key.
- **CI (if FR-7):** PR workflow builds the image.

## 7. Files touched (expected)

- `Dockerfile` — new
- `.dockerignore` — new
- `next.config.ts` — `output: "standalone"`
- `README.md` — "Running with Docker" section
- `docker-compose.yml` — new (optional, FR-6)
- `.github/workflows/docker.yml` — new (optional, FR-7)

## 8. UX / docs copy

| Element | Text |
| --- | --- |
| README heading | Running with Docker |
| Note | The image contains no credentials; pass `DEVIN_API_KEY`/`DEVIN_ORG_ID` at run time. Without them the dashboard serves demo data. |

## 9. Out of scope / follow-ups

- Dev container / hot-reload compose service (`next dev` with a bind mount).
- Publishing to a registry (GHCR/ECR), image signing, SBOM, multi-arch (`linux/arm64`) builds.
- `GET /api/health` liveness route + `HEALTHCHECK`.
- Self-hosting Geist fonts (would remove the build-time network dependency, see §10.1).
- Kubernetes/Helm manifests.

## 10. Open questions

1. Must the image build in an environment **without** outbound network? If so, `next/font/google`
   has to be replaced with self-hosted fonts (`next/font/local`) first — separate ticket.
2. Is `docker-compose.yml` (FR-6) and/or the CI build job (FR-7) wanted in this ticket, or
   Dockerfile-only?
3. Base image preference: `node:24-alpine` (smallest) vs `node:24-slim` (glibc, fewer native-module
   surprises). Default: alpine; nothing in the current dependency tree needs native modules.

## References

- Next.js `output: "standalone"` / self-hosting docs: `node_modules/next/dist/docs/` (Next 16 — read
  before implementing, per `AGENTS.md`)
- Existing runtime config resolution: `src/lib/devin/client.ts`
- Prior spec format: `docs/specs/INT-40-session-creation-from-dashboard.md`
