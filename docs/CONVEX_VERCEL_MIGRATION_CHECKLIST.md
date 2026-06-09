# Convex + Vercel Recovery Checklist

Use this as the running recovery ledger. `firebase-backend-migration` is the UI source of truth. `main` is old design history.

## Recovery Base And Guardrails

- [x] Base recovery branch on `firebase-backend-migration`.
- [x] Document that `main` is not a recovery base.
- [x] Document that `codex/convex-vercel-migration` is salvage-only.
- [x] Add `docs/firebaseUI_RECOVERY_PLAN.md`.
- [x] Remove `docs/agent-loops/`.
- [x] Update `AGENTS.md` with recovery checks and reminders.

## UI Preservation

- [x] Compare `firebase-backend-migration..codex/convex-vercel-migration`.
- [x] Confirm the bad branch mostly preserved `src/components/Canvas.tsx`.
- [x] Preserve Firebase `TopBar`, `NewProject`, `RightPanel`, `Canvas`, and workspace shell behavior.
- [x] Keep only model-default/model-option UI changes from the Convex branch.

## Convex And Vercel Salvage

- [x] Recover backend provider seams.
- [x] Recover Convex schema and generated types.
- [x] Recover Convex sessions/cards/connections/notes provider.
- [x] Recover Convex attachment provider.
- [x] Recover provider, attachment, export, and AI smoke scripts.
- [x] Recover Vercel compatibility API wrapper and config.
- [x] Recover stateless Vercel admin auth.
- [x] Recover expanded AI provider seam and DeepSeek default.
- [x] Preserve SQLite and local attachment fallback.

## Checks

- [x] `git diff --check`
- [x] `npm run lint`
- [x] `npm run build`
- [ ] Local smoke test customer-facing UI shell.
- [ ] Local smoke test infinite canvas pan/zoom/cards/thread connections.
- [ ] Provider smoke scripts where env allows.

## Remaining Review Needs

- [ ] Human review of direct-upload decision: recovery currently preserves legacy upload UI and lets the Convex attachment provider upload server-side.
- [ ] Human review of Vercel preview env values before deployment.
- [ ] Human review before removing SQLite, local attachment storage, Firebase files, or Cloud Run files.
