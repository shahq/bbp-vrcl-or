# Convex Local Setup

This project includes Convex schema/functions, a `DATA_STORE_PROVIDER=convex` adapter for sessions, cards, connections, and shared notes, and an `ATTACHMENT_STORE_PROVIDER=convex` adapter for attachment metadata and source document storage. The app still runs on the existing SQLite/local-file backend by default.

## Current State

- Runtime default: `DATA_STORE_PROVIDER=sqlite`
- Attachment default: `ATTACHMENT_STORE_PROVIDER=local`
- Admin auth default: `ADMIN_AUTH_PROVIDER=password`
- Convex schema and functions live in `convex/`
- `DATA_STORE_PROVIDER=convex` and `ATTACHMENT_STORE_PROVIDER=convex` require `CONVEX_URL` or `VITE_CONVEX_URL`
- No production Convex deployment, URL, or secret is required for the current app runtime

Shell-provided environment variables take precedence over `.env` and `.env.local`, so local smoke tests can force the fallback providers even when a developer has stale provider values in `.env.local`:

```bash
DATA_STORE_PROVIDER=sqlite ATTACHMENT_STORE_PROVIDER=local ADMIN_AUTH_PROVIDER=password PORT=3107 npm run dev
```

In a second terminal, run the compatibility smoke test:

```bash
API_BASE_URL=http://localhost:3107 ADMIN_PASSWORD=shazam! npm run smoke:provider-api
```

## Local PartyKit

PartyKit remains the realtime layer for presence, cursors, canvas sync, and timer broadcast. Local browser websocket errors to `ws://localhost:1999/parties/main/session-...` usually mean the PartyKit dev process is not running.

Use two terminals for local UI testing:

```bash
npm run partykit:dev
```

```bash
npm run dev
```

Keep these env values aligned in `.env.local` for local testing:

```bash
PARTYKIT_HOST=localhost:1999
VITE_PARTYKIT_HOST=localhost:1999
VITE_PARTYKIT_PARTY=main
PARTYKIT_ADMIN_SECRET=shazam!
ADMIN_PASSWORD=shazam!
```

If `PARTYKIT_ADMIN_SECRET` is omitted, both the app server and PartyKit fall back to `ADMIN_PASSWORD`. If one side has a different secret, admin/timer websocket permissions will degrade even if the socket connects.

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

To run the app data provider against Convex after linking a deployment:

```bash
CONVEX_URL=<your-convex-url> DATA_STORE_PROVIDER=convex ATTACHMENT_STORE_PROVIDER=local ADMIN_AUTH_PROVIDER=password PORT=3108 npm run dev
```

Then smoke the same API surface:

```bash
API_BASE_URL=http://localhost:3108 ADMIN_PASSWORD=shazam! npm run smoke:provider-api
```

To run the app data and attachment providers against Convex after linking a deployment:

```bash
CONVEX_URL=<your-convex-url> DATA_STORE_PROVIDER=convex ATTACHMENT_STORE_PROVIDER=convex ADMIN_AUTH_PROVIDER=password PORT=3108 npm run dev
```

Then smoke the attachment API surface:

```bash
API_BASE_URL=http://localhost:3108 ADMIN_PASSWORD=shazam! EXPECT_ATTACHMENT_RELATIVE_PATH_PREFIX=convex-storage:// npm run smoke:attachments-api
```

To include the direct Convex Storage upload URL path:

```bash
API_BASE_URL=http://localhost:3108 ADMIN_PASSWORD=shazam! EXPECT_ATTACHMENT_RELATIVE_PATH_PREFIX=convex-storage:// SMOKE_DIRECT_ATTACHMENT_UPLOAD=1 npm run smoke:attachments-api
```

## Attachment Binary Durability

- `ATTACHMENT_STORE_PROVIDER=local` stores original file bytes under `data/sessions/<session-id>/attachments/` and metadata in `attachments.json`.
- `ATTACHMENT_STORE_PROVIDER=convex` stores original file bytes in Convex Storage and stores attachment metadata, extracted text, summaries, and source notes in Convex data.
- Direct browser uploads use a Convex Storage upload URL for the original bytes, then the server downloads the stored file into a temporary local path only to run the existing extraction script. The temporary file is deleted after extraction.
- ZIP session archive import/export still uses local session directories and is not yet Convex-storage durable.

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
- No SQLite/local fallback removal is approved.
- No production Vercel or Convex environment is configured.
