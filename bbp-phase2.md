# Beyond Bullet Points Phase 2

## Goal
Get the app from its current MVP state to a handoff-ready beta.

## Progress Update

Completed so far:

- Added repository handoff guidance in [AGENTS.md](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/AGENTS.md)
- Added a Phase 2 roadmap in this file
- Reworked AI integration behind a server-owned provider layer
- Added provider support for Google, Opencode, and OpenRouter
- Made server AI config env-driven and safer for handoff
- Extracted chat into reusable components and a shared hook
- Made chat context-aware for New Project and Canvas usage
- Added onboarding chat actions that can write clean drafts into the Project Background field
- Improved onboarding chat so draft actions appear only when a real project background draft exists
- Added replace/append project background actions and chat-command style application
- Added upload-powered project brief generation for the Project Overview flow
- Added admin return-to-brief, save-only, and confirmed regenerate-cards flows
- Tightened the canvas right panel with a collapsible project overview, compact tabs/composer, and selected-card chat context pills
- Fixed canvas selection clearing and empty-card AI generation refresh behavior

In progress now:

- Remaining document ingestion follow-ups, especially OCR/image-based notes and handwritten-note synthesis

Recently completed:

- [x] Slice B: Role-aware beta UX (see [`IMPLEMENTATION.md`](./IMPLEMENTATION.md))
- [x] Slice E: 90-character card guidance + AI prompt updates + story aggregation + inline edit polish
- [x] Connection system: line positioning, hit detection, card-to-card Shift+drag connections
- [x] Inline edit mode: transparent textarea, auto-resize, click-outside-to-cancel, no chunky buttons
- [x] Project Overview flow: upload-generated brief, save-only edits, and confirmed card regeneration
- [x] Canvas sidebar polish: project overview accordion, selected-card composer pill, and click-empty-space deselection

This phase should optimize for two things at the same time:

1. Better product usability for admins and collaborators.
2. Better takeover readiness for the eventual customer owner.

## Working Principle
This app should be built as a product that can be handed off. That means some integrations may stay provisional during development, but the codebase should already expose the right seams for plug-and-play replacement later.

In practice, Phase 2 should avoid locking core features directly to one provider or one owner account. The main seam areas are:

- AI provider selection and credentials
- Authentication provider integration
- Document ingestion and extraction
- Video/tutorial hosting
- Shared chat and action orchestration

## Recommended Order Of Relevance And Leverage

### 1. Create the core handoff seams first
This is the highest-leverage work because it affects almost every feature below and reduces rewrite risk before beta.

#### 1.1 AI provider seam
Current state:

- Client AI logic lives in [src/services/ai.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/services/ai.ts).
- The server also exposes an Opencode proxy in [server.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/server.ts).
- The current setup is still biased toward the developer's Opencode account.

Recommendation:

- Introduce an `AIProvider` abstraction with adapters for:
  - `opencode`
  - `google`
- Move provider selection and credential usage behind server-owned configuration.
- Keep the UI and feature code provider-agnostic.
- Remove hardcoded provider assumptions from prompts and request plumbing.

Recommended timing:

- Do this now, not right before handoff.

Why:

- Chat, document ingestion, overview generation, handwritten-note synthesis, and card-edit workflows will all depend on AI.
- If the seam is delayed until the end, all of those features risk being built against the wrong shape.
- The final owner can still switch providers later, but the switch should become configuration work, not refactor work.

Suggested target shape:

- `src/server/ai/providers/*`
- `src/server/ai/index.ts`
- `src/services/ai.ts` becomes a thin client for app features, not a vendor binding point
- env variables such as:
  - `AI_PROVIDER=opencode|google`
  - `GOOGLE_API_KEY=...`
  - `OPENCODE_API_KEY=...`
  - optional per-feature model config

#### 1.2 Authentication seam
Recommendation:

- Create authentication boundaries now, even if full Firebase auth is not implemented yet.
- Define an auth adapter or service boundary so the app can continue using current admin/session auth while being ready for Firebase later.

Status:

- [x] Frontend auth context/provider created (`src/contexts/AuthContext.tsx`)
- [ ] Server auth adapter boundary (`src/server/auth/*`) — future work

Target seam areas:

- Admin auth
- Session participant access
- Role resolution
- Future owner-managed identity

Suggested target shape:

- `src/server/auth/*`
- an auth context or provider boundary on the frontend
- role checks centralized instead of scattered in page components

Why this is early:

- Role-aware UI is already part of the product.
- The sidebar visibility rules and future ownership model will be cleaner if auth is formalized before more UI behavior is added.

#### 1.3 Shared chat panel seam
Current state:

- The current chat UI is embedded in [src/components/RightPanel.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/RightPanel.tsx).

Recommendation:

- Extract chat into a composable, reusable system that can be mounted in:
  - New Project / overview flow
  - Canvas view
  - future pages
  - future apps

Suggested decomposition:

- `ChatPanel`
- `ChatThread`
- `ChatComposer`
- `ChatActionConfirmation`
- `useChatContext`

Why this is early:

- Context-aware chat is a major Phase 2 capability.
- Reuse and consistency will matter more as chat becomes able to propose and apply edits.

#### 1.4 Document ingestion seam
Recommendation:

- Build a first-class document ingestion pipeline before wiring uploads into multiple screens.

Supported file targets:

- `.pdf`
- `.doc` / `.docx`
- `.xls` / `.xlsx`
- `.txt`
- `.md`
- images

Pipeline responsibilities:

- file upload
- storage location
- file metadata
- text extraction
- image OCR / vision summarization
- normalized extracted context
- per-project attachment indexing

Suggested target shape:

- `src/server/uploads/*`
- `src/server/documents/*`
- `data/sessions/<sessionId>/attachments/*`
- extracted summaries or normalized text stored alongside project/session data

Why this is early:

- Project overview context and future AI features both depend on consistent source material.

### 2. Tighten role-based UX and layout behavior
This is the next highest-impact user-facing improvement and is relatively straightforward once auth seams are clearer.

#### 2.1 Left sidebar admin-only in all contexts
Requirement:

- The left sidebar should remain visible only for admins.
- Hide it for visitors and collaborators across all contexts.

Status: [x] Done — `Sidebar` returns `null` when `!isAdmin`, removing it from the DOM entirely so layout does not reserve dead space.

Current hotspot:

- [src/components/Sidebar.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/Sidebar.tsx)

Notes:

- This should be enforced both in rendering and in layout behavior, so non-admin pages do not leave unused space where the sidebar would have been.

#### 2.2 Add compact sidebar mode
Requirement:

- Add a compact/collapsed mode for the admin sidebar.

Status: [x] Done — Toggle in sidebar header (`PanelLeftClose` / `PanelLeft`). Collapsed mode is `w-16` with logo + logout only. State persisted in `localStorage` (`bbp_sidebar_compact`).

Notes:

- Compact mode should preserve session switching and key controls.
- The state should likely persist per admin user in local storage at first.

### 3. Make chat context-aware and safely actionable
This is probably the most important beta differentiator after the seams above.

Requirement:

- Chat should know where the user is in the product and what entity is currently in focus.

Status: [x] Partially complete — chat now receives New Project and Canvas context, onboarding chat can draft and apply project background text, and Canvas chat shows selected-card context in the composer. Remaining work is deeper selected-card editing/refinement and broader strict apply confirmation for stored mutations.

Contexts to support:

- Project overview context
- Canvas context
- Selected card context
- Session/project metadata context

Target capabilities:

- Review an existing project overview
- Suggest edits to an overview
- Propose changes to card content
- Expand or refine a selected card
- Create a new card in the same section context

Safety requirement:

- For edits that change stored content, use strict apply confirmation, such as explicit `Apply: yes/no`.

Recommended design:

- Treat chat as a planner plus editor assistant, not as a silent auto-mutator.
- Separate:
  - suggestions
  - draft patch output
  - final apply action

Why this comes before many smaller UI changes:

- It directly affects product value.
- It also determines what metadata the UI needs to expose to the chat system.

### 4. Expand the Project Overview page into a real context-ingestion surface
Current hotspot:

- [src/components/NewProject.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/NewProject.tsx)

Requirement:

- Add document upload for `.pdf`, Word docs, spreadsheet files, `.txt`, `.md`, and optionally images when relevant.
- Capture the information from uploaded assets as usable context for the project's overview.

Recommended scope:

- [x] show uploaded files
- [x] show extraction status
- [x] allow adding a note per upload
- [x] allow the user to pull extracted content into the overview intentionally
- [x] allow summary-only import when full text is unavailable or too noisy
- [x] pass source summaries and per-upload notes into chat context
- [x] generate a synthesized project overview brief from uploads
- [x] persist generated and manually saved project overview text into session metadata

Why this is after the ingestion seam:

- The UI should sit on top of a stable ingestion pipeline rather than inventing one-off upload logic inside the page component.

### 5. Update canvas behavior around cards and story generation
This is strong product polish and improves the core workshop workflow.

#### 5.1 AI card generation length guidance
Requirement:

- AI-generated card content should target a maximum of 90 characters.
- The card editor itself should not hard-stop the user at 90 characters.
- Instead, show a clear indicator when the user is over 90 characters.

Status: [x] Done — Live counter added to `Canvas.tsx` editing textarea. Shows "X / 90" in gray, turns orange with "Past limit" past the limit. Typing is never blocked. Empty cards enter edit mode on focus so the counter is always visible. AI prompts updated to request max 90 characters.

Expanded details:

- Add a Twitter-like character counter beneath every card textarea (both inline canvas editing and empty-card creation).
- The counter shows current character count (e.g., "X / 90").
- When the user passes 90 characters, display a soft notice: "Past limit".
- Typing remains allowed; the counter stays visible as a persistent reminder.
- Apply the same counter to any future card editing surfaces (e.g., RightPanel notes-to-card flow).

Notes:

- This should be a guidance system, not a hard validation rule.
- Prompts for generated card suggestions should also align with the 90-character target.
- Consider extracting a reusable `CardEditor` component so counter logic is not duplicated inside `Canvas.tsx`.

#### 5.2 Note synthesis into a new card
Requirement:

- Allow freeform notes to be synthesized with AI into a new card.

Status: [x] Done — RightPanel card notes persist per selected card in local storage. The Act I generation seam now targets 90-character cards.

Two tracks:

1. **RightPanel notes textarea (immediate)**
   - Wire the existing "Add Notes" textarea in the RightPanel to per-card persisted state.
   - Add a **"Synthesize into new card"** button next to the textarea.
   - When clicked, call an AI endpoint that summarizes the note text into a concise, 90-character-target card sentence.
   - Create the resulting card in the same section (or an adjacent section) via the existing `onCardAdd` flow.
   - Use the chat/action confirmation pattern (explicit Apply/Create) before finalizing.

2. **Handwritten note upload (future)**
   - user uploads or captures handwritten notes
   - system extracts text or summarizes handwriting (depends on document ingestion seam)
   - AI proposes a concise card
   - user confirms creation

Dependencies:

- For track 1: existing AI completion endpoint + card creation API.
- For track 2: document/image ingestion, OCR or image understanding, chat/action confirmation model.

Suggested behavior:

- Start with track 1 (RightPanel notes) because it requires no new infrastructure.
- Track 2 can follow once the document ingestion seam (Slice D) is in place.

#### 5.3 Replace story-node interpretation with aggregation
Current state:

- Story generation currently uses an interpretive prompt in [src/services/ai.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/services/ai.ts).

Status: [x] Done — `handleAssembleStory` in `Canvas.tsx` walks the connection chain and joins each card's content with `\n\n` paragraphs. No AI call. Button renamed to "Assemble Story".

Requirement:

- The generated story node should no longer reinterpret connected nodes as a creative story.
- Instead, it should concatenate and normalize the connected notes into a full text output.
- Each source note should become its own paragraph in the final story card.

Recommendation:

- Treat this as deterministic assembly first and optional AI cleanup second.
- Default behavior should be aggregation, not creative transformation.

Why:

- This better preserves workshop intent and reduces unwanted AI drift.

#### 5.4 Canvas selection and generated-card polish

Status: [x] Done — Canvas clicks outside card UI now clear the selected card, which also hides the chat composer context pill. Empty-card AI generation now updates the card content immediately and exits edit mode when the AI result returns, so the generated text is visible without an extra blur/click.

Current hotspot:

- [src/components/Canvas.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/Canvas.tsx)

### 6. Add supporting beta UX polish
These items are meaningful, but they should follow the larger architecture and workflow changes above.

#### 6.1 Empty state in card sidebar
Requirement:

- When no card is selected, the sidebar should say: `Select a card to edit`.

Status: [x] Done — `RightPanel.tsx` already displays `Select a card to edit`.

Current state:

- The current copy in [src/components/RightPanel.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/RightPanel.tsx) says `Select a card to edit`.

#### 6.2 Video help entry point
Requirement:

- Add a video/help icon to the top bar.
- Opening it should show a modal, dropdown, or list of explainer tutorials.

Status: [x] Done — Help dropdown added to `TopBar.tsx` with abstract `TUTORIALS` array. Provider can be swapped later.

Follow-up:

- [x] Replace the `?` icon with a **Play** or **Video** icon so the entry point is more intuitive.
- [x] Expand the play-video dropdown into a real tutorial launcher.
- [x] When a tutorial video item is clicked, open a floating picture-in-picture video player over the canvas area.
- [x] Anchor the initial picture-in-picture player at the top-left of the canvas viewport with `1rem` inset spacing.
- [x] Keep the video player outside the transformed/pannable canvas content so it floats above the canvas rather than inside it.
- [x] Make the picture-in-picture video frame draggable.
- [x] Add corner snapping so the dragged player can snap to the top-left, top-right, bottom-left, or bottom-right corners of the canvas viewport.

Current hotspot:

- [src/components/TopBar.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/TopBar.tsx)
- [src/App.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/App.tsx)
- [src/components/Canvas.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/Canvas.tsx)

Future seam:

- Leave room for a future Mux or similar video-hosting integration.
- Keep tutorial metadata provider-agnostic so the dropdown and player can use Mux, YouTube, self-hosted files, or another source through the same item shape.

Recommendation:

- Build the UX entry point now.
- Abstract the video source definition so the backing provider can be swapped later.
- Lift the selected tutorial state high enough that `TopBar` can trigger playback while the player renders in the canvas shell layer.
- Treat the player as an overlay tied to the canvas viewport bounds, not as an `InfiniteCanvas` child, so pan and zoom do not move or scale it.
- Use a small local drag/snap implementation for now instead of adding AnimeJS; the current snap target is only four canvas-viewport corners, so a dependency would add more handoff surface than value.

#### 6.3 Connection system reliability
Requirement:

- Connection lines should stay accurate after reload, pan, zoom, and layout changes.
- Creating connections should work reliably even when clicking child elements inside nodes.
- Users should be able to connect cards without hitting tiny node circles.

Status: [x] Done — Three fixes applied:

1. **Line positioning:** `ConnectionLine` now uses a continuous `requestAnimationFrame` loop + `ResizeObserver` to re-measure DOM positions. Lines stay accurate through animations, panning, zooming, and layout shifts.
2. **Hit detection:** `handlePointerUp` now traverses up the DOM tree from the hit element, looking for `node-left-*` IDs or `data-card-id` attributes. Connections succeed regardless of which child element is clicked.
3. **Card-to-card connections:** Hold **Shift** and drag from any card body to another card to create a connection. Existing node-based interaction still works for precision connections.

Current hotspot:

- [src/components/Canvas.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/Canvas.tsx)

#### 6.4 Inline card edit mode polish
Requirement:

- Edit mode should look identical to reading mode, not like a chunky form.
- The textarea should expand to fit its content instead of clipping text.
- Users should be able to cancel by clicking outside the card or pressing Escape.

Status: [x] Done — Four fixes applied:

1. **Clean edit UI:** Removed Save/Cancel buttons. Styled `<textarea>` with `bg-transparent`, matching font, no border, no focus ring. Looks identical to the reading-mode `<div>`.
2. **Auto-resize textarea:** `onInput` handler + `useEffect` auto-resize the textarea to `scrollHeight` on every keystroke. Added `overflow-hidden` to prevent scrollbars. Text never clips.
3. **Click outside to cancel:** Capture-phase `pointerdown` listener on `document` fires before `InfiniteCanvas` can capture the pointer. Clicking anywhere — canvas background, top bar, sidebar, empty space — cancels edit mode (equivalent to Escape).
4. **Story paragraph spacing:** Added `whitespace-pre-wrap` to card content display so `\n\n` line breaks from `handleAssembleStory` render as blank lines between paragraphs.

Current hotspot:

- [src/components/Canvas.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/Canvas.tsx)

#### 6.5 Project brief and right-panel workspace polish

Status: [x] Done — Admins can return from the canvas to the brief, save brief changes without entering or regenerating the canvas, and explicitly confirm when regenerating cards will delete existing cards.

Completed details:

- [x] Add **Return to brief** in the canvas top bar for admins only
- [x] Add **Save changes** to the Project Overview editor
- [x] Add **Save changes and regenerate cards** with destructive confirmation
- [x] Make the Project Overview editor scroll as a full workspace container
- [x] Replace disconnected right-panel hero/challenge labels with `Project overview [project name]`
- [x] Make the right-panel project overview collapsible
- [x] Compact right-panel tabs and chat composer spacing
- [x] Hide the chat context summary block for now
- [x] Show selected-card context as a composer pill only when a card is selected

Current hotspots:

- [src/App.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/App.tsx)
- [src/components/NewProject.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/NewProject.tsx)
- [src/components/RightPanel.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/RightPanel.tsx)
- [src/components/chat/ChatComposer.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/chat/ChatComposer.tsx)

## Suggested Phase 2 Delivery Slices

### Slice A: Handoff foundations

- add `AGENTS.md` handoff/build-seams guidance
- create AI provider abstraction
- move provider keys and model config to env-driven server configuration
- define auth seam for future Firebase
- define upload/document extraction architecture
- extract shared chat components

### Slice B: Role-aware beta UX

- [x] hide left sidebar for non-admin users everywhere
- [x] add compact sidebar mode
- [x] centralize role-aware layout behavior (frontend auth context)
- [x] add card-sidebar empty state
- [x] add top-bar tutorial/video entry point
- [x] replace help `?` icon with Play/Video icon
- [x] expand tutorial dropdown into a floating draggable/snap-to-corner picture-in-picture player over the canvas viewport

### Slice C: Context-aware intelligence

- [x] make chat aware of page/session/card context
- [x] expose selected-card context inside the chat composer
- add strict apply confirmation for edits
- support overview feedback and edits
- support selected-card feedback, refinement, and sibling-card creation

### Slice D: Document-powered workflows

- [x] add overview-page uploads
- [x] capture extracted document context into project overview workflows
- [x] generate a project overview brief from uploads
- [ ] support OCR/image-based notes
- [ ] synthesize handwritten notes into new cards

### Slice E: Canvas behavior refinement

- [x] add 90-character guidance for cards (live counter + soft notice)
- [x] update AI prompts for concise card suggestions
- [x] replace story generation with paragraph aggregation
- [x] note synthesis into a new card (RightPanel track)
- [x] clear selected card when clicking empty canvas space
- [x] update generated empty-card ideas immediately after AI completion

## Recommended Beta Definition

The app is ready for beta when:

- the owner can switch AI providers through configuration instead of code edits
- auth has clear seams for future Firebase integration
- chat is reusable and context-aware
- overview uploads work for core business documents
- non-admin users only see the collaboration UI they actually need
- canvas behavior matches workshop intent more closely than generic AI generation
- the app includes enough documentation and seams that another engineer can take over without structural rewrites

## Immediate Recommendation

If only one thing is started next, start with the AI provider seam and shared chat extraction.

Those two changes have the highest compounding value because they directly affect:

- overview generation
- context-aware chat
- future edit/apply workflows
- handwritten note synthesis
- eventual owner handoff
