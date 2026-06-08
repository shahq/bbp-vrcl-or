# Convex Local Setup

This project includes Convex schema/functions and a `DATA_STORE_PROVIDER=convex` adapter for sessions, cards, connections, and shared notes. The app still runs on the existing SQLite/local-file backend by default.

## Current State

- Runtime default: `DATA_STORE_PROVIDER=sqlite`
- Attachment default: `ATTACHMENT_STORE_PROVIDER=local`
- Admin auth default: `ADMIN_AUTH_PROVIDER=password`
- Convex schema and functions live in `convex/`
- `DATA_STORE_PROVIDER=convex` requires `CONVEX_URL` or `VITE_CONVEX_URL`
- No production Convex deployment, URL, or secret is required for the current app runtime

Shell-provided environment variables take precedence over `.env` and `.env.local`, so local smoke tests can force the fallback providers even when a developer has stale provider values in `.env.local`:

```bash
DATA_STORE_PROVIDER=sqlite ATTACHMENT_STORE_PROVIDER=local ADMIN_AUTH_PROVIDER=password PORT=3107 npm run dev
```

In a second terminal, run the compatibility smoke test:

```bash
API_BASE_URL=http://localhost:3107 ADMIN_PASSWORD=shazam! npm run smoke:provider-api
```

## Local Convex Development

When you are ready to create or link a Convex project, run:

```bash
npm run convex:dev
```

The Convex CLI will guide project setup and generate local Convex metadata. Do not commit deployment-specific secrets or generated environment files unless they are intentionally documented and safe for handoff.

To refresh generated Convex types after schema/function changes, run:

```bash
npm run convex:codegen
```

To run the app against Convex after linking a deployment:

```bash
CONVEX_URL=<your-convex-url> DATA_STORE_PROVIDER=convex ATTACHMENT_STORE_PROVIDER=local ADMIN_AUTH_PROVIDER=password PORT=3108 npm run dev
```

Then smoke the same API surface:

```bash
API_BASE_URL=http://localhost:3108 ADMIN_PASSWORD=shazam! npm run smoke:provider-api
```

Attachments stay on the local provider for now. Convex attachment storage is a separate Phase 4 slice.

## Schema Notes

The schema preserves the current public API IDs as app-level string fields:

- `sessions.sessionId`
- `cards.cardId`
- `connections.connectionId`
- `notes.noteId`
- `attachments.attachmentId`
- `adminSessions.sessionId`

This keeps the existing URLs, exports, imports, PartyKit room names, and client payloads stable while the `DATA_STORE_PROVIDER=convex` adapter maps those string IDs to Convex documents.

## What Is Not Implemented Yet

- Convex sessions, cards, connections, and shared notes provider code exists, but SQLite remains the default fallback.
- No frontend screen reads directly from Convex.
- No attachment upload URL flow is active yet.
- No SQLite/local fallback removal is approved.
- No production Vercel or Convex environment is configured.
