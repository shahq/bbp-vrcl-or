# Deployment Loop

Use this loop for Vercel, Convex deployment setup, PartyKit deployment settings, Railway evaluation, environment documentation, and staging/production handoff.

## Required Steps

1. Read `AGENTS.md`.
2. Read `docs/CONVEX_VERCEL_MIGRATION_PLAN.md`.
3. Restate the deployment slice goal.
4. Inspect current scripts, env docs, and deployment docs before editing.
5. Identify whether the slice touches local, staging, owner production, or all environments.
6. Propose the smallest implementation plan.
7. Implement only docs/config for the targeted environment.
8. Run relevant checks or dry runs if available.
9. Review `git diff`.
10. Update `docs/CONVEX_VERCEL_MIGRATION_CHECKLIST.md`.
11. Produce a handoff summary.

## Files To Inspect First

- `package.json`
- `.env.example`
- `README.md`
- `DEPLOYMENT.md`
- `STAGING_HANDOFF_CHECKLIST.md`
- `partykit.json`
- `partykit.config.ts`
- `firebase.json` only as historical/current-state context

## Deployment Principles

- Vercel hosts the frontend and temporary compatibility API.
- Convex owns persistent application data and file storage.
- PartyKit remains for high-frequency realtime behavior.
- Railway is optional only for extraction and requires approval.
- Keep staging owned by the developer until owner production handoff is explicitly planned.
- Keep owner production setup cloneable from GitHub with documented provider setup.

## Stop For Approval

Stop before:

- Adding Vercel, Convex, or Railway paid assumptions.
- Touching production env vars or deployment secrets.
- Changing deployment ownership or billing.
- Deleting Firebase / Cloud Run files.
- Changing PartyKit deployment behavior.

## Handoff Summary Template

```text
Deployment slice:
- Goal:
- Environment affected:
- Config/docs changed:
- Checks/dry runs:
- Secrets touched:
- Risks:
- Next recommended slice:
```
