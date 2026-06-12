# Implementation Walkthrough

This document tracks what was built, when, and why. It pairs with [`bbp-phase2.md`](./bbp-phase2.md), which defines the roadmap; this file records the actual changes.

---

## 2026-06-05 — Live shared timer controls

### Summary
Moved the canvas top-bar timer from local-only component state into the PartyKit realtime path when a session is connected. The timer still falls back to local mode if PartyKit is unavailable, but connected canvases now receive the same running timer state.

### Decisions
- **Per-session control policy:** sessions store `timer_control_mode`, defaulting to `admin`. Admins can choose `admin` or `everyone` from the dashboard and the in-session admin sidebar.
- **PartyKit owns live timer state:** timer set/start/pause/reset commands broadcast through PartyKit. Clients compute countdown display from the shared `endsAt` timestamp instead of broadcasting every second.
- **Signed settings token:** session responses include a short-lived signed settings token so PartyKit can initialize the persisted timer policy without trusting raw browser query params.

### Files changed
| File | What changed |
|------|-------------|
| `src/config/timer.ts` | New shared timer types, defaults, clamping, countdown derivation, and command reducer. |
| `party/index.ts` | Added timer messages, room snapshot timer state, signed settings-token verification, and control-policy enforcement. |
| `src/hooks/usePartyKit.ts` | Exposes shared timer state and send functions for timer commands/settings. |
| `src/components/TopBar.tsx` | Supports both local fallback mode and live shared timer mode. |
| `src/App.tsx`, `src/components/Sidebar.tsx` | Wires admin timer policy controls into the dashboard and active session sidebar. |
| `server.ts`, `src/server/*` | Persists `timer_control_mode` for SQLite/Firestore sessions and returns signed PartyKit settings tokens. |

---

## 2026-06-05 — Act I five-column generation update

### Summary
Replaced the old six-column Act I generation model with the five live headline sections from `BBP_ACT1_GENERATION_SPEC.md`: Setting, Role, Challenge, Desired end state, and How do we get there? The app keeps persisted IDs `place`, `point_a`, `point_b`, and `change` for compatibility while removing the old `challenge` ID from the live canvas.

### Decisions
- **Compatibility over ID churn:** `place` remains the persisted ID for Setting, `point_a` remains the persisted ID for Challenge, `point_b` remains the persisted ID for Desired end state, and `change` remains the persisted ID for How do we get there?
- **Challenge removed, not merged:** Local legacy `challenge` cards and their connections were deleted after a timestamped backup.
- **80-character generation target, 90-character validation:** AI prompts target 80-character headlines while inline counters and saved-card validation allow up to 90 characters for live Act I cards.
- **Prompt behavior changed:** Generated cards no longer need to start with "You are"; prompts now require varied openings and exactly three options per live section.

### Files changed
| File | What changed |
|------|-------------|
| `src/config/canvasSections.ts` | New shared section labels, order, colors, legacy ID list, and 90-character limit. |
| `src/services/ai.ts` | Replaced card prompts with the five-section Act I headline contract and stricter generated-card validation. |
| `src/components/Canvas.tsx` | Removed the Challenge column, switched to shared section order, and updated the live counter to 90. |
| `server.ts` | Added live-section filtering, API section validation, import dropping for legacy `challenge` cards, and updated export labels/order. |
| `scripts/cleanup_legacy_challenge_cards.ts` | Added local cleanup script for removing persisted legacy Challenge cards. |

---

## 2025-04-25 — Slice B: Role-aware beta UX

### Summary
Centralized auth state, removed the sidebar for non-admins, added a compact sidebar mode, and introduced a top-bar help entry point with a swappable video-provider seam.

### Decisions
- **Auth context first, then UI:** Instead of hiding the sidebar with CSS, we removed it from the DOM entirely (`return null`) so non-admin layouts never reserve dead space.
- **Compact mode persisted locally:** `localStorage` key `bbp_sidebar_compact`. No backend needed.
- **Help icon is a placeholder seam:** The dropdown uses an abstract `TUTORIALS` array. The backing video provider (Mux, YouTube, self-hosted) can be swapped later by updating the array and the click handler.
- **Type-check-first workflow:** All changes were validated with `npm run lint` and `npm run build` before being considered complete.

### Files changed
| File | What changed |
|------|-------------|
| `src/contexts/AuthContext.tsx` | **New.** Centralizes admin auth: `adminSessionId`, `isAdminVerified`, `verifyAdminSession`, `login`, `logout`, re-verify on focus/visibilitychange. |
| `src/App.tsx` | Refactored to consume `useAuth()`. Removed inline auth state. Dashboard and SessionView are now inner components inside `AppRoutes`. |
| `src/components/LoginPage.tsx` | Now uses `useAuth().login()` instead of receiving an `onLogin` prop. |
| `src/components/Sidebar.tsx` | Returns `null` when `!isAdmin`. Added compact mode (`w-16` collapsed bar) with `PanelLeftClose` / `PanelLeft` toggle. State persisted to `localStorage`. |
| `src/components/TopBar.tsx` | Added help icon (`HelpCircle`) with a dropdown tutorial list. Abstract `TUTORIALS` constant allows provider swap later. |

### 2025-04-25 — Quick win: Help icon swap
- Replaced `HelpCircle` with `Play` icon in `TopBar.tsx` for the tutorial dropdown toggle.

## 2025-04-25 — Slice E: Canvas behavior refinement (partial)

### Summary
Updated AI prompts to target concise card sentences and added a live Twitter-like character counter to card editors. This was later superseded by the 2026-06-05 Act I update, which uses a 90-character limit.

### Decisions
- **Guidance, not validation:** The counter shows the current character count and a soft warning when exceeded, but typing is never blocked.
- **Enter edit mode on focus:** Empty cards now enter inline edit mode immediately when the textarea receives focus, so the counter is always visible during typing.
- **Both editing paths covered:** The counter appears in the `editingCardId === card.id` branch, which handles both new card creation and double-click editing.

### Files changed
| File | What changed |
|------|-------------|
| `src/services/ai.ts` | Added concise-card constraints to `generateCards()` and `generateSingleIdea()` prompts. |
| `src/components/Canvas.tsx` | Added live character counter in lower-left corner of cards (`left-5` aligned with card padding, `pb-2` gap from text). Edit mode shows the over-limit warning. Empty cards enter edit mode on focus. |
| `src/components/TopBar.tsx` | Replaced `HelpCircle` with `Play` icon for tutorial dropdown toggle. |

## 2025-04-25 — Slice E (continued): Story aggregation

### Summary
Replaced AI-driven story generation with deterministic paragraph aggregation.

### Decisions
- **Deterministic assembly, not creative transformation:** Walking the connection chain backwards and joining each card's content with paragraph breaks (`\n\n`).
- **No AI call needed:** The operation is now synchronous and instant.
- **Button renamed:** "Generate Story" → "Assemble Story" with `FileText` icon to reflect the non-AI nature.
- **Preserves workshop intent:** Each source note becomes its own paragraph, avoiding AI drift.

### Files changed
| File | What changed |
|------|-------------|
| `src/components/Canvas.tsx` | Replaced `handleGenerateStory` with `handleAssembleStory`. Removed AI call. Removed unused `generatingStory` state. Updated button label and icon. |
| `src/services/ai.ts` | `generateTransformationStory` no longer imported in Canvas (still exported for potential future use). |

### Bug fix: Non-linear story assembly
**Problem:** When cards were wired non-linearly (e.g., starting with `point_a → point_b`, then adding `challenge → point_a`), the old backwards walk from a single endpoint could miss branches or stop at false endpoints.

**Fix:** Switched to a forward-walking approach:
1. Build an adjacency map (`from → [to, ...]`) from all connections
2. Find all **root nodes** (cards with no incoming connections)
3. DFS forward from every root to collect every reachable card
4. Sort collected cards by `COLUMN_ORDER` to ensure narrative sequence
5. Assemble each card's content as its own paragraph

This handles any directed graph of connections — linear, branched, or built in any order.

### Files changed
| File | What changed |
|------|-------------|
| `src/components/Canvas.tsx` | Rewrote `handleAssembleStory` with forward DFS from all roots + column-order sort. |

## 2025-04-25 — Connection system fixes

### Summary
Fixed three related issues with the canvas connection system: lines appearing in wrong positions after reload, unreliable node hit detection, and lack of card-to-card connection UX.

### Problems & Fixes

#### 1. Connection lines out of place after reload
**Problem:** `ConnectionLine` only measured DOM positions once via a single `requestAnimationFrame`. After page reload, cards were still animating in (motion.div), so initial measurements were wrong. Pan/zoom changes also weren't reflected.

**Fix:** Replaced single-frame measurement with a continuous `requestAnimationFrame` loop plus `ResizeObserver` on the start node, end node, and board container. Lines now stay accurate through animations, panning, zooming, and layout shifts.

#### 2. Node connections not always working
**Problem:** `handlePointerUp` used `document.elementFromPoint` and checked `el.id.startsWith('node-left-')`. If the pointer landed on a child element (e.g., the inner circle div) instead of the parent with the ID, the connection was silently dropped.

**Fix:** Added `findTargetCardId()` helper that traverses up the DOM tree from the hit element, looking for either a `node-left-*` ID or a `data-card-id` attribute. This ensures connections succeed regardless of which child element is actually hit.

#### 3. Card-to-card connection UX
**Problem:** Users had to hit tiny 16px node circles to create connections.

**Fix:** Added **Shift+drag** card-to-card connections:
- Hold **Shift** and drag from any card body to another card to create a connection
- The card div now has `id={`card-${card.id}`}` so ConnectionLine can anchor to it
- The existing node-based interaction still works for precision connections
- Visual feedback: connection line follows the cursor during the drag

### Files changed
| File | What changed |
|------|-------------|
| `src/components/Canvas.tsx` | Rewrote `ConnectionLine` with continuous rAF loop + ResizeObserver. Rewrote `handlePointerUp` with DOM-tree traversal for hit detection. Added Shift+pointerdown handler on cards for card-to-card connections. Added `id` and `data-card-id` to card divs. |

## 2025-04-25 — Inline card edit mode polish

### Summary
Redesigned card edit mode to look identical to normal display, fixed story card paragraph spacing, and resolved button overlap on new cards.

### Problems & Fixes

#### 1. Chunky edit mode
**Problem:** Edit mode had a boxed textarea with `p-2` padding inside a `p-5` card, plus chunky Save/Cancel buttons that took up space and overlapped the Generate Idea button.

**Fix:**
- Removed Save/Cancel buttons entirely
- Styled the `<textarea>` to look like normal card text:
  - `bg-transparent`, `font-medium leading-snug text-gray-900`
  - No border, no rounded corners, no focus ring
  - `whitespace-pre-wrap`, `resize-none`, `outline-none`
- Character counter stays visible at bottom-left during editing
- Added `Past limit` warning inline with the counter when over the configured card limit

**Interaction model:**
- **Enter** → saves and exits edit mode
- **Escape** → cancels, reverts to original text
- **Click outside the card** → cancels via document mousedown listener

#### 2. Textarea not wrapping / text cropped
**Root cause:** `<textarea>` is a scrollable viewport with a fixed intrinsic height (browser default ~2 rows). Unlike a `<div>` which expands to fit content, a textarea clips overflow by default. Previous attempts (removing `rows={1}`, adding `break-words`) didn't address the core issue: the box height was fixed.

**Fix:** Added auto-resize logic:
- `onInput` handler on both textareas sets `height = 'auto'` then `height = scrollHeight + 'px'`
- `useEffect` triggers the same resize whenever `editingCardId` or `editContent` changes (covers initial focus and external updates)
- Added `overflow-hidden` to prevent scrollbars from appearing

Result: textarea now grows and shrinks to match its content, behaving like the reading-mode `<div>`.

#### 3. Story card paragraph spacing lost
**Problem:** `handleAssembleStory` joined paragraphs with `\n\n`, but the display `<div>` collapsed whitespace, so the story looked like one wall of text.

**Fix:** Added `whitespace-pre-wrap` to the card content display `<div>`, so `\n\n` line breaks are actually rendered as blank lines between paragraphs.

#### 4. Button overlap on new cards
**Problem:** New cards started in edit mode with the chunky Save/Cancel div, pushing the Generate Idea button down and causing overlap.

**Fix:** Resolved by removing Save/Cancel buttons. For empty/new cards, the Generate Idea button sits cleanly below the inline textarea with no overlap.

### Files changed
| File | What changed |
|------|-------------|
| `src/components/Canvas.tsx` | Rewrote card content rendering: inline textarea replaces chunky edit UI. Added auto-resize `onInput` + `useEffect`. Added `whitespace-pre-wrap` to content display. Added click-outside-to-cancel. |

### Open follow-ups
- Note synthesis into a new card (RightPanel track)
- Chat apply confirmation / strict edit actions (Slice C)

## 2026-05-18 — Per-user color-coded story threads

### Summary
Refined threaded connections from global thread assembly into user-owned, color-coded story paths. The canvas now supports multiple participants using the same cards at the same time while keeping each person's story assembly private to their own thread.

### Decisions
- **One active thread per user:** A user's current thread is identified by `ownerUserId` when available, with color/thread metadata as fallback for older connection records.
- **Owner-aware connection identity:** Connection IDs now include an owner/thread key before `from` and `to`, so two users can create the same visible edge without overwriting each other in SQLite or Firestore.
- **Column order is the source of narrative order:** Story assembly uses the canonical order `place -> role -> point_a -> point_b -> change -> story`, not the chronological order in which edges were created.
- **Current-user assembly only:** The button was renamed to **Assemble My Story** and now assembles only `getCurrentUserConnections()`.
- **Story column is an output:** Story cards are generated results, not selectable hero cards, so unconnected story cards are never dimmed.
- **Other users are visual context:** The **Show/Hide Others' Threads** switch controls visibility only. Other users' connection lines are non-interactive and do not block card or node hit targets.
- **Downstream cleanup on reconfiguration:** Deleting, replacing, or breaking a connection removes invalid downstream links for that user's thread so forward columns become selectable again. Card deletion removes all direct connections touching the deleted card and also triggers downstream cleanup from that card.

### Files changed
| File | What changed |
|------|-------------|
| `src/components/Canvas.tsx` | Added owner-aware thread filtering, per-user assembly, downstream cleanup, story-column dimming exception, current-user-only connection selection/delete, and the Show/Hide Others' Threads control. |
| `src/server/connections.ts` | Updated SQLite connection IDs to include owner/thread identity and preserved `threadId`, `color`, and `ownerUserId` in connection mirrors and bulk saves. |
| `src/server/data/firestore/connections.ts` | Updated Firestore connection IDs to include owner/thread identity so parallel users can share the same card pair. |

---

## 2026-05-19 — Guest Brief, DOCX Export, and ZIP Restore

### Summary
Expanded the completed-session brief workspace from admin-only document management into an edit-permission-based collaboration flow. Guests with session edit access can now manage uploaded brief sources, synthesize the project overview, save/regenerate cards, export real Word documents, and restore the current session from an exported ZIP archive.

### Decisions
- **Edit permission is the capability seam:** Attachment list/upload/rename/note/delete and session ZIP import now use the existing admin-or-session-password permission path instead of hardcoded admin checks.
- **Guest regeneration is allowed after onboarding:** Guests with edit access can regenerate cards from the brief behind the same destructive confirmation used for admins.
- **All uploads feed synthesis:** `generateBriefFromUploads()` now includes every usable attachment in the prompt context, with per-document excerpt limits, instead of silently slicing to the first eight uploads.
- **Real Word exports live server-side:** Overview and full-canvas Word exports use the `docx` package. Markdown export remains available as an API route, but the visible canvas document action now downloads `.docx`.
- **ZIP import starts with replace-current-session:** `Upload Session` restores an exported ZIP into the current session by replacing metadata, cards, connections, and attachment metadata. New-session and merge import modes remain future work.
- **Attachment binary restore is storage-dependent:** ZIP import restores attachment metadata, extracted text, summaries, and notes. Original binaries are only recoverable when present in the exported ZIP.

### Files changed
| File | What changed |
|------|-------------|
| `server.ts` | Added `x-session-password` edit auth support, guest-capable attachment routes, DOCX export endpoints, and `POST /api/sessions/:id/import/zip` replace-current-session import. |
| `src/App.tsx` | Added edit-mode attachment loading/mutations, guest brief regeneration, ZIP upload/import handler, and session state refresh after import. |
| `src/components/NewProject.tsx` | Added guest-visible upload management, upload rename UI, Upload Session ZIP input, real overview DOCX download, and fixed regenerate click handling. |
| `src/components/RightPanel.tsx` | Rewired canvas overview Doc export to overview DOCX, removed visible PDF action, and replaced chevrons with plus/minus controls. |
| `src/components/Canvas.tsx` | Replaced icon-only export buttons with labeled Save Doc and Save Canvas controls; Save Doc now downloads full-session DOCX and Save Canvas downloads ZIP. |
| `src/services/ai.ts` | Removed the eight-upload synthesis cap and made the brief-generation prompt explicitly synthesize all usable uploaded documents. |
| `package.json`, `package-lock.json` | Added direct dependencies on `docx` and `jszip`. |
| `TODO.md`, `README.md`, `STAGING_HANDOFF_CHECKLIST.md` | Documented guest document workflows, DOCX export, ZIP restore, and remaining import limitations. |

### Open follow-ups
- Add create-new-session-from-ZIP and merge-into-current-session import modes.
- Document and implement attachment binary restore behavior for local, ephemeral, and Firebase storage modes.
- Add automated/import smoke tests for ZIP restore and DOCX export.

---

## 2026-05-19 — Shared Notepad and Exportable Notes

### Summary
Implemented the canvas **Notepad** as a shared session-level note block. It is available from the right panel for admins and guests, uses the same edit-permission rules as cards and brief edits, syncs through PartyKit, and exports with the session as **Notes**.

### Decisions
- **Notepad is separate from `project_notes`:** onboarding/brief notes remain part of the project overview flow, while canvas notepad content is stored as session notes.
- **Store seam first:** notes now use a `NoteStore` interface, with local filesystem and Firestore implementations, so future storage providers can be added without touching UI logic.
- **One UI block, array-backed data:** the shipped UI exposes one shared **Notes** block, but the data model supports multiple note records later.
- **Exports treat notes as first-class content:** DOCX adds a top-level **Notes** section; ZIP includes `notes.json` and `Notes.md`; Markdown and JSON include notes as well.
- **ZIP imports stay backward compatible:** archives without `notes.json` still import cleanly.

### Files changed
| File | What changed |
|------|-------------|
| `src/components/RightPanel.tsx` | Replaced the notepad placeholder with a debounced autosaving notes editor and read-only state. |
| `src/App.tsx` | Loads notes with sessions, saves note edits through REST, and applies realtime note updates. |
| `src/hooks/usePartyKit.ts`, `party/index.ts` | Added `note:update` realtime messages. |
| `server.ts` | Added note API routes, ZIP import/export support, Markdown/JSON inclusion, and DOCX notes output. |
| `src/server/notes.ts` | Added local `notes.json` read/write/upsert helpers. |
| `src/server/backend/*` | Added the `NoteStore` seam and wired it into the current backend. |
| `src/server/data/firestore/notes.ts` | Added Firestore note storage. |
| `README.md`, `TODO.md`, `STAGING_HANDOFF_CHECKLIST.md` | Documented shared notes, exports, restore behavior, and testing follow-ups. |

### Open follow-ups
- Run manual admin/guest browser smoke testing for realtime note sync.
- Decide whether existing card-specific local notes should become persisted/exported records or stay local-only.
- Add automated coverage for notes in DOCX, ZIP restore, and concurrent editing once the collaboration test harness exists.

---

## Session Summary (2025-04-25)

This session delivered **Slice B** (Role-aware beta UX), **Slice E** (Canvas behavior refinement), and major connection system + inline edit polish. All changes were validated with `npm run lint` and `npm run build` before being considered complete.

### Completed
| Area | What |
|------|------|
| **Auth** | Centralized auth in `AuthContext.tsx`; refactored `App.tsx` and `LoginPage.tsx` |
| **Sidebar** | Hidden for non-admins; compact mode with `localStorage` persistence |
| **TopBar** | Help/tutorial dropdown with Play icon; swappable video-provider seam |
| **AI Prompts** | 80-character generation target with 90-character saved-card validation |
| **Character Counter** | Live "X / 90" in lower-left of cards; orange "Past limit" when > 90 |
| **Story Aggregation** | Deterministic paragraph assembly; forward DFS for non-linear wiring |
| **Connection Lines** | Continuous rAF + ResizeObserver for accurate positioning |
| **Connection Hit Detection** | DOM-tree traversal; works on child elements |
| **Card-to-Card Connections** | Shift+drag from any card body |
| **Inline Edit Mode** | Transparent textarea matching reading mode; auto-resize; no chunky buttons |
| **Edit Interactions** | Enter = save, Escape = cancel, click outside = cancel |
| **Story Spacing** | `whitespace-pre-wrap` preserves `\n\n` paragraph breaks |
| **New Project Scroll** | `overflow-auto` fixes clipped onboarding screen |

### Remaining for Phase 2
- Slice C: Chat apply confirmation / strict edit actions
- Slice D: Document-powered workflows (handwritten note synthesis)
- 5.2: Note synthesis into a new card (RightPanel track)

## Earlier (pre-IMPLEMENTATION.md)

These were completed before this log was created. See `bbp-phase2.md` "Progress Update" section for the high-level list.

- AI provider abstraction (`src/server/ai.ts` seam)
- Shared chat extraction (`ChatPanel`, `ChatThread`, `ChatComposer`, `ChatActionConfirmation`)
- Document ingestion architecture (`src/server/documents.ts`, `scripts/extract_attachment.py`)
- Onboarding chat actions (replace/append project background)

---

## How to use this file

1. When you finish a slice or a significant task, append a new dated section here.
2. List decisions, files changed, and any follow-ups.
3. Mark the corresponding items in `bbp-phase2.md` as done.

This keeps the roadmap (`bbp-phase2.md`) clean as a requirements doc, while this file becomes the handoff journal for the next engineer.
