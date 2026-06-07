# Backend Migration Loop

Use this loop for slices that touch backend routes, server runtime, API compatibility, auth checks, AI calls, exports, imports, or document extraction.

## Required Steps

1. Read `AGENTS.md`.
2. Read `docs/CONVEX_VERCEL_MIGRATION_PLAN.md`.
3. Restate the backend slice goal in one or two sentences.
4. Inspect the relevant backend files before editing.
5. Identify whether the slice changes route behavior, request/response shape, auth/session behavior, exports, PartyKit behavior, or provider wiring.
6. Propose the smallest implementation plan.
7. Implement only the approved slice.
8. Run relevant checks.
9. Review `git diff`.
10. Update `docs/CONVEX_VERCEL_MIGRATION_CHECKLIST.md`.
11. Produce a handoff summary.

## Files To Inspect First

- `server.ts`
- `src/server/backend/types.ts`
- `src/server/backend/current.ts`
- `src/server/backend/data-store.ts`
- `src/server/backend/attachments.ts`
- `src/server/auth/index.ts`
- `src/server/documents.ts`
- `src/server/ai/index.ts`
- `party/index.ts` if realtime behavior is involved

## Stop For Approval

Stop before:

- Changing the public API surface.
- Changing authentication/session semantics.
- Changing exported data format.
- Changing PartyKit behavior.
- Adding production dependencies.
- Adding Railway or any new paid infrastructure assumption.
- Touching production env vars, secrets, or billing.

## Handoff Summary Template

```text
Backend slice:
- Goal:
- What changed:
- Files changed:
- Checks run:
- Risks:
- Approval gates encountered:
- Next recommended slice:
```
