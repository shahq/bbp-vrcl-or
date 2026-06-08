# Vercel Phase 5 Compatibility Plan

## Scope

This is the planning slice for Vercel hosting and the temporary `/api/*` compatibility API. It does not add production Vercel configuration, deployment secrets, billing assumptions, or ownership changes.

The goal is to keep the current Vite app behavior intact while preparing a minimal Vercel path:

- Vercel hosts the Vite frontend.
- The first Vercel preview can point `VITE_API_BASE_URL` at the existing backend origin instead of moving the API immediately.
- A thin compatibility API preserves the current `/api/*` URLs only after the Express app is split into a Vercel-compatible entry point.
- Convex remains the preferred provider for durable sessions, cards, connections, notes, attachment metadata, and attachment bytes.
- SQLite/local storage remain the local fallback.
- PartyKit remains responsible for presence, cursors, canvas sync, and timer broadcasts.

## Current Runtime Surfaces

| Surface | Current repo shape | Phase 5 implication |
| --- | --- | --- |
| Frontend | Vite build output in `dist/`; currently deployable as static SPA assets. | `vercel.json` now configures Vite frontend preview hosting and SPA fallback rewrites. |
| Compatibility API | Express app factory in `server.ts`; `api/[...path].ts` wraps it for Vercel `/api/*` compatibility. | Keep on the existing backend host until the Vercel API wrapper is deployed with server-side env vars and smoke-tested. |
| Persistence | `DATA_STORE_PROVIDER=sqlite` fallback and `DATA_STORE_PROVIDER=convex` provider seam. | Vercel-hosted API should use `DATA_STORE_PROVIDER=convex`; SQLite is not durable on serverless hosts. |
| Attachment storage | `ATTACHMENT_STORE_PROVIDER=local` fallback and `ATTACHMENT_STORE_PROVIDER=convex` provider seam. | Vercel-hosted API should use `ATTACHMENT_STORE_PROVIDER=convex`; local files are not durable on serverless hosts. |
| Document extraction | `src/server/documents.ts` shells out to `scripts/extract_attachment.py`. | This is the largest Vercel serverless blocker and remains a Phase 6 extraction decision. |
| Realtime | PartyKit in `party/index.ts` and `partykit.json`. | Keep unchanged in Phase 5. |
| Historical deployment | `firebase.json`, `.firebaserc`, and `DEPLOYMENT.md` still describe Firebase/hybrid paths. | Treat as current/historical context until approved cleanup. |

## Compatibility API Inventory

The current frontend depends on these `/api/*` route groups:

- Health/config: `GET /api/health`, `GET /api/ai/config`
- AI: `POST /api/ai/complete`, `POST /api/ai/chat`
- Admin auth: `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/check`, `POST /api/admin/partykit-token`
- Sessions: list, create, get, update, delete, onboarding completion, password verification
- Attachments: list, base64 upload, direct upload target, direct upload finalize, metadata update, delete
- ZIP import: `POST /api/sessions/:id/import/zip`
- Cards: create, update, delete, reorder
- Connections: create, delete, bulk save
- Notes: list, create, update, delete
- Exports: ZIP, Markdown, full DOCX, overview DOCX, JSON

Phase 5 should preserve these URLs and response shapes until the frontend intentionally moves to a different API surface.

## Environment Classification

Browser-safe variables:

- `VITE_API_BASE_URL`
- `VITE_PARTYKIT_HOST`
- `VITE_PARTYKIT_PARTY`
- `VITE_CONVEX_URL` only if the frontend starts using Convex directly; it is not needed for the current REST-first UI.

Server-only variables:

- `AI_PROVIDER`
- `AI_DEFAULT_MODEL`
- `GOOGLE_API_KEY`
- `GEMINI_API_KEY`
- `OPENCODE_API_KEY`
- `OPENROUTER_API_KEY`
- `ADMIN_PASSWORD`
- `PARTYKIT_ADMIN_SECRET`
- `PARTYKIT_HOST`
- `DATA_STORE_PROVIDER`
- `ATTACHMENT_STORE_PROVIDER`
- `ADMIN_AUTH_PROVIDER`
- `CONVEX_URL`
- `BBP_PYTHON_PATH`
- `APP_URL`
- `PORT`

Vite no longer injects AI provider keys into the browser bundle. Keep all AI keys server-side in Vercel environment variables.

## Vercel Blockers And Decisions

1. **Express entry point**
   - Current app is a long-running Express server started by `tsx server.ts`.
   - A Vercel API route can wrap Express, but that should be added only after approval for Vercel deployment assumptions.

2. **SQLite/local storage**
   - Vercel serverless file systems are not durable for application data.
   - Any Vercel-hosted API should default to `DATA_STORE_PROVIDER=convex` and `ATTACHMENT_STORE_PROVIDER=convex`.
   - Keep SQLite/local mode for local development and fallback verification.

3. **Document extraction**
   - The current extraction path requires Python packages through `scripts/extract_attachment.py`.
   - Vercel Functions should not become the final extraction runtime until Phase 6 proves a Node-compatible adapter or an approved external worker.
   - Direct Convex uploads can still store original bytes, but extraction durability remains a separate decision.

4. **Function limits**
   - ZIP export/import, DOCX export, AI generation, and attachment extraction are the routes most likely to hit serverless body-size, memory, or duration limits.
   - Phase 5 should verify these with smoke tests before any production cutover.

## Minimal Approved Implementation Sequence

After human approval for Vercel deployment assumptions:

1. Add minimal Vercel config for the Vite frontend only. Completed in `vercel.json`.
2. Configure preview `VITE_API_BASE_URL` to the existing backend origin. Do not leave it empty for the first Vercel preview.
3. Configure preview `VITE_PARTYKIT_HOST` and `VITE_PARTYKIT_PARTY` for the existing PartyKit deployment.
4. Run `npm run lint` and `npm run build`.
5. Browser-check the Vercel preview against the existing backend origin.
6. Run compatibility smokes against the backend origin used by the preview:
   - `npm run smoke:provider-api`
   - `SMOKE_DIRECT_ATTACHMENT_UPLOAD=1 npm run smoke:attachments-api`
   - `SMOKE_DIRECT_ATTACHMENT_UPLOAD=1 npm run smoke:brief-from-uploads`
   - `SMOKE_DIRECT_ATTACHMENT_UPLOAD=1 npm run smoke:exports-api`
7. Document any failed route with whether it is a frontend hosting issue, existing backend issue, Convex provider issue, or the already-deferred extraction decision.
8. Only after the frontend preview is verified, split `server.ts` into a reusable app factory and add a Vercel-compatible compatibility API entry point. Completed in repo; deployment and smoke verification remain pending.

## Current Recommendation

Do not lift-and-shift the full Express/Python backend to Vercel as the first Vercel slice.

The frontend preview now exists at `https://sqd-bbp.vercel.app`, but the configured Cloud Run backend origin is stale relative to this migration branch. Treat Cloud Run as a legacy compatibility bridge only, not the active migration target.

The Vercel/Convex compatibility API entry point now exists in repo. Do not make `gcloud`/Cloud Run redeploy the recommended path unless a human explicitly approves it as a temporary emergency bridge.

## Next Agent Handoff

Goal: verify the Vercel compatibility API in a preview deployment without changing the public `/api/*` contract, removing SQLite/local fallback, or changing extraction behavior.

Completed prep:

1. Split `server.ts` into a reusable Express app factory and local `listen()` bootstrap.
2. Kept route registration order, request shapes, response shapes, and auth checks unchanged.
3. Moved the Vite dev-server import into a dev-only dynamic import so API-only imports do not pull Vite.
4. Moved shared session id/password helpers out of SQLite-backed `src/server/sessions.ts`.
5. Updated Convex data stores to import those DB-free helpers.
6. Removed eager SQLite/native imports from Convex data-provider paths by lazy-loading local SQLite stores.
7. Added `api/[...path].ts` as the thin Vercel wrapper around `createApp()`.

Recommended next slice:

1. Configure a Vercel preview with server-side `DATA_STORE_PROVIDER=convex`, `ATTACHMENT_STORE_PROVIDER=convex`, `CONVEX_URL`, `ADMIN_PASSWORD`, and only the server secrets needed for routes under test.
2. Run `npm run lint` and `npm run build`.
3. Deploy a preview and smoke `GET /api/health` on the same-origin Vercel URL.
4. Run provider, attachment, brief-from-uploads, and export smokes against the Vercel preview origin.
5. Classify failures as Vercel API wrapper, Convex provider, existing auth/session persistence, or deferred extraction-runtime issues.
6. Keep document extraction deferred to Phase 6. The Python extraction path and temp-file materialization are still not proven for Vercel Functions.

Checks for that slice:

- `npm run lint`
- `npm run build`
- Local SQLite smoke for provider/API behavior.
- Convex provider smoke with `DATA_STORE_PROVIDER=convex` after SQLite imports are no longer loaded on Convex paths.

Stop before:

- Adding new production dependencies.
- Removing SQLite/local fallback.
- Changing auth/session semantics.
- Changing exported data formats.
- Changing PartyKit behavior.
- Adding Railway.
- Touching production env vars, secrets, billing, or deployment ownership.
