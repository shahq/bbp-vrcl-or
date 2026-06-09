# Firebase UI Recovery Plan

## Status

Active recovery plan for `codex/convex-vercel-recovery`.

This branch is based on `firebase-backend-migration`. That branch is the customer-facing UI source of truth. Local `main` contains the old design and must not be used as the recovery base.

## What Went Wrong

`codex/convex-vercel-migration` forked from local `main` at `7586344`, not from `firebase-backend-migration`.

The bad branch then manually replayed several Firebase-era features as `Port ...` commits. That preserved some product behavior, but it did not preserve the Firebase UI lineage. The biggest UI drift is in the app shell and workspace surfaces:

- `src/App.tsx`
- `src/components/TopBar.tsx`
- `src/components/NewProject.tsx`
- `src/components/RightPanel.tsx`
- `src/components/Sidebar.tsx`

The infinite canvas mostly survived because `src/components/Canvas.tsx` is close to the Firebase version. The direct branch diff between Firebase and Convex is only about 81 lines for `Canvas.tsx`, compared with hundreds of lines in shell/workspace files.

## Recovery Rule

Preserve Firebase UI first. Salvage Convex/Vercel/provider work second.

Use these sources:

- UI/design truth: `firebase-backend-migration`
- Convex/Vercel salvage source: `codex/convex-vercel-migration`
- Historical only: `main`

Do not replay early `Port ...` commits wholesale. They duplicate Firebase branch work and are the main source of UI drift.

## Convex Work To Salvage

Replay or manually port the Convex-specific work beginning with backend/provider seams:

- `dc79c58 Add local backend provider seams`
- `dfb4856 Route API through backend seams`
- `78cb16f Add Convex schema scaffold`
- `f249fa3 Add Convex sessions and cards adapter`
- `bcc375a Add Convex connections and notes adapter`
- `b0b8bb6 Add provider API smoke verification`
- `de1645e Verify linked Convex data provider`
- `a32b65b Add Convex attachment provider`
- `ae53382 Prepare Vercel Convex compatibility slice`
- `8bc03ee Add Vercel compatibility API wrapper`
- `9522f0d Verify Vercel Convex compatibility preview`
- `871049d Document Vercel smoke verification blockers`
- `f1634cf Add stateless Vercel admin provider`
- `4a5ea16 Document persisted Vercel preview env verification`
- `fa4d07d Document preview password normalization`
- `0826f25 Document preview AI key follow-up`
- `9af25f1 Expand AI provider seam for preview testing`
- `ef60e38 Set DeepSeek V4 Flash as preview AI default`

## Conflict Policy

- UI conflicts: prefer `firebase-backend-migration`.
- Canvas conflicts: prefer Firebase unless the Convex side is clearly backend/provider compatible and visually neutral.
- Backend/provider/config/script conflicts: preserve Firebase behavior and add Convex behind existing seams.
- API conflicts: keep `/api/*` compatibility unless a human explicitly approves a public contract change.
- Storage conflicts: keep SQLite and local attachment fallbacks.
- Docs conflicts: remove loop/process language and keep recovery-specific guidance.

## Verification

Required before handoff:

- `git diff --check`
- `npm run lint`
- `npm run build`
- Local smoke test of dashboard/session navigation, top bar, new-project flow, right panel, and infinite canvas pan/zoom/cards/thread connections.
- Provider smoke scripts where env allows.

## Current Risk

The Convex port was large and slow. Preserve as much of it as possible, but do not let backend salvage overwrite the Firebase UI. If a commit mixes UI drift with useful backend work, manually extract the backend work instead of accepting the commit wholesale.
