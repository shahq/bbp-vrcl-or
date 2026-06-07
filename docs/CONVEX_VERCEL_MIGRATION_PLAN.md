# Convex + Vercel Migration Plan

## Status

Active migration plan.

This plan replaces the Firebase / Cloud Run plan as the active direction. The Firebase plan remains in the repo as historical context until a human approves deletion or archival.

## Goal

Move Beyond Bullet Points to a handoff-friendly hosted architecture while preserving product behavior.

The migration is not a UX redesign. It replaces persistence, storage, and deployment infrastructure in small reversible slices.

## Target Architecture

- Vercel hosts the Vite frontend, preview deployments, environment management, and a temporary compatibility API.
- Convex owns sessions, cards, connections, notes, admin/session metadata, server functions, and file storage.
- Convex File Storage stores uploaded source documents.
- PartyKit stays in place for high-frequency presence, cursors, canvas sync, and timer broadcast.
- Railway is optional and only for document extraction if the Python extraction path cannot move cleanly.
- Cloudflare Workers are not the primary backend target for this repo right now.

## Migration Principle

Preserve product behavior while replacing infrastructure behind seams.

Every implementation slice must be incremental, reversible, testable, and documented. Prefer adding a parallel provider over replacing an existing one.

## Existing Work To Preserve

The Firebase migration branch introduced useful architecture that should survive the platform change:

- `AdminAuthProvider`
- `SessionStore`
- `CardStore`
- `ConnectionStore`
- `AttachmentStore`
- `NoteStore`
- `src/server/backend/types.ts`
- `src/server/backend/current.ts`
- `src/server/backend/data-store.ts`
- `src/server/backend/attachments.ts`
- provider selection through env configuration

Current provider facts:

- `DATA_STORE_PROVIDER` currently supports `sqlite` and `firestore`.
- `ATTACHMENT_STORE_PROVIDER` currently supports `local`, `ephemeral`, and Firebase / Cloud Storage aliases.
- `ADMIN_AUTH_PROVIDER` currently supports `password`; Firebase auth is a placeholder.

## Work To Leave Behind

Do not carry these forward as the active architecture:

- Firebase skill/vendor guidance files.
- Cloud Run docs/config as the primary direction.
- Committed runtime artifacts under `data/sessions/**`.
- Firestore-specific docs as the active plan.
- Firebase-specific implementation that is not part of the provider seam.

Do not delete these files without human approval. Deletion is an explicit approval gate.

## Provider Strategy

### Data Store

Add `DATA_STORE_PROVIDER=convex` as a new parallel provider.

Convex-backed stores should implement the existing interfaces:

- `SessionStore`
- `CardStore`
- `ConnectionStore`
- `NoteStore`

Keep SQLite working for local fallback until Convex is proven in staging-like usage.

### Attachments

Add Convex-backed attachment storage as a new provider behind `AttachmentStore`.

Use Convex Storage upload URLs for large files. Do not route large uploads through Vercel Functions.

Store attachment metadata and extraction state in Convex data. Store uploaded source document bytes in Convex Storage.

### Auth

Do not change authentication or session semantics in the first migration slices.

The shared password admin flow can remain while persistence and storage move. Any auth replacement needs a separate approved slice.

### AI And Extraction

Keep privileged AI calls and document extraction server-side.

Document extraction is a separate decision:

- Preferred path: replace the Python extraction script with a Node-compatible extraction adapter.
- Fast proof path: add a Railway extraction worker that reads from Convex Storage and writes extracted text/summaries back through Convex.

Adding Railway requires human approval.

### Realtime

Keep PartyKit unchanged until Convex-backed persistence is proven.

Do not move presence, cursors, timer broadcast, or high-frequency canvas sync into Convex in the initial migration.

## Phases

### Phase 0 - Migration Operating System

Create the plan, loop docs, approval gates, and checklist.

Outcome:

- Future work is sliced and reviewable.
- Agents know where to stop.
- The Firebase plan is no longer the active target.

### Phase 1 - Branch And Diff Hygiene

Create a clean migration branch from `main` and decide which branch changes to port.

Expected work:

- Inventory useful commits/files on `firebase-backend-migration`.
- Identify runtime artifacts and Firebase-only files to leave behind.
- Port provider seams and product changes in reviewable commits.

Approval gates:

- Deleting Firebase / Cloud Run files.
- Dropping runtime data files.
- Rewriting branch history.

### Phase 2 - Convex Schema And Local Setup

Add Convex project structure and schema with no production behavior change.

Expected work:

- Define Convex tables for sessions, cards, connections, notes, attachments, and admin/session metadata.
- Add local setup docs.
- Keep app runtime on SQLite.

Approval gates:

- Adding Convex package dependency.
- Creating paid infrastructure assumptions.

### Phase 3 - Convex Data Provider

Implement `DATA_STORE_PROVIDER=convex` behind the existing stores.

Expected work:

- Add Convex adapters for sessions, cards, connections, and notes.
- Keep the existing REST/API surface stable.
- Verify basic create/read/update/delete flows.

Approval gates:

- Changing public API responses.
- Removing SQLite fallback.
- Moving frontend screens directly to Convex queries/mutations.

### Phase 4 - Convex Attachment Storage

Implement Convex-backed attachment metadata and file storage.

Expected work:

- Add Convex attachment provider.
- Use upload URLs for large uploads.
- Preserve current upload, summarize, import, and export behavior as much as possible.

Approval gates:

- Changing exported data format.
- Removing local attachment storage.
- Changing document extraction behavior.

### Phase 5 - Vercel Hosting And Compatibility API

Deploy frontend and thin compatibility API to Vercel.

Expected work:

- Add Vercel configuration only after platform dependencies are approved.
- Keep `/api/*` compatibility while the frontend still depends on it.
- Keep server-only secrets out of browser builds.

Approval gates:

- Adding production deployment assumptions.
- Touching production env vars or secrets.
- Changing public API surface.

### Phase 6 - Extraction Decision

Choose the durable document extraction path after Convex storage is proven.

Expected work:

- Evaluate Node-compatible extraction.
- If needed, design Railway worker integration.

Approval gates:

- Adding Railway.
- Adding new paid infrastructure.
- Changing extraction output format.

### Phase 7 - Cutover And Cleanup

Remove old providers only after Convex/Vercel has been tested and accepted.

Expected work:

- Remove Firestore as active direction.
- Archive or delete Firebase / Cloud Run docs and configs if approved.
- Keep migration docs aligned with final handoff.

Approval gates:

- Removing SQLite fallback.
- Removing local storage paths.
- Deleting Firebase / Cloud Run files.

## First Recommended Implementation Slice

After this documentation/setup pass, the first implementation slice should be:

Inventory and isolate the useful branch work.

Scope:

- Compare `main...firebase-backend-migration`.
- List provider-seam files to port.
- List product behavior files to port.
- List Firebase / Cloud Run files to leave behind.
- Produce a proposed commit plan.

Do not add Convex yet in that slice unless a human explicitly approves adding the dependency.

## Verification Expectations

Each slice should run the narrowest relevant checks:

- `npm run lint` for TypeScript/build-contract changes.
- focused local smoke checks for changed routes or UI behavior.
- deployment dry runs only when the slice is explicitly about deployment.

Each slice must end with a diff review and checklist update.

## Handoff Expectations

Every migration handoff summary must include:

- What changed.
- Files changed.
- Tests/checks run.
- Risks.
- Next recommended slice.
- Anything requiring human review.
