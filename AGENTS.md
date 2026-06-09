# Repository Guidance

- This application is intended to be handed off to a customer.
- Build for takeover: favor clear boundaries, simple configuration, and documentation over tightly coupled shortcuts.
- Even when a final integration is not implemented yet, leave the necessary seams so the next owner can plug in their own provider with minimal rewiring.
- Prioritize seam-based architecture around AI providers, authentication, document ingestion/storage, and media/video services.
- Avoid hardcoded vendor assumptions in product logic. Prefer interfaces, adapters, env-based configuration, and isolated integration modules.
- Choose changes that keep the app easy to understand, maintain, and extend by a different engineer or team after handoff.

## Active Migration Direction

- The active migration target is Vercel + Convex, not Firebase / Google Cloud.
- `firebase-backend-migration` is the source of truth for the customer-facing UI.
- `main` is old design history. Do not use `main` as the recovery base and do not resolve UI conflicts toward `main`.
- `codex/convex-vercel-migration` is a salvage source for Convex/Vercel/provider work only.
- Use [docs/CONVEX_VERCEL_MIGRATION_PLAN.md](docs/CONVEX_VERCEL_MIGRATION_PLAN.md) as the source of truth for migration work.
- Use [docs/firebaseUI_RECOVERY_PLAN.md](docs/firebaseUI_RECOVERY_PLAN.md) as the source of truth for this recovery pass.
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

## Recovery Guardrails

- Build from `firebase-backend-migration` and preserve its UI shell, workspace layout, dashboard, top bar, new-project flow, right panel, and infinite canvas behavior.
- Salvage Convex-specific backend/provider/config/docs work from `codex/convex-vercel-migration` in small commits.
- Do not replay early `Port ...` commits wholesale. They duplicate Firebase UI work and caused branch drift.
- For UI conflicts, prefer the Firebase branch unless the Convex side is strictly required for provider compatibility.
- For backend/provider/config/script conflicts, preserve Firebase behavior and add Convex behind existing seams.
- Keep public `/api/*` request and response behavior compatible unless a human explicitly approves a change.
- Keep SQLite and local attachment storage as fallbacks until Convex paths are verified.
- Do not let docs, checklists, or process files send future work back to `main`.

## Required Checks

- Inspect `git status --short --branch` before staging or switching branches.
- Before resolving a UI conflict, compare against `firebase-backend-migration`.
- After conflict resolution, run `git diff --check`.
- Run `npm run lint` and `npm run build` before treating the recovery branch as usable.
- Smoke-test the customer-facing UI shell and the infinite canvas before pushing or handing off.
- Review the final diff for accidental `main` UI regressions, runtime artifacts, secrets, and deleted fallbacks.

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
