# Beyond Bullet Points

Beyond Bullet Points is a collaborative storytelling canvas for building presentations with the Beyond Bullet Points framework. It combines an admin dashboard, public session links, AI-assisted idea generation, markdown-backed card storage, exports, and real-time multiplayer presence.

## What It Does

- Admins sign in at `/login` and manage all sessions from the dashboard.
- Participants join directly through a session URL like `/bdo-xxxx`.
- Sessions can be open or password-protected.
- Admins complete the initial "New Project" onboarding with client, background, and notes.
- Admins can upload source documents, import extracted summaries or text, and generate a project brief from uploads.
- Completed canvases can return to the brief for save-only edits or confirmed card regeneration.
- The canvas organizes ideas into 7 sections:
  - `place`
  - `role`
  - `challenge`
  - `point_a`
  - `point_b`
  - `change`
  - `story`
- Cards can be created, edited, reordered, starred, connected, and exported.
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
- `data/sessions/<sessionId>/connections.json` - saved card connections

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
AI_DEFAULT_MODEL=minimax-m2.5
GOOGLE_API_KEY=your_google_api_key
OPENCODE_API_KEY=your_opencode_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
ADMIN_PASSWORD=shazam!
VITE_API_BASE_URL=
PARTYKIT_HOST=localhost:1999
PARTYKIT_ADMIN_SECRET=your_partykit_secret
VITE_PARTYKIT_HOST=localhost:1999
VITE_PARTYKIT_PARTY=main
```

Notes:

- `AI_PROVIDER` sets the default fallback provider for server AI routes.
- Model choice still determines provider when the selected model is vendor-specific, such as Gemini vs MiniMax vs OpenRouter models like `openrouter/auto`.
- `GOOGLE_API_KEY` and `GEMINI_API_KEY` are treated interchangeably by the server.
- Models containing `/` are treated as OpenRouter models by the server.
- In local development, the server loads both `.env` and `.env.local`, with `.env.local` taking precedence.
- If the selected model's provider is unavailable, the server falls back to an available provider instead of hard failing.
- `ADMIN_PASSWORD` defaults to `shazam!` if not set.
- Leave `VITE_API_BASE_URL` empty for same-origin local development. Set it to your backend origin when the frontend is hosted separately, for example on Firebase Hosting.
- `VITE_PARTYKIT_HOST` is used by the browser client.
- `PARTYKIT_HOST` is used by the server when minting admin tokens.

### Run the App

Start the Express/Vite app:

```bash
npm run dev
```

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

## Typical Workflow

1. Log in as admin.
2. Create a session from the dashboard.
3. Share the generated `/bdo-xxxx` URL with collaborators.
4. Complete the New Project onboarding if the session is still in setup; upload documents and generate or write the project overview brief as needed.
5. Generate the initial canvas cards, then add and connect cards across the canvas.
6. Use **Return to brief** as an admin to save overview edits or regenerate cards with confirmation.
7. Export the session as ZIP, Markdown, or JSON when the story is ready.

## Multiplayer Notes

- Users pick a display name and color when joining a session.
- Admins can edit any session without entering a session password.
- Password-protected sessions require the correct session password for edit access.
- Live cursors, presence, and card updates sync in real time through PartyKit.

## API Overview

The server exposes endpoints for:

- Admin login, logout, auth checks, and PartyKit token minting
- Session creation, listing, updating, onboarding completion, deletion, and password verification
- Attachment upload, metadata updates, deletion, and document extraction
- Card CRUD and card reordering
- Connection CRUD and bulk save
- Exporting sessions as ZIP, Markdown, or JSON

## Recent Changes

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
- **Story aggregation:** "Assemble Story" now deterministically concatenates connected cards into paragraphs — no AI call, preserves workshop intent
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
- See [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) for a detailed build journal, [`bbp-phase2.md`](./bbp-phase2.md) for the roadmap, and [`FIREBASE_BACKEND_MIGRATION_PLAN.md`](./FIREBASE_BACKEND_MIGRATION_PLAN.md) for the staged Firebase backend rewrite plan.
