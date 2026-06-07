# Repository Guidance

- This application is intended to be handed off to a customer.
- Build for takeover: favor clear boundaries, simple configuration, and documentation over tightly coupled shortcuts.
- Even when a final integration is not implemented yet, leave the necessary seams so the next owner can plug in their own provider with minimal rewiring.
- Prioritize seam-based architecture around AI providers, authentication, document ingestion/storage, and media/video services.
- Avoid hardcoded vendor assumptions in product logic. Prefer interfaces, adapters, env-based configuration, and isolated integration modules.
- Choose changes that keep the app easy to understand, maintain, and extend by a different engineer or team after handoff.

## Active Migration Direction

- The active migration target is Vercel + Convex, not Firebase / Google Cloud.
- Use [docs/CONVEX_VERCEL_MIGRATION_PLAN.md](docs/CONVEX_VERCEL_MIGRATION_PLAN.md) as the source of truth for migration work.
- Treat [FIREBASE_BACKEND_MIGRATION_PLAN.md](FIREBASE_BACKEND_MIGRATION_PLAN.md) as historical context only unless a human explicitly reactivates it.
- Preserve the useful provider-seam work already introduced on the migration branch:
  - `AdminAuthProvider`
  - `SessionStore`
  - `CardStore`
  - `ConnectionStore`
  - `AttachmentStore`
  - `NoteStore`
  - `src/server/backend/types.ts`
  - `src/server/backend/data-store.ts`
  - `src/server/backend/attachments.ts`
- Add `DATA_STORE_PROVIDER=convex` as a parallel provider when implementing Convex. Do not replace SQLite until Convex is verified.
- Add Convex-backed attachment storage as a parallel provider. Do not remove `local` attachment storage until the new path is proven.
- Keep PartyKit in place for high-frequency presence, cursors, canvas sync, and timer broadcast.
- Keep Vercel API usage thin and compatibility-focused while the app still expects `/api/*`.
- Keep privileged AI and document extraction behind server-side or server-action paths.

## Migration Loop Requirement

Future migration slices must follow the loop docs in [docs/agent-loops](docs/agent-loops):

1. Read this file and the active migration plan.
2. Restate the slice goal.
3. Inspect relevant files before editing.
4. Propose the smallest safe implementation plan.
5. Implement only that slice.
6. Run relevant checks.
7. Review the diff.
8. Update [docs/CONVEX_VERCEL_MIGRATION_CHECKLIST.md](docs/CONVEX_VERCEL_MIGRATION_CHECKLIST.md).
9. Produce a handoff summary with changed files, checks, risks, next slice, and human-review needs.

## Approval Gates

Stop and ask for human approval before:

- Adding new production dependencies.
- Removing SQLite fallback.
- Removing old local storage paths.
- Deleting Firebase / Cloud Run files from the repo.
- Changing authentication or session semantics.
- Changing exported data format.
- Changing the public API surface.
- Changing PartyKit behavior.
- Adding Railway.
- Adding any new paid infrastructure assumption.
- Touching billing, auth secrets, production env vars, or deployment secrets.
- Making large architectural rewrites.
