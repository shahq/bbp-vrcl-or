# Provider Adapter Loop

Use this loop for slices that add or modify providers behind existing seams.

## Required Steps

1. Read `AGENTS.md`.
2. Read `docs/CONVEX_VERCEL_MIGRATION_PLAN.md`.
3. Restate the adapter slice goal.
4. Inspect the interface before inspecting implementations.
5. Inspect the current SQLite and Firestore implementations for behavior parity.
6. Add or modify only the targeted provider.
7. Preserve existing providers unless removal was explicitly approved.
8. Run relevant checks.
9. Review `git diff`.
10. Update `docs/CONVEX_VERCEL_MIGRATION_CHECKLIST.md`.
11. Produce a handoff summary.

## Interface-First Files

- `src/server/backend/types.ts`
- `src/server/backend/current.ts`
- `src/server/backend/data-store.ts`
- `src/server/backend/attachments.ts`

## Current Provider Facts

- `DATA_STORE_PROVIDER` currently routes data stores.
- `ATTACHMENT_STORE_PROVIDER` currently routes attachment storage.
- `ADMIN_AUTH_PROVIDER` currently routes admin auth.
- Convex must be added as a parallel provider first.
- SQLite must remain available as local fallback until Convex is verified.

## Implementation Rules

- Do not thread Convex directly through UI components in early slices.
- Do not bypass the existing provider interfaces.
- Do not remove SQLite or local file storage in the same slice that adds Convex.
- Do not change API responses unless the slice explicitly says so and approval is granted.

## Stop For Approval

Stop before:

- Adding Convex or another production dependency.
- Changing provider interface signatures.
- Removing SQLite fallback.
- Removing local attachment storage.
- Changing auth/session semantics.
- Changing exported data format.

## Handoff Summary Template

```text
Provider adapter slice:
- Goal:
- Interface used:
- Provider added/changed:
- Existing providers preserved:
- Files changed:
- Checks run:
- Risks:
- Next recommended slice:
```
