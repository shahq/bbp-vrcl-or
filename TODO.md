# Beyond Bullet Points - MVP Implementation Plan

**Status:** Phase 4 COMPLETE ✅ | Guest Brief, Export, and Restore Polish Active

**Last Updated:** 2026-05-19

## Goal
Create a working prototype (MVP) for the Beyond Bullet Points Exercise that Shahid can share and test among peers and BDO executives. The tool helps structure presentations using the "Beyond Bulletpoints" methodology through an AI-assisted canvas interface.

---

## Notepad Implementation Plan (2026-05-19)

Build a shared canvas notepad that works for admins and guests with edit access, persists with session data, syncs across live participants, and exports as `Notes`.

- [x] Keep notepad data separate from onboarding `project_notes` so workshop notes do not get mixed with the project brief.
- [x] Add a `SessionNote` model with a default `session-notes` record and future support for multiple note blocks.
- [x] Add a backend `NoteStore` seam alongside session/card/connection/attachment stores.
- [x] Implement local filesystem notes storage as `data/sessions/<sessionId>/notes.json`.
- [x] Implement Firestore notes storage under each session document.
- [x] Add note API routes:
  - `GET /api/sessions/:id/notes`
  - `POST /api/sessions/:id/notes`
  - `PUT /api/sessions/:id/notes/:noteId`
  - `DELETE /api/sessions/:id/notes/:noteId`
- [x] Replace the right-panel Notepad placeholder with an editable shared Notes block.
- [x] Use existing admin/session-password edit permission checks for note writes.
- [x] Add debounced autosave and visible save state in the notepad UI.
- [x] Broadcast note updates through PartyKit so admin and guest canvases stay in sync.
- [x] Include notes in full DOCX export under a top-level `Notes` section.
- [x] Include notes in ZIP export as `notes.json` and `Notes.md`.
- [x] Include notes in JSON and Markdown exports.
- [x] Restore notes when importing an exported session ZIP, while keeping older ZIPs without notes importable.
- [ ] Add browser smoke coverage for simultaneous admin/guest note editing once the collaboration test harness exists.
- [ ] Manually test notes across admin and guest browser sessions before marking the notepad fully accepted.
- [ ] Decide whether card-specific local notes should be promoted into persisted/exported session data or removed to avoid confusion with the shared notepad.

## Shahid Checklist Reconciliation (2026-05-19)

Compared against the working TODO list and added missing follow-ups below.

### Completed
- [x] Import ZIP files back into sessions through **Upload Session**. Current mode replaces the current persistent session from a ZIP archive; create-new-session and merge modes remain separate follow-ups.
- [x] Preserve exported ZIP archives as portable saved copies of a session.
- [x] Fix story generation so **Assemble My Story** creates one current-user story output instead of creating duplicate story clutter after refresh.
- [x] Remove the old canvas chat **Generate background description** starter button.
- [x] Let visitors with edit access return to the brief and edit it.
- [x] Add optional password protection for sessions, including admin-created generated session passwords.
- [x] Keep card notes as a local card detail area and remove the old synthesize action from that panel.
- [x] Collapse the project overview by default in the canvas chat/right panel.
- [x] Replace unclear chevrons with clearer plus/minus expand controls for project overview.
- [x] Add Shahid mockup-style **Save Doc** and **Save Canvas** controls to the canvas footer.
- [x] Add overview DOCX export from the project overview flow.
- [x] Add unsaved-change handling around project overview edits in the brief flow.
- [x] Start the Create Project Brief chat with an invitation before the questionnaire begins.
- [x] Move the Create Project Brief invitation from center stage into the chat flow after the first user action.
- [x] Add threaded, color-coded story connectors with per-user story assembly.
- [x] Fix first-run card generation so questionnaire fields such as "You are" feed the initial card generation path.
- [x] Add shared Notes panel implementation, storage, realtime sync, and export support.
- [x] Add Word document export as the visible primary document export path.

### Follow-ups Added
- [ ] Chat should explicitly ask "Would you like me to add this to the overview?" before applying generated overview text.
- [ ] Make questionnaire/prompts appear as highlighted agent-style prompt blocks above the chat bar.
- [ ] Let users drag an existing connector off a card to disconnect it.
- [ ] Convert the Project Overview section into a reusable component Shahid can use for client onboarding.
- [ ] Add focused notepad QA for admin/guest sync, ZIP restore, DOCX export, and empty-state behavior.

## Project Overview

### What is "Beyond Bullet Points"?
**Beyond Bullet Points** is a storytelling methodology for creating compelling presentations that move beyond dry, bullet-pointed slides. Instead of listing facts, it structures presentations as a narrative journey that engages the audience emotionally and intellectually.

### The 6-Column Story Framework + Story Output
The tool uses a 6-column canvas to structure presentations, plus a Story output column:

1. **Place** - The setting/situation where the story begins
2. **Role** - The audience's role/part in the narrative
3. **Challenge** - The obstacle or problem to overcome
4. **Point A** - The current state (where we are now)
5. **Point B** - The desired destination (where we need to be)
6. **Change** - The transformation required to get from A to B

When connected in sequence, these elements form a complete transformation story.

### Who Is This For?
- **Primary:** BDO executives and corporate consultancy teams
- **Secondary:** Internal design consultancy teams
- **Use Case:** Client presentations, workshop facilitation, strategic storytelling

### How It Works
1. **Admin** logs in and creates a session (with optional password protection)
2. **Admin** completes the "New Project" onboarding (client info, deterministic questionnaire, AI-assisted project overview, and card generation)
3. **Admin** shares the session URL with team members: `website.com/bdo-xxxx`
4. **Players** access the session and collaborate on the canvas
5. **Cards** are organized across the 6 columns to build the narrative
6. **Connections** between cards create color-coded story flows, with separate threads for parallel paths
7. **Export** the final story as DOCX, ZIP, Markdown, or JSON

### Key Features
- 🔐 **Password Protection:** Optional session-level passwords for sensitive projects
- 🤖 **AI Integration:** Generate ideas through the server AI provider seam
- 🎨 **Visual Canvas:** Drag-and-drop interface with 6 columns
- 🔗 **Story Flows:** Connect cards to create narrative sequences, including parallel color-coded threads
- 📤 **Export/Restore:** Download sessions as DOCX, ZIP, Markdown, JSON, or PDF, and restore the current session from exported ZIP archives
- 👥 **Collaboration:** Real-time multiplayer through PartyKit
- 🧭 **Deterministic Briefing:** Configurable questionnaire turns owner-defined answers into a project overview

### Tech Stack
- **Frontend:** React 19 + TypeScript + Tailwind CSS
- **Backend:** Express + SQLite + better-sqlite3
- **Storage:** Hybrid (SQLite index + Markdown files)
- **AI:** Server-owned provider layer for Gemini, Opencode proxy, and OpenRouter-compatible models
- **Real-time:** PartyKit

---

## REVISED Architecture (Updated 2026-03-15)

### Authentication & User Roles

**Admin (Global Access)**
- Password: `shazam!` (set via env variable `ADMIN_PASSWORD`)
- Login once at `/` to access entire system
- Can create/manage all sessions
- Bypasses all session passwords automatically
- Only role that can do onboarding (New Project flow)
- Sees dashboard with all sessions after login

**Players/Guests (Session Access)**
- Access via direct URL: `website.com/bdo-xxxx`
- Can view session without any authentication
- Can edit only if:
  - Session has no password (open), OR
  - Session has password and they enter it correctly
- Never see the initial setup-only onboarding while a session is incomplete
- Can return from a completed canvas to the Create Project Brief page and edit Project Overview or notes when they have edit access
- Can manage uploaded brief documents and regenerate cards when they have edit access

**Future Roles (Post-MVP)**
- Lead Guest: Could do onboarding if delegated by admin
- Standard Guest: View/edit only, no onboarding

---

### URL Structure

```
/                    → Admin login page (if not logged in)
/                    → Admin dashboard (if logged in)
/bdo-xxxx            → Session view (onboarding if not done, else canvas)
/bdo-xxxx?mode=edit  → Attempt edit mode (may require password)
```

---

### Session Creation Flow

1. **Admin clicks "Create Session"**
   - Prompt: "Session name?"
   - Prompt: "Require password for players? (yes/no)"
     - If YES: Auto-generate hex password, show to admin
     - If NO: Session is open (no password required)
   - Session created, auto-redirects to `/bdo-xxxx`

2. **Onboarding Phase (Admin Only)**
   - Session starts in "New Project" view (onboarding)
   - Players trying to access see: "Session setup in progress"
   - Admin completes: client, background, AI generation
   - Onboarding completion creates initial cards
   - Then canvas appears for everyone

3. **Player Access**
   - If onboarding not done: See "Setup in progress" message
   - If onboarding done: See canvas immediately
   - If session has password: Prompt for password on edit attempt

---

## Core Architecture: Hybrid File System + SQLite

### File Structure
```
/data/
  /sessions/
    /{sessionId}/                    # e.g., /sessions/bdo-k4d3/
      ├── session.json               # Session metadata, project info
      ├── cards-index.json           # Fast lookup index for cards
      ├── connections.json           # Card relationship graph
      └── cards/                     # Individual card files (Markdown)
          ├── place-001.md
          ├── role-001.md
          └── story-001.md
```

### Card Format (Markdown with YAML Frontmatter)
```markdown
---
id: place-001
section: place
createdAt: '2026-03-14T10:30:00Z'
updatedAt: '2026-03-14T11:15:00Z'
starred: true
order: 1
---

They are at a crossroads in their business...
```

**Why this structure:**
- ✅ AI-readable: LLMs process Markdown natively with YAML context
- ✅ Export-friendly: ZIP the folder or concatenate files
- ✅ Human-readable: Files can be opened in any text editor
- ✅ Flexible: Easy to transform to PDF, PowerPoint, or other formats

---

## Backend Architecture (Express + SQLite)

### Revised Database Schema

```sql
-- Sessions table (UPDATED)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,              -- e.g., "bdo-k4d3"
  name TEXT NOT NULL,               -- Display name
  password_hash TEXT,               -- NULL = open session, otherwise bcrypt hashed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  project_client TEXT,
  project_background TEXT,
  project_notes TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,  -- NEW: Tracks if onboarding done
  is_archived BOOLEAN DEFAULT FALSE
);

-- Admin sessions (NEW: track admin logins)
CREATE TABLE admin_sessions (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);

-- Cards index (for fast queries)
CREATE TABLE cards (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  section TEXT NOT NULL,
  file_path TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  starred BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Connections table
CREATE TABLE connections (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  from_card_id TEXT NOT NULL,
  to_card_id TEXT NOT NULL,
  thread_id TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (from_card_id) REFERENCES cards(id) ON DELETE CASCADE,
  FOREIGN KEY (to_card_id) REFERENCES cards(id) ON DELETE CASCADE
);
```

### API Endpoints (UPDATED)

**Authentication:**
```
POST /api/admin/login          # Admin login with password
POST /api/admin/logout         # Admin logout
GET  /api/admin/check          # Check if admin is logged in
```

**Session Management:**
```
GET  /api/sessions              # List all sessions (requires admin auth)
POST /api/sessions              # Create new session (requires admin auth)
  Body: { name, require_password: boolean, project_client?, project_background?, project_notes? }
GET  /api/sessions/:id          # Get session (public, onboarding_completed affects view)
PUT  /api/sessions/:id          # Update session (requires admin auth or session password)
DELETE /api/sessions/:id        # Delete session (requires admin auth)
POST /api/sessions/:id/complete-onboarding  # Mark onboarding done (requires admin auth)
POST /api/sessions/:id/verify   # Verify session password
```

**Cards:**
```
GET    /api/sessions/:id/cards        # Get all cards for session (public)
POST   /api/sessions/:id/cards        # Create new card (requires admin auth or session password)
PUT    /api/sessions/:id/cards/:cid   # Update card (requires admin auth or session password)
DELETE /api/sessions/:id/cards/:cid   # Delete card (requires admin auth or session password)
POST   /api/sessions/:id/cards/reorder # Reorder cards (requires admin auth or session password)
```

**Connections:**
```
GET  /api/sessions/:id/connections     # Get all connections (public)
POST /api/sessions/:id/connections     # Create connection (requires auth or password)
  Body: { from, to, threadId?, color? }
DELETE /api/sessions/:id/connections/:id # Delete connection (requires auth or password)
POST /api/sessions/:id/connections/bulk  # Bulk update (requires auth or password)
```

**Export:**
```
GET /api/sessions/:id/export/zip       # Download ZIP (public)
GET /api/sessions/:id/export/docx      # Download formatted full-session Word document (public)
GET /api/sessions/:id/export/overview-docx # Download formatted overview Word document (public)
GET /api/sessions/:id/export/markdown # Download markdown (public)
GET /api/sessions/:id/export/json      # Download JSON (public)
POST /api/sessions/:id/import/zip      # Replace current session from exported ZIP (requires admin auth or session password)
```

---

## Implementation Phases (REVISED)

### Phase 3A: Admin Authentication & Optional Session Passwords
**Priority: CRITICAL** - ✅ COMPLETED

1. **Admin Authentication**
   - [x] Add `ADMIN_PASSWORD=shazam!` to .env
   - [x] Create admin login API endpoint
   - [x] Session-based admin auth (simple, no JWT)
   - [x] Admin middleware for protected routes
   - [x] Login page component

2. **Revised Session Creation**
   - [x] Update database schema (make password_hash nullable)
   - [x] Add `onboarding_completed` flag to sessions table
   - [x] Update POST /api/sessions to accept `require_password: boolean`
   - [x] If yes: generate password, return it to admin
   - [x] If no: set password_hash to NULL

3. **Updated Password Verification**
   - [x] Check if admin is logged in → bypass all passwords
   - [x] Check if session.password_hash is NULL → allow edit
   - [x] Check if password provided matches → allow edit
   - [x] Otherwise → read-only mode

4. **Session URL Routing**
   - [x] Install react-router-dom
   - [x] Route `/` → Login or Dashboard
   - [x] Route `/:sessionId` → Session view
   - [x] Handle invalid session IDs gracefully

### Phase 3B: Per-Session Onboarding
**Priority: HIGH** - ✅ COMPLETED

1. **Onboarding State Management**
   - [x] Add `onboarding_completed` boolean to session data
   - [x] Create `/api/sessions/:id/complete-onboarding` endpoint
   - [x] Only admin can call this endpoint

2. **Session View Logic**
   - [x] If `onboarding_completed === false`:
     - Admin sees: Onboarding (New Project) view
     - Players see: "Session setup in progress" message
   - [x] If `onboarding_completed === true`:
     - Everyone sees: Canvas with cards

3. **Onboarding Flow**
   - [x] Admin creates session → auto-redirects to `/bdo-xxxx`
   - [x] Shows New Project interface (existing component)
   - [x] Admin completes project info + AI generation
   - [x] Cards are created and saved
   - [x] Call complete-onboarding endpoint
   - [x] View switches to canvas automatically

4. **Player Access During Onboarding**
   - [x] Show friendly "Session setup in progress" screen
   - [ ] Auto-refresh or WebSocket to detect when ready (Future)
   - [ ] Optional: "Notify me when ready" feature (Future)

### Phase 3C: Frontend Updates
**Priority: HIGH** - ✅ COMPLETED

1. **Login Page**
   - [x] Simple login form with password input
   - [x] "shazam!" as placeholder
   - [x] Error handling for wrong password
   - [x] Redirect to dashboard on success

2. **Updated Admin Dashboard**
   - [x] Only accessible after login
   - [x] Session list with "Create Session" button
   - [x] Create session modal with yes/no password option
   - [x] Show password after creation (copy to clipboard button)
   - [x] Password visibility toggle in session list (Show/Hide/Copy)
   - [x] Store passwords in localStorage for persistence
   - [x] Delete/edit sessions

3. **Updated Sidebar**
   - [x] Only show session management if admin logged in
   - [x] Otherwise show just navigation (Workshops, etc.)
   - [x] Logout button for admin

4. **Session View Component**
   - [x] Check onboarding status on load
   - [x] Render appropriate view (onboarding, canvas, or "in progress")
   - [x] Handle password prompts for players
   - [x] Show session info (ID, password if exists)
   - [x] Center-stage password wall (like admin login)
   - [x] Hide content until password entered for protected sessions

### Phase 3D: Critical Fixes
**Priority: HIGH** - ✅ COMPLETED

1. **Card Editing**
   - [x] Enable double-click to edit cards
   - [x] Inline editing with Save/Cancel buttons
   - [x] Keyboard shortcuts (Enter to save, Escape to cancel)

2. **Card Numbering**
   - [x] Cards show consecutive numbers (#1, #2, #3, etc.)
   - [x] Sorted by order within each column
   - [x] New cards get next available index

### Phase 4: Multiplayer Real-Time (PartyKit)
**Priority: MEDIUM** - ✅ COMPLETED

1. **PartyKit Setup** ✅
   - [x] Install PartyKit dependencies (partykit, partysocket)
   - [x] Create partykit.config.ts
   - [x] Create party/index.ts server with WebSocket handling
   - [x] Create usePartyKit React hook

2. **Real-Time Sync** ✅
   - [x] Broadcast card creation (card:create)
   - [x] Broadcast card updates (card:update)
   - [x] Broadcast card deletion (card:delete)
   - [x] Broadcast card reordering (card:reorder)
   - [x] Broadcast connection changes (connection:create/delete)
   - [x] Last-write-wins conflict resolution

3. **User Presence** ✅
   - [x] Create UserProfilePrompt component (name + color selection)
   - [x] Create ActiveUsers component (avatar list)
   - [x] Create UserCursors component (cursor tracking)
   - [x] Create ConnectionStatus component
   - [x] Store user profile in localStorage

4. **Integration** ✅
   - [x] Integrate PartyKit into SessionView
   - [x] Handle incoming real-time updates
   - [x] Send outgoing updates via PartyKit
   - [x] Show active users in top-right corner
   - [x] Show connection status indicator

5. **Disconnection Handling** ✅
   - [x] Connection status indicator (Connected/Connecting/Disconnected)
   - [x] Visual feedback for connection state
   - [x] Graceful handling of disconnections

### Phase 4.5: Guest Brief + Threaded Story Polish
**Priority: HIGH** - IN PROGRESS

1. **Guest Brief Access** ✅
   - [x] Guests with edit access can use Return to brief from a completed canvas
   - [x] Guests can save Project Overview and notes edits
   - [x] Guests with edit access can manage uploads, synthesize briefs from uploads, and regenerate cards
   - [x] Admin-only project naming and session management controls stay admin-only

2. **Deterministic Create Project Brief Questionnaire** ✅
   - [x] Replace the old guided Q&A prompt flow with a configured multi-step questionnaire
   - [x] Store questionnaire copy and output mapping in `src/config/projectBriefQuestionnaire.ts`
   - [x] Send completed questionnaire answers to the AI provider seam to create a coherent project overview
   - [x] Document owner-facing questionnaire editing guidance in `PROJECT_BRIEF_QUESTIONNAIRE.md`
   - [x] Normalize questionnaire typography and use embedded arrow submit buttons for message inputs

3. **Canvas Chat Simplification** ✅
   - [x] Remove the old Generate background description starter button from admin and guest canvas sessions

4. **Threaded Story Connections** ✅
   - [x] Add `threadId` and `color` metadata to connection state, API payloads, SQLite, Firestore adapters, exports, and PartyKit messages
   - [x] Use thread colors to distinguish parallel story paths
   - [x] Keep late upstream connections in the existing downstream thread when appropriate
   - [x] Assemble only the current user's thread via **Assemble My Story**
   - [x] Make individual connection strings selectable and deletable with Delete or Backspace
   - [x] Allow multiple users to connect through the same cards with owner-aware connection IDs
   - [x] Add Show/Hide Others' Threads visibility control
   - [x] Clean invalid downstream connections when a user's path is reconfigured

5. **Remaining Thread Management Polish**
   - [ ] Expose whole-thread selection/deletion in addition to current single-connection deletion
   - [x] Consider a lightweight thread legend or affordance if users need clearer thread identity
   - [ ] Let users drag an existing connector off a card to disconnect it

6. **Project Overview Document Export**
   - [x] Replace the current browser-generated `.doc` HTML download with a real Word `.docx` export
   - [x] Support the export from both the Create Project Brief / overview screen and the canvas overview panel
   - [x] Prefer a server-side document generator such as `docx` so exported files are valid Office Open XML, not HTML renamed as `.doc`
   - [x] Include project/session name, Project Overview text, and optionally Additional Notes in a clean handoff-friendly template
   - [x] Decide whether guests with edit access can download directly from the same endpoint, using the existing session edit permission seam
   - [x] Add full-canvas/session `.docx` export for cards, project context, notes, and connections while keeping Markdown export available as a hidden/API route

7. **ZIP Import / Session Restore**
   - [x] Add an upload/import flow that can ingest the same ZIP format currently produced by `GET /api/sessions/:id/export/zip`
   - [x] Treat exported ZIPs as portable project archives that can update the current session
   - [x] Parse `session.json`, card markdown files, `connections.json`, and `attachments.json` when present
   - [x] Implement replace-current-session import mode
   - [ ] Add create-new-session-from-ZIP import mode
   - [ ] Add merge-into-current-session import mode
   - [x] Validate ZIP structure, reject unsafe paths, and avoid overwriting unrelated files or sessions
   - [x] Preserve IDs in replace-current-session mode so connections still point to the right cards
   - [ ] Remap IDs when a future merge import mode is added to avoid collisions
   - [ ] Document which attachment storage modes can restore original binaries versus metadata/extracted text only

8. **Shared Canvas Notepad** ✅
   - [x] Add a shared notepad to the canvas right panel for admins and guests with edit access
   - [x] Persist notes separately from onboarding `project_notes`
   - [x] Sync note updates through PartyKit
   - [x] Export notes in DOCX, ZIP, Markdown, and JSON
   - [x] Restore notes from ZIP imports
   - [ ] Complete manual admin/guest/browser smoke testing
   - [ ] Decide the long-term relationship between local card notes and exported shared notes

9. **Project Overview Reuse**
   - [ ] Extract the Project Overview display/edit/export section into a reusable component
   - [ ] Keep brief-generation, brief-editing, and canvas overview usage on the same component contract
   - [ ] Preserve current guest edit-permission behavior when extracting the component

### Phase 5: UX Enhancements
**Priority: MEDIUM**

1. **Column Help Icons**
   - [ ] Add help icons to column headers
   - [ ] Create popover/modal component
   - [ ] Write help content for each column
   - [ ] Add examples

2. **Fullscreen Mode**
   - [ ] Toggle button in toolbar
   - [ ] Hide sidebars
   - [ ] Expand canvas
   - [ ] Exit via button or Esc

3. **Auto-Save & Persistence**
   - [ ] Auto-save on card changes (debounced)
   - [ ] Visual save indicator
   - [ ] Last saved timestamp

4. **Polish & Bug Fixes**
   - [ ] Test all export formats
   - [ ] Verify AI-readability of exports
   - [ ] Fix edge cases
   - [ ] Performance optimization

---

## Environment Variables

```bash
# Required
GEMINI_API_KEY=your_key_here
OPENCODE_API_KEY=your_key_here
ADMIN_PASSWORD=shazam!

# Optional
PARTYKIT_TOKEN=for_realtime_sync
DATABASE_PATH=./data/sessions.db
FILE_STORAGE_PATH=./data/sessions
```

---

## Success Criteria for MVP (REVISED) - Updated 2026-03-15

### Must Have (P0) - ✅ COMPLETED
- [x] Admin login with `shazam!` password
- [x] Admin dashboard with all sessions
- [x] Create sessions with optional player password (yes/no)
- [x] Password visibility in session list (Show/Hide/Copy)
- [x] Session URLs: `website.com/bdo-xxxx`
- [x] Per-session onboarding (admin only)
- [x] "Setup in progress" screen for players during onboarding
- [x] Password wall hides content until password entered
- [x] Guests with edit access can return to the completed brief and save overview/notes edits
- [x] Cards save to individual markdown files
- [x] ZIP export working (backend)
- [x] DOCX export working (overview and full session)
- [x] ZIP replace-current-session import working (backend and UI)
- [x] Markdown export working (backend)
- [x] JSON export working (backend)
- [x] Double-click editing on cards
- [x] Consecutive card numbering
- [x] Deterministic Create Project Brief questionnaire documented and wired to project overview generation

### Should Have (P1) - MOSTLY COMPLETED ✅
- [ ] Help icons on all columns
- [ ] Fullscreen mode
- [x] Connect export buttons to backend
- [x] Real `.docx` Project Overview export from overview and canvas screens
- [x] Import exported ZIP archives to replace the current session
- [ ] Import exported ZIP archives to create new sessions or merge into current sessions
- [x] Real-time sync (2+ users see changes) - ✅ PartyKit implemented
- [x] Color-coded thread metadata for parallel story paths
- [x] Per-user story assembly
- [x] Individual connection selection/delete
- [x] Show/Hide Others' Threads canvas control
- [ ] Visual save indicator / last-saved timestamp

> **Note:** Phase 4 (PartyKit) is now complete! Real-time multiplayer sync is working. When multiple users join a session, they will see each other's changes instantly.

### Nice to Have (P2) - PARTIAL
- [x] JSON export
- [ ] Session duplicate
- [ ] Archive old sessions
- [x] User presence indicators - ✅ Implemented with PartyKit
- [ ] Thread management polish: expose whole-thread selection/deletion in addition to the current selectable single-connection delete behavior.

---

## Notes for Future (Post-MVP)

**Lead Guest Concept:**
- One "lead" participant per session who can:
  - Do onboarding if admin delegates
  - Manage the session flow
  - Kick/ban disruptive users
- Admin can promote any participant to lead

**Multiplayer Onboarding Ideas:**
- Option A: Collaborative onboarding (everyone contributes)
- Option B: Locked until admin finishes, then unlocked
- Option C: Template-based (skip onboarding, use preset)

---

**Last Updated:** 2026-05-19
**Status:** Phase 4 COMPLETE ✅ | Guest Brief, Export, and Restore Polish Active
**Next Step:** Finish thread management polish, ZIP import merge/new-session modes, and attachment binary restore documentation
