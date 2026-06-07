# Storage Migration Loop

Use this loop for source document uploads, attachment metadata, file storage, extraction inputs, and export/restore behavior.

## Required Steps

1. Read `AGENTS.md`.
2. Read `docs/CONVEX_VERCEL_MIGRATION_PLAN.md`.
3. Restate the storage slice goal.
4. Inspect attachment and document extraction code before editing.
5. Identify whether original file bytes, extracted text, summaries, source notes, exports, or restore behavior are affected.
6. Propose the smallest implementation plan.
7. Implement only the targeted storage behavior.
8. Run relevant checks.
9. Review `git diff`.
10. Update `docs/CONVEX_VERCEL_MIGRATION_CHECKLIST.md`.
11. Produce a handoff summary.

## Files To Inspect First

- `src/server/backend/types.ts`
- `src/server/backend/attachments.ts`
- `src/server/files.ts`
- `src/server/documents.ts`
- `scripts/extract_attachment.py`
- `server.ts`

## Convex Storage Rules

- Prefer Convex Storage upload URLs for large files.
- Do not route large uploads through Vercel Functions.
- Keep attachment metadata and extraction state queryable by session.
- Keep local attachment storage available until Convex storage is verified.
- Document whether original binaries are durable for each storage mode.

## Extraction Decision Boundary

Document extraction is its own decision. Preferred path is a Node-compatible extraction adapter. Fast proof path is a Railway extraction worker that reads from Convex Storage and writes back through Convex.

Adding Railway requires human approval.

## Stop For Approval

Stop before:

- Changing exported data format.
- Removing local attachment storage.
- Changing document extraction behavior.
- Adding Railway.
- Adding paid infrastructure assumptions.
- Touching production secrets.

## Handoff Summary Template

```text
Storage slice:
- Goal:
- Storage mode affected:
- Original binary behavior:
- Extraction behavior:
- Export/restore impact:
- Files changed:
- Checks run:
- Risks:
- Next recommended slice:
```
