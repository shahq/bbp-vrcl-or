# Beyond Bullet Points

Beyond Bullet Points is a collaborative storytelling canvas for building presentations with the Beyond Bullet Points framework. It combines an admin dashboard, public session links, AI-assisted idea generation, markdown-backed card storage, exports, and real-time multiplayer presence.

## What It Does

- Admins sign in at `/login` and manage all sessions from the dashboard.
- Participants join directly through a session URL like `/bdo-xxxx`.
- Sessions can be open or password-protected.
- Admins complete the initial "New Project" onboarding with client, background, and notes.
- The Create Project Brief page uses a configurable deterministic questionnaire before AI turns answers into a project overview. See [PROJECT_BRIEF_QUESTIONNAIRE.md](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/PROJECT_BRIEF_QUESTIONNAIRE.md).
- Admins can upload source documents, import extracted summaries or text, and generate a project brief from uploads.
- Completed canvases can return to the brief for save-only edits; admins can also regenerate cards behind a confirmation.
- The canvas organizes ideas into 7 sections:
  - `place`
  - `role`
  - `challenge`
  - `point_a`
  - `point_b`
  - `change`
  - `story`
- Cards can be created, edited, reordered, starred, connected, and exported.
- Each participant has a personal color-coded story thread. Users can share the same cards as other participants without blocking each other's paths.
- Connections carry `threadId`, color, and owner metadata so collaboration can show many threads while each participant assembles only their own story.
- Connection strings for the current user can be selected and deleted segment-by-segment with Delete or Backspace. Breaking a connection also clears invalid downstream connections in that user's thread.
- The canvas includes a **Show/Hide Others' Threads** switch so participants can view or hide other users' paths without changing saved data.
- Canvas chat can use the current session, project overview, and selected-card context.
- Multiplayer presence, cursors, and live updates run through PartyKit.

## Tech Stack

- React 19 + TypeScript
- Vite
- Express
- SQLite via `better-sqlite3`
- Markdown card files with YAML frontmatter
- PartyKit + `partysocket` for real-time collaboration
- AI support through a server-owned provider layer for Gemini, the Opencode proxy, and OpenRouter

## Key Routes

- `/login` - admin login and session join screen
- `/` - admin dashboard after login
- `/:sessionId` - public session view

## Project Data

Session data is stored locally under `data/`:

- `data/sessions.db` - SQLite database
- `data/sessions/<sessionId>/session.json` - session metadata
- `data/sessions/<sessionId>/cards/*.md` - card content
- `data/sessions/<sessionId>/connections.json` - saved card connections, including thread, color, and owner metadata

## Local Setup

### Prerequisites

- Node.js 18 or newer
- npm
- At least one AI provider key for AI generation

### Install

```bash
npm install
```

### Environment Variables

Create a `.env` file with the values you need:

```bash
AI_PROVIDER=opencode
DATA_STORE_PROVIDER=sqlite
ATTACHMENT_STORE_PROVIDER=local
ADMIN_AUTH_PROVIDER=password
AI_DEFAULT_MODEL=minimax-m2.5
GOOGLE_API_KEY=your_google_api_key
OPENCODE_API_KEY=your_opencode_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
ADMIN_PASSWORD=shazam!
VITE_API_BASE_URL=
CORS_ALLOWED_ORIGINS=https://example.web.app,https://example.firebaseapp.com
PARTYKIT_HOST=localhost:1999
PARTYKIT_ADMIN_SECRET=your_partykit_secret
VITE_PARTYKIT_HOST=localhost:1999
VITE_PARTYKIT_PARTY=main
```

Notes:

- `AI_PROVIDER` sets the default fallback provider for server AI routes.
- `DATA_STORE_PROVIDER=sqlite` keeps the current local SQLite-backed data store. Set `DATA_STORE_PROVIDER=firestore` when the Firebase-backed session/card/connection store is configured.
- `ATTACHMENT_STORE_PROVIDER=local` keeps attachment binaries and metadata on the local filesystem.
- `ATTACHMENT_STORE_PROVIDER=ephemeral` keeps uploaded files only long enough for server-side extraction, then discards the original binaries. Extracted text, summaries, and source notes still persist in Firestore. This is the recommended alpha setting if you want Firebase-backed data without enabling Cloud Storage yet.
- Set `ATTACHMENT_STORE_PROVIDER=firebase` when uploaded files should live durably in Cloud Storage and attachment metadata should live in Firestore.
- `ADMIN_AUTH_PROVIDER=password` keeps the current shared admin password flow. Firebase Auth is intentionally deferred for alpha and can be introduced later behind the existing seam.
- Model choice still determines provider when the selected model is vendor-specific, such as Gemini vs MiniMax vs OpenRouter models like `openrouter/auto`.
- `GOOGLE_API_KEY` and `GEMINI_API_KEY` are treated interchangeably by the server.
- Models containing `/` are treated as OpenRouter models by the server.
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, and `FIREBASE_STORAGE_BUCKET` are required on the backend once Firestore and Cloud Storage providers are enabled.
- In local development, the server loads both `.env` and `.env.local`, with `.env.local` taking precedence.
- If the selected model's provider is unavailable, the server falls back to an available provider instead of hard failing.
- `ADMIN_PASSWORD` defaults to `shazam!` if not set.
- Leave `VITE_API_BASE_URL` empty for same-origin local development. Set it to your backend origin when the frontend is hosted separately, for example on Firebase Hosting.
- `CORS_ALLOWED_ORIGINS` should include any deployed frontend origins that call the backend directly, such as Firebase Hosting staging and production domains.
- `VITE_PARTYKIT_HOST` is used by the browser client.
- `PARTYKIT_HOST` is used by the server when minting admin tokens.

### Run the App

Start the Express/Vite app:

```bash
npm run dev
```

### Cloud Run Backend

The backend is now containerized for Cloud Run in [Dockerfile](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/Dockerfile).

Recommended alpha backend env for Cloud Run:

```bash
NODE_ENV=production
DATA_STORE_PROVIDER=firestore
ATTACHMENT_STORE_PROVIDER=ephemeral
ADMIN_AUTH_PROVIDER=password

FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

ADMIN_PASSWORD=your_admin_password
PARTYKIT_HOST=your_partykit_host
PARTYKIT_ADMIN_SECRET=your_partykit_secret

AI_PROVIDER=google
AI_DEFAULT_MODEL=gemini-3.1-pro-preview
GOOGLE_API_KEY=your_google_api_key
```

In this alpha mode:

- Firestore persists sessions, cards, connections, attachment metadata, extracted text, summaries, and source notes
- uploaded document binaries are temporary processing artifacts and are not durably stored
- Cloud Storage can be enabled later by switching `ATTACHMENT_STORE_PROVIDER=firebase`

In a second terminal, start PartyKit for realtime collaboration:

```bash
npm run partykit:dev
```

Then open:

- `http://localhost:3000/login`

## Useful Scripts

```bash
npm run build
npm run preview
npm run lint
npm run clean
```

## Firebase Hosting

The repo now includes `firebase.json` for SPA hosting.

For the current hybrid deployment shape:

- Deploy the frontend to Firebase Hosting
- Keep the Express backend on its own host
- Set `VITE_API_BASE_URL` to the backend origin
- Set `VITE_PARTYKIT_HOST` to the PartyKit host used by the browser

Typical deploy flow:

```bash
npm run build
firebase deploy --only hosting
```

## Firestore Setup

The repo now assumes the default Firestore database in the selected Firebase project.

Current status:

- backend access uses the Firebase Admin SDK
- browser clients do not talk to Firestore directly yet
- `firestore.rules` is intentionally locked down for alpha until client-side Firebase Auth / Firestore access is introduced

Recommended setup commands:

```bash
npx -y firebase-tools@latest use staging
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes
```

## Typical Workflow

1. Log in as admin.
2. Create a session from the dashboard.
3. Share the generated `/bdo-xxxx` URL with collaborators.
4. Complete the New Project onboarding if the session is still in setup; upload documents and generate or write the project overview brief as needed.
5. Generate the initial canvas cards, then add and connect cards across the canvas.
6. Use **Assemble My Story** to concatenate the current user's connected cards in column order into a story card.
7. Use **Return to brief** as an admin or guest with edit access to save overview edits; admins can also regenerate cards with confirmation.
8. Export the session as ZIP, Markdown, or JSON when the story is ready.

## Multiplayer Notes

- Users pick a display name and color when joining a session.
- Admins can edit any session without entering a session password.
- Password-protected sessions require the correct session password for edit access.
- Live cursors, presence, and card updates sync in real time through PartyKit.
- Thread colors distinguish participant-owned story paths across connected cards.
- Each participant can have one active linear story thread across the ordered columns: `place` -> `role` -> `challenge` -> `point_a` -> `point_b` -> `change` -> `story`.
- Multiple participants can connect through the same card because connection identity includes the thread owner instead of only `from` and `to`.
- **Assemble My Story** uses only the current user's thread and sorts connected cards by column sequence, not by the order in which connections were created.
- Story cards are treated as generated results, so unconnected story cards are not dimmed when a user's thread changes.
- Individual connection strings owned by the current user are selectable and can be removed with Delete or Backspace. Whole-thread selection and deletion is still a planned polish item.
- The **Show/Hide Others' Threads** switch hides other participants' connection lines visually. Other users' lines are read-only context and do not intercept card or node interactions.

## API Overview

The server exposes endpoints for:

- Admin login, logout, auth checks, and PartyKit token minting
- Session creation, listing, updating, onboarding completion, deletion, and password verification
- Attachment upload, metadata updates, deletion, and document extraction
- Card CRUD and card reordering
- Connection CRUD and bulk save, including optional thread metadata
- Exporting sessions as ZIP, Markdown, or JSON

## Recent Changes

### Per-user Threaded Story Assembly (2026-05-18)
- **Personal story threads:** Connections now use owner-aware identity and metadata so multiple users can connect the same card pair without overwriting or blocking each other.
- **Color-coded collaboration:** User-selected colors define visible thread color. Other users' threads can be shown or hidden from the canvas without changing saved connections.
- **Current-user assembly:** The story button is now **Assemble My Story** and only assembles the current user's thread.
- **Column-order sequencing:** Assembly derives the narrative order from the connected graph and the canonical column order, not from the order in which connections were created or reconnected.
- **Downstream cleanup:** Deleting or replacing a connection clears invalid downstream links in that user's thread so later columns become selectable again. Card deletion still removes every connection touching the deleted card and also triggers downstream cleanup.
- **Story result behavior:** The `story` column is treated as an output/result column, so generated story cards do not gray out when not connected to the current user's thread.

### Guest Brief + Threaded Story Paths (2026-05-16)
- **Guest brief editing:** Guests with edit access can return from a completed canvas to the Create Project Brief page and save Project Overview or notes edits.
- **Deterministic brief questionnaire:** The Create Project Brief chat now uses a configurable multi-step questionnaire before AI turns answers into a project overview. The questionnaire is documented in [PROJECT_BRIEF_QUESTIONNAIRE.md](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/PROJECT_BRIEF_QUESTIONNAIRE.md).
- **Canvas chat simplification:** The canvas chat no longer shows the old `Generate background description` starter button.
- **Threaded connections:** Connections now store `threadId` and `color`, allowing parallel story paths to remain visually and structurally separate.
- **Per-thread story assembly:** The first threaded version grouped connected cards by thread and created separate story cards for separate paths. This was later refined into current-user-only **Assemble My Story** behavior.
- **Connection selection/delete:** Connection strings can be selected on the canvas and deleted one segment at a time with Delete or Backspace.

### Project Overview + Canvas Polish (2026-04-29)
- **Upload-generated brief:** New Project uploads can now be synthesized into a project overview brief through the AI provider seam, using extracted text, summaries, and per-upload source notes.
- **Brief edit flow:** Admins can save overview changes without generating a canvas, return to the brief from an existing canvas, or regenerate cards behind a destructive confirmation.
- **Canvas brief panel:** The right panel now shows a collapsible `Project overview [project name]` accordion instead of disconnected hero/challenge labels.
- **Chat workspace polish:** The chat context block is hidden for now, the composer is more compact, and selected cards appear as small context pills such as `Challenge-2`.
- **Selection behavior:** Clicking empty canvas space clears the selected card and hides the composer pill.
- **Generated-card refresh:** AI-generated ideas for empty cards now replace the editing placeholder immediately when generation completes.

### Role-aware UX (Slice B)
- **Auth context:** Centralized admin auth state in `src/contexts/AuthContext.tsx`
- **Sidebar hidden for non-admins:** Non-admin users no longer see the left sidebar; layout expands to fill the space
- **Compact sidebar mode:** Admins can collapse the sidebar to a narrow icon bar (`localStorage` persisted)
- **Top-bar help entry:** Play icon opens a tutorial dropdown with swappable video-provider seam

### Canvas Behavior Refinement (Slice E)
- **100-character guidance:** AI prompts now request max 100-character sentences
- **Live character counter:** Shows "X / 100" in the lower-left of each card; turns orange past the limit with "Past limit" warning
- **Story counter hidden:** Story cards skip the character counter (they hold long aggregated text)
- **Story aggregation:** "Assemble My Story" deterministically concatenates the current user's connected cards into paragraphs — no AI call, preserves workshop intent
- **Non-linear assembly fixed:** Forward DFS from all root nodes handles any wiring order

### Connection System Fixes
- **Lines stay accurate:** Continuous `requestAnimationFrame` + `ResizeObserver` keeps connection lines positioned correctly through reloads, pan, zoom, and animations
- **Reliable hit detection:** DOM-tree traversal ensures connections succeed even when clicking child elements
- **Card-to-card connections:** Hold **Shift** and drag from any card body to another card

### Inline Edit Mode Polish
- **Clean edit UI:** Edit mode looks identical to reading mode — transparent textarea, no borders, no chunky buttons
- **Auto-resize textarea:** Grows and shrinks to match content height, never clips text
- **Keyboard shortcuts:** Enter saves, Escape cancels
- **Click outside:** Clicking anywhere outside the card (including canvas background) cancels edit mode
- **Story paragraph spacing:** `whitespace-pre-wrap` preserves blank lines between aggregated paragraphs

### Bug Fixes
- **New Project scroll:** Onboarding screen now scrolls independently within the layout

## Development Notes

- The app runs as a single Express server with Vite middleware in development.
- Production serves the built app from `dist/`.
- Card files are written as Markdown with YAML frontmatter so sessions stay human-readable and export-friendly.
- See [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) for a detailed build journal, [`bbp-phase2.md`](./bbp-phase2.md) for the roadmap, [`FIREBASE_BACKEND_MIGRATION_PLAN.md`](./FIREBASE_BACKEND_MIGRATION_PLAN.md) for the staged Firebase backend rewrite plan, and [`STAGING_HANDOFF_CHECKLIST.md`](./STAGING_HANDOFF_CHECKLIST.md) for the current staging URLs, alpha tradeoffs, smoke test, and next handoff phases.
