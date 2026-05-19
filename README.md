# Beyond Bullet Points

Beyond Bullet Points is a collaborative storytelling canvas for building presentations with the Beyond Bullet Points framework. It combines an admin dashboard, public session links, AI-assisted idea generation, markdown-backed card storage, exports, and real-time multiplayer presence.

## What It Does

- Admins sign in at `/login` and manage all sessions from the dashboard.
- Participants join directly through a session URL like `/bdo-xxxx`.
- Sessions can be open or password-protected.
- Admins complete the initial "New Project" onboarding with client, background, and notes.
- The Create Project Brief page uses a configurable deterministic questionnaire before AI turns answers into a project overview. See [PROJECT_BRIEF_QUESTIONNAIRE.md](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/PROJECT_BRIEF_QUESTIONNAIRE.md).
- Admins and guests with edit access can upload source documents, rename uploads, import extracted summaries or text, and generate a project brief from all usable uploads.
- Completed canvases can return to the brief for edits; admins and guests with edit access can save changes and regenerate cards behind a confirmation.
- Project overviews and full canvases can be exported as real `.docx` Word documents. Sessions can also be exported as ZIP, Markdown, JSON, or PDF.
- Exported session ZIP files can be uploaded back into an existing session as a replace-current-session restore path.
- The canvas right panel includes a shared **Notes** notepad for admins and guests with edit access. Notes autosave, sync in realtime, and export with the session.
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
- Word document export via `docx`
- ZIP archive import via `jszip`
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
- `data/sessions/<sessionId>/attachments.json` - uploaded document metadata, extracted text, summaries, and source notes when available
- `data/sessions/<sessionId>/notes.json` - shared canvas notepad records exported as `Notes`

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

- Firestore persists sessions, cards, connections, shared notes, attachment metadata, extracted text, summaries, and source notes
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
7. Use the right-panel **Notepad** tab to capture shared workshop notes.
8. Use **Return to brief** as an admin or guest with edit access to save overview edits, upload documents, synthesize the overview, or regenerate cards with confirmation.
9. Export the overview or canvas as DOCX, or export the whole session as ZIP, Markdown, JSON, or PDF when the story is ready.
10. Use **Upload Session** on the Create Project Brief page to replace the current session from a previously exported session ZIP.

## Multiplayer Notes

- Users pick a display name and color when joining a session.
- Admins can edit any session without entering a session password.
- Password-protected sessions require the correct session password for edit access.
- Guests with edit access can manage brief documents and regenerate cards, but they still cannot access the admin dashboard, create/delete sessions, or complete first-time onboarding.
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
- Shared session note read/write endpoints
- Exporting project overviews as DOCX
- Exporting full sessions as ZIP, DOCX, Markdown, PDF, or JSON
- Importing exported session ZIPs into the current session as a replace-current-session restore

## Recent Changes

### Shared Notepad and Exportable Notes (2026-05-19)
- **Canvas notepad:** The right-panel **Notepad** tab is now a real shared note block instead of a placeholder. Admins and guests with edit access can update it; read-only users can view it.
- **Autosave and realtime sync:** Notepad edits autosave through the existing session edit-permission path and broadcast through PartyKit so open admin and guest canvases stay aligned.
- **Dedicated notes storage:** Notes are stored separately from onboarding `project_notes` through a `NoteStore` seam, with local `notes.json` and Firestore implementations.
- **Notes in exports:** Full DOCX exports include a top-level **Notes** section. ZIP exports include `notes.json` and `Notes.md`; Markdown and JSON exports also include notes.
- **ZIP restore:** Imported ZIP archives restore notes when `notes.json` is present and remain backward compatible with older archives that did not include notes.

### Guest Brief, DOCX Export, and ZIP Restore (2026-05-19)
- **Guest document workflows:** Guests with edit access can upload source documents, rename uploads, edit source notes, delete uploads, synthesize the project overview from all usable uploads, save brief changes, and regenerate cards.
- **All-upload synthesis:** Brief generation now sends every usable uploaded source to the AI prompt instead of silently capping at the first eight uploads.
- **Real DOCX exports:** The Project Overview page, canvas overview panel, and canvas save controls now use server-generated `.docx` files through the `docx` package instead of browser-generated HTML `.doc` files or visible Markdown exports.
- **Canvas save controls:** The canvas footer now exposes labeled **Save Doc** and **Save Canvas** actions. **Save Doc** exports a formatted Word document; **Save Canvas** downloads the portable ZIP.
- **Session ZIP restore:** The Create Project Brief page includes **Upload Session** for exported ZIP archives. Current implementation replaces the current session's metadata, cards, connections, shared notes, and attachment metadata; merge/new-session import modes remain follow-ups.
- **Attachment restore limitation:** ZIP restore currently restores attachment metadata, extracted text, summaries, source notes, and shared notepad records. Original uploaded binaries are only restorable when they were present in the exported ZIP.

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
- **Brief edit flow:** The brief can be saved without generating a canvas; completed canvases can return to the brief; edit-mode users can regenerate cards behind a destructive confirmation.
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
