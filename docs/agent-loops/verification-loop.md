# Verification Loop

Use this loop after every migration slice and for dedicated QA slices.

## Required Steps

1. Read `AGENTS.md`.
2. Read `docs/CONVEX_VERCEL_MIGRATION_PLAN.md`.
3. Restate what changed in the slice being verified.
4. Choose the narrowest checks that prove the changed behavior.
5. Run the checks.
6. Inspect failures before editing.
7. Fix only issues inside the slice scope.
8. Re-run relevant checks.
9. Review `git diff`.
10. Update `docs/CONVEX_VERCEL_MIGRATION_CHECKLIST.md`.
11. Produce a handoff summary.

## Baseline Checks

- `npm run lint` for TypeScript and build-contract changes.
- Local smoke test for changed routes or UI behavior.
- Upload/export smoke tests for storage changes.
- Admin/guest session smoke tests for auth/session changes.
- PartyKit smoke tests only when realtime behavior is touched.

## Diff Review Checklist

Before handoff, verify:

- No unrelated files changed.
- No secrets or local env values were committed.
- Runtime artifacts under `data/sessions/**` were not added.
- SQLite fallback remains unless removal was approved.
- Local attachment fallback remains unless removal was approved.
- API response shape is unchanged unless approval was granted.
- Export format is unchanged unless approval was granted.
- PartyKit behavior is unchanged unless approval was granted.
- Migration checklist was updated.

## Stop For Approval

Stop before expanding verification into broad rewrites or changing architecture to make a test pass.

## Handoff Summary Template

```text
Verification slice:
- Behavior verified:
- Checks run:
- Results:
- Fixes made:
- Remaining risks:
- Next recommended slice:
```
