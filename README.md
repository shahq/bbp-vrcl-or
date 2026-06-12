# Beyond Bullet Points

Beyond Bullet Points is a collaborative presentation-planning canvas built around the Beyond Bullet Points Act I workflow. It supports admin-managed workshop sessions, public participant links, document-assisted project briefs, AI-generated headline cards, realtime collaboration, threaded story assembly, shared notes, and export/import workflows.

This repo is currently in a Vercel + Convex recovery/migration track. The product UI shell comes from the recovered Firebase-era branch, while backend/provider work is being moved behind seams so the app can be handed off without hardcoded infrastructure assumptions.

## Current Architecture

- React 19 + TypeScript + Vite frontend.
- Express API server for local development and the current compatibility API surface.
- SQLite and local files remain the default local fallback.
- Convex providers exist for sessions, cards, connections, notes, attachment metadata, and Convex File Storage.
- PartyKit remains the realtime layer for presence, cursors, card sync, canvas timer broadcast, and live draft updates.
- Server-owned AI provider seam supports Opencode, Google/Gemini, OpenRouter, OpenAI, and Anthropic Claude.
- Document extraction still runs through the existing server-side extraction path and is a deferred migration decision.

The active migration source of truth is [docs/CONVEX_VERCEL_MIGRATION_PLAN.md](docs/CONVEX_VERCEL_MIGRATION_PLAN.md). Firebase and Cloud Run files remain in the repo as historical or fallback context and should not be treated as the active deployment direction unless a human explicitly reactivates them.

## Product Surface

- Admins sign in at `/login` and manage sessions from the dashboard at `/`.
- Participants join public session URLs such as `/bdo-xxxx`.
- Sessions can be open or password-protected.
- The new-project flow collects project context, uploaded source documents, and a project overview before the canvas is generated.
- Uploaded documents can be renamed, summarized, used for brief synthesis, and included in exports.
- Completed canvases can return to the brief for edits and card regeneration behind confirmation.
- The canvas supports card creation, editing, reordering, starring, connection drawing, shared notes, chat, and DOCX/ZIP/Markdown/JSON/PDF export.
- Exported session ZIP files can be imported back into an existing session as a replace-current-session restore path.

## Act I Canvas

The live Act I contract is owned by [src/config/canvasSections.ts](src/config/canvasSections.ts) and [src/config/act1PromptSpec.ts](src/config/act1PromptSpec.ts).

The canvas columns are:

- `place` - Setting
- `role` - Role
- `point_a` - Challenge
- `point_b` - Desired end state
- `change` - How do we get there?
- `story` - Story Foundation

AI generation targets three headline options for each non-story Act I column, with an 80-character generation target and a 90-character saved-card validation limit. Story cards are assembled output and can hold longer text.

## AI Prompt Contract

[SYSTEM_PROMPTS.md](SYSTEM_PROMPTS.md) is the human-readable prompt reference for chat, card generation, and project overview generation. It is a reference document, not the runtime owner. Runtime card-generation wording is centralized in [src/config/act1PromptSpec.ts](src/config/act1PromptSpec.ts), while parsing, validation, provider fallback, and network behavior remain in the AI service layer.

[BBP_ACT1_GENERATION_SPEC.md](BBP_ACT1_GENERATION_SPEC.md) is the detailed Act I headline-generation spec. Keep it aligned with the runtime prompt module when changing card-generation behavior.

The current Act I generation rules are:

- Generate Act I as a progressive narrative argument, not isolated cards.
- Produce exactly three options for each non-story section.
- Keep generated options to 80 characters or less; saved Act I cards validate against 90 characters.
- Use one idea per sentence, active voice, present tense, conversational language, and compressed phrasing.
- Determine a single audience perspective from the project overview: direct audience mode (`you`, `your`) or shared perspective mode (`we`, `our`, `us`).
- Keep that perspective consistent across Setting, Role, Challenge, Desired end state, and How do we get there?
- Vary sentence openings; do not default every option to `You...`.
- Avoid corporate jargon, product names, product features, implementation details, technical architecture, marketing claims, company-centric framing, and repeated ideas across sections.
- Let Challenge introduce grounded friction or selective stakes, Desired end state define the improved future state, and How do we get there? define the required strategic shift.

Project overview prompts should synthesize uploaded source material or questionnaire answers into editable facilitator prose. They should preserve supported facts, avoid invented details, and return clean prose rather than headings, bullets, labels, or final marketing copy.

## Provider Modes

Default local mode:

```bash
DATA_STORE_PROVIDER=sqlite
ATTACHMENT_STORE_PROVIDER=local
ADMIN_AUTH_PROVIDER=password
SESSION_FILE_STORE_PROVIDER=local
```

Convex verification mode:

```bash
CONVEX_URL=<your-convex-url>
DATA_STORE_PROVIDER=convex
ATTACHMENT_STORE_PROVIDER=convex
ADMIN_AUTH_PROVIDER=password
```

Vercel compatibility API mode should use durable/serverless-safe providers:

```bash
CONVEX_URL=<your-convex-url>
DATA_STORE_PROVIDER=convex
ATTACHMENT_STORE_PROVIDER=convex
ADMIN_AUTH_PROVIDER=stateless
SESSION_FILE_STORE_PROVIDER=none
```

Do not remove SQLite or local attachment storage yet. They are intentional fallbacks until Convex/Vercel behavior is fully accepted.

## Environment Variables

Use `.env.local` for local development. Do not commit secrets.

Core local values:

```bash
AI_PROVIDER=opencode
AI_DEFAULT_MODEL=minimax-m3
DATA_STORE_PROVIDER=sqlite
ATTACHMENT_STORE_PROVIDER=local
ADMIN_AUTH_PROVIDER=password
ADMIN_PASSWORD=shazam!

PARTYKIT_HOST=localhost:1999
PARTYKIT_ADMIN_SECRET=shazam!
VITE_PARTYKIT_HOST=localhost:1999
VITE_PARTYKIT_PARTY=main
```

Provider keys are server-only:

```bash
OPENCODE_API_KEY=
GOOGLE_API_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
CLAUDE_API_KEY=
```

Convex-backed runs also need:

```bash
CONVEX_URL=
```

`VITE_API_BASE_URL` should usually be unset for same-origin local development. Set it only when a separately hosted frontend needs to call a separate backend origin. Browser-safe `VITE_*` variables must not contain server secrets.

## Local Setup

Install dependencies:

```bash
npm install
```

Run PartyKit in one terminal:

```bash
npm run partykit:dev
```

Run the Express/Vite app in another terminal:

```bash
npm run dev
```

Open:

- `http://localhost:3000/login`

For a non-default local port, set `PORT` explicitly:

```bash
PORT=3107 npm run dev
```

## Convex Local Setup

Convex schema and functions live in `convex/`. To create or link a Convex deployment:

```bash
npm run convex:dev
```

Refresh generated Convex types after schema/function changes:

```bash
npm run convex:codegen
```

Detailed local Convex instructions are in [docs/CONVEX_LOCAL_SETUP.md](docs/CONVEX_LOCAL_SETUP.md).

## Vercel Status

The repo includes a Vercel configuration and a thin `/api/*` compatibility wrapper:

- [vercel.json](vercel.json)
- [api/[...].js](api/[...].js)
- [scripts/build-vercel-api.mjs](scripts/build-vercel-api.mjs)

The live frontend preview is documented in [docs/VERCEL_FRONTEND_PREVIEW.md](docs/VERCEL_FRONTEND_PREVIEW.md). Phase 5 compatibility details and known blockers are in [docs/VERCEL_PHASE5_COMPATIBILITY_PLAN.md](docs/VERCEL_PHASE5_COMPATIBILITY_PLAN.md).

Treat Vercel + Convex as the active target, but do not assume production cutover is complete. Document extraction remains the biggest unresolved serverless concern, and any Railway or new paid infrastructure assumption requires explicit approval.

## Useful Scripts

```bash
npm run dev
npm run build
npm run build:staging
npm run preview
npm run lint
npm run clean
npm run convex:dev
npm run convex:codegen
npm run partykit:dev
npm run partykit:deploy
npm run smoke:provider-api
npm run smoke:attachments-api
npm run smoke:brief-from-uploads
npm run smoke:exports-api
npm run smoke:ai-api
```

## Verification

Before handing off a runtime change, run:

```bash
npm run lint
npm run build
```

For local API/provider checks:

```bash
API_BASE_URL=http://localhost:3000 ADMIN_PASSWORD=shazam! npm run smoke:provider-api
API_BASE_URL=http://localhost:3000 ADMIN_PASSWORD=shazam! npm run smoke:attachments-api
API_BASE_URL=http://localhost:3000 ADMIN_PASSWORD=shazam! npm run smoke:exports-api
```

For Convex attachment checks with direct upload enabled:

```bash
API_BASE_URL=http://localhost:3108 ADMIN_PASSWORD=shazam! EXPECT_ATTACHMENT_RELATIVE_PATH_PREFIX=convex-storage:// SMOKE_DIRECT_ATTACHMENT_UPLOAD=1 npm run smoke:attachments-api
```

Customer-facing smoke testing should include admin login, dashboard session creation, participant session access, the project brief flow, canvas generation, card editing/connection behavior, shared notes, PartyKit presence/timer behavior, and export/import paths.

## Handoff Guardrails

- Keep `/api/*` request and response behavior compatible unless a human explicitly approves a change.
- Keep SQLite and local attachment storage fallbacks until Convex paths are accepted.
- Keep PartyKit behavior unchanged unless explicitly approved.
- Do not touch billing, production env vars, deployment secrets, or new paid infrastructure assumptions without approval.
- Do not delete Firebase, Cloud Run, SQLite, or local-storage files without approval.
- Keep provider-specific logic isolated behind adapters and env-based configuration.

## Related Docs

- [docs/CONVEX_VERCEL_MIGRATION_PLAN.md](docs/CONVEX_VERCEL_MIGRATION_PLAN.md)
- [docs/CONVEX_LOCAL_SETUP.md](docs/CONVEX_LOCAL_SETUP.md)
- [docs/VERCEL_PHASE5_COMPATIBILITY_PLAN.md](docs/VERCEL_PHASE5_COMPATIBILITY_PLAN.md)
- [docs/VERCEL_FRONTEND_PREVIEW.md](docs/VERCEL_FRONTEND_PREVIEW.md)
- [docs/firebaseUI_RECOVERY_PLAN.md](docs/firebaseUI_RECOVERY_PLAN.md)
- [BBP_ACT1_GENERATION_SPEC.md](BBP_ACT1_GENERATION_SPEC.md)
- [SYSTEM_PROMPTS.md](SYSTEM_PROMPTS.md)
