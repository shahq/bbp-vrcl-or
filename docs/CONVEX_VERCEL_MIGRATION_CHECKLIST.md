# Convex + Vercel Migration Checklist

Use this checklist as the running recovery ledger.

## Phase 0 - Recovery Base And Guardrails

- [x] Base recovery branch on `firebase-backend-migration`.
- [x] Document that `main` is old design history.
- [x] Document that `codex/convex-vercel-migration` is salvage-only.
- [x] Record Firebase UI preservation rules.
- [x] Remove loop/process docs that distract from recovery.
- [x] Add `docs/firebaseUI_RECOVERY_PLAN.md`.

## Phase 1 - Branch And Diff Hygiene

- [x] Compare `firebase-backend-migration..codex/convex-vercel-migration`.
- [x] Identify shell/workspace UI files that drifted.
- [x] Verify infinite canvas mostly survived the bad port.
- [ ] Identify provider-seam files to preserve.
- [ ] Identify Convex/Vercel commits to salvage.
- [ ] Identify Firebase / Cloud Run files to leave behind.
- [ ] Identify committed runtime artifacts to exclude.
- [ ] Apply clean branch and commit strategy.
- [ ] Get human approval before deleting or dropping tracked files.

## Phase 2 - Convex Schema And Local Setup

- [ ] Get approval to add Convex production dependency.
- [ ] Add Convex package and project structure.
- [ ] Define schema for sessions.
- [ ] Define schema for cards.
- [ ] Define schema for connections.
- [ ] Define schema for notes.
- [ ] Define schema for attachment metadata.
- [ ] Define schema for admin/session metadata.
- [ ] Document local Convex setup.
- [ ] Verify existing SQLite local mode still works.

## Phase 3 - Convex Data Provider

- [ ] Add `DATA_STORE_PROVIDER=convex` routing.
- [ ] Implement Convex `SessionStore`.
- [ ] Implement Convex `CardStore`.
- [ ] Implement Convex `ConnectionStore`.
- [ ] Implement Convex `NoteStore`.
- [ ] Verify session create/list/update/delete flows.
- [ ] Verify card create/update/reorder/delete flows.
- [ ] Verify connection save/delete flows.
- [ ] Verify shared notes list/upsert/delete flows.
- [ ] Keep SQLite fallback enabled.

## Phase 4 - Convex Attachment Storage

- [ ] Add Convex-backed attachment provider.
- [ ] Use Convex Storage upload URLs for large uploads.
- [ ] Store attachment metadata in Convex.
- [ ] Preserve upload UX.
- [ ] Preserve brief generation from uploaded content.
- [ ] Preserve ZIP/Markdown/JSON/DOCX export behavior.
- [ ] Document original-binary durability behavior.
- [ ] Keep local attachment fallback enabled.

## Phase 5 - Vercel Hosting And Compatibility API

- [ ] Get approval for Vercel deployment assumptions.
- [ ] Add minimal Vercel configuration.
- [ ] Keep Vercel API thin and compatibility-focused.
- [ ] Keep server-only secrets out of browser builds.
- [ ] Verify frontend build on Vercel-equivalent settings.
- [ ] Verify `/api/*` compatibility routes if still needed.
- [ ] Document staging and owner-production setup.

## Phase 6 - Extraction Decision

- [ ] Inventory current Python extraction requirements.
- [ ] Evaluate Node-compatible extraction adapter.
- [ ] If Node path is viable, plan adapter slice.
- [ ] If Railway is needed, request human approval.
- [ ] Document extraction worker data flow.
- [ ] Verify extracted text/summaries write back to Convex.

## Phase 7 - Cutover And Cleanup

- [ ] Verify Convex data provider in staging-like usage.
- [ ] Verify Convex attachment provider in staging-like usage.
- [ ] Verify Vercel frontend and compatibility API.
- [ ] Confirm owner handoff path.
- [ ] Request approval before removing SQLite fallback.
- [ ] Request approval before removing local storage paths.
- [ ] Request approval before deleting Firebase / Cloud Run files.
- [ ] Archive or replace Firebase docs after approval.
- [ ] Update README and deployment docs to final active architecture.

## Current Next Recommended Slice

Replay the Convex-specific provider/backend commits onto the Firebase UI recovery branch.

Expected output:

- Convex provider seam files preserved.
- Firebase UI shell preserved.
- Infinite canvas behavior preserved.
- SQLite and local attachment fallback preserved.
- Checks run and failures documented.
