# Beyond Bullet Points - Firebase Backend Migration Plan

## Goal

Move the backend toward a Firebase-owned architecture while preserving the current user experience as much as possible.

This is a backend and persistence rewrite, not a product redesign.

### Product-Level Outcome

After the migration:

- the app still presents the same workshop experience
- the canvas, onboarding flow, exports, uploads, and PartyKit realtime behavior remain intact
- the client owns the backend stack inside Firebase / Google Cloud
- SQLite and local file persistence are removed from production paths
- PartyKit remains in place for realtime collaboration

## Is This A Fundamental App Rewrite?

No, not at the user-experience level.

Yes, at the backend implementation level.

The UI should stay largely unchanged. The work is concentrated in:

- auth backend
- data persistence
- file storage
- server runtime placement

The only user-facing area that may change slightly is admin authentication, but even that can keep the same `/login` screen and the same high-level admin workflow.

## Recommended Target Architecture

### Keep

- React + Vite frontend
- current canvas UX
- PartyKit realtime service
- AI provider abstraction
- document extraction flow
- export flow

### Replace

- `ADMIN_PASSWORD` auth with Firebase Auth-backed admin access
- SQLite session/card/connection storage with Firestore
- local attachment and session files with Cloud Storage and Firestore metadata
- generic Node hosting with Cloud Run

## Why Cloud Run

For this repo, Cloud Run is the right first Firebase-aligned backend runtime because the codebase already has a single Express server.

That lets us:

- keep the current route surface while migrating internals
- move backend ownership into the client's Google environment early
- avoid forcing an immediate Express-to-Functions rewrite

Cloud Functions can still be introduced later for narrower workloads if desired.

## Current Backend Surface

### Server entrypoint

- [server.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/server.ts)

### Current auth implementation

- [src/server/admin.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/admin.ts)

Current behavior:

- shared admin password from env
- admin sessions persisted in SQLite
- PartyKit admin token minted from server secret

### Current session persistence

- [src/server/sessions.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/sessions.ts)

Current behavior:

- sessions stored in SQLite
- participant password stored as bcrypt hash

### Current card persistence

- [src/server/cards.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/cards.ts)
- [src/server/files.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/files.ts)

Current behavior:

- card index stored in SQLite
- card content stored in markdown files under `data/sessions/.../cards/*.md`

### Current connection persistence

- [src/server/connections.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/connections.ts)

Current behavior:

- connections stored in SQLite
- mirrored to `connections.json`

### Current attachments and document ingestion

- [src/server/files.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/files.ts)
- [src/server/documents.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/documents.ts)

Current behavior:

- binary file stored locally under `data/sessions/.../attachments/...`
- attachment metadata stored in `attachments.json`
- extraction runs server-side through `scripts/extract_attachment.py`

## Target Firebase Mapping

### Auth

Current:

- `ADMIN_PASSWORD`
- `admin_sessions` SQLite table

Target:

- Firebase Auth for admin identities
- server verifies Firebase ID tokens
- Firestore or custom claims define admin authorization

### Sessions

Current:

- SQLite `sessions`
- `session.json`

Target:

- Firestore `sessions/{sessionId}`

### Cards

Current:

- SQLite `cards`
- markdown files with YAML frontmatter

Target:

- Firestore `sessions/{sessionId}/cards/{cardId}`

Notes:

- markdown export can still be generated on demand from Firestore data
- we do not need markdown files as the production source of truth

### Connections

Current:

- SQLite `connections`
- `connections.json`

Target:

- Firestore `sessions/{sessionId}/connections/{connectionId}`

### Attachments

Current:

- local filesystem
- `attachments.json`

Target:

- Cloud Storage for file bytes
- Firestore `sessions/{sessionId}/attachments/{attachmentId}` for metadata

### Backend runtime

Current:

- Express on generic Node host

Target:

- Express on Cloud Run

## Migration Strategy

Use staged backend migration, but keep the repo moving toward the final Firebase backend rather than introducing a temporary non-Google host.

## Phase 1 - Create Backend Seams

Objective:

Remove direct storage assumptions from route handlers before swapping implementations.

### Files to refactor

- [server.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/server.ts)
- [src/server/admin.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/admin.ts)
- [src/server/sessions.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/sessions.ts)
- [src/server/cards.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/cards.ts)
- [src/server/connections.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/connections.ts)
- [src/server/files.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/files.ts)

### Introduce interfaces

Recommended new server seams:

- `src/server/auth/`
- `src/server/data/`
- `src/server/storage/`

Recommended interface split:

- `AdminAuthProvider`
- `SessionStore`
- `CardStore`
- `ConnectionStore`
- `AttachmentStore`

### Outcome

Route handlers stop importing SQLite and filesystem modules directly.

## Phase 2 - Cloud Run Runtime

Objective:

Move backend runtime ownership into the client's Google environment without changing the external API contract.

### Scope

- containerize or deploy the Express app to Cloud Run
- keep route paths stable
- keep PartyKit token minting on the backend

### Outcome

- backend runtime is already in Google Cloud
- frontend can point to a Google-owned backend URL

## Phase 3 - Firebase Auth For Admins

Objective:

Replace shared admin password auth with Firebase Auth-backed admin access.

### Current code to replace

- [src/server/admin.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/admin.ts)
- admin routes in [server.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/server.ts)
- client auth calls in:
  - [src/contexts/AuthContext.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/contexts/AuthContext.tsx)
  - [src/components/LoginPage.tsx](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/components/LoginPage.tsx)

### Recommendation

- keep the `/login` page UX
- switch implementation from password POST to Firebase Auth sign-in
- verify admin privilege via custom claims or `admins/{uid}` in Firestore

### Outcome

- no shared admin password in production
- client controls admin identities in Firebase

## Phase 4 - Firestore For Sessions, Cards, Connections

Objective:

Replace SQLite and JSON sidecar files as the source of truth.

### Current code to replace

- [src/server/db.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/db.ts)
- [src/server/sessions.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/sessions.ts)
- [src/server/cards.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/cards.ts)
- [src/server/connections.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/connections.ts)

### Firestore shape

```text
sessions/{sessionId}
  name
  projectClient
  projectBackground
  projectNotes
  onboardingCompleted
  hasPassword
  passwordHash
  isArchived
  createdAt
  updatedAt

sessions/{sessionId}/cards/{cardId}
  section
  content
  order
  starred
  createdAt
  updatedAt

sessions/{sessionId}/connections/{connectionId}
  from
  to
  createdAt
```

### Notes

- participant session passwords can remain bcrypt hashes stored in Firestore
- exports continue to be generated from the new data model

### Outcome

- SQLite removed from production path
- `session.json`, card markdown files, and `connections.json` are no longer required for runtime persistence

## Phase 5 - Cloud Storage For Attachments

Objective:

Replace local attachment storage with Cloud Storage while keeping extraction and summaries server-side.

### Current code to replace

- [src/server/files.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/files.ts)
- attachment handlers in [server.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/server.ts)
- [src/server/documents.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/documents.ts)

### Target

- uploaded file bytes in Cloud Storage
- attachment metadata in Firestore
- extraction still performed by backend after upload

### Recommended metadata shape

```text
sessions/{sessionId}/attachments/{attachmentId}
  name
  mimeType
  size
  storagePath
  uploadedAt
  extractionStatus
  extractedText
  summary
  note
```

### Outcome

- no attachment dependence on local disk
- exports and summarization continue to work with the same UX

## Phase 6 - Import Existing Data

Objective:

Move existing local development data into Firebase-backed stores.

### Source data

- `data/sessions.db`
- `data/sessions/**`

### Needed migration tooling

- one import script from SQLite/filesystem into Firestore/Cloud Storage
- one dry run against staging
- one production import plan for the client project

### Outcome

- existing sessions survive the migration

## Phase 7 - Remove Legacy Persistence

Objective:

Delete the old persistence path once Firebase-backed storage is verified.

### Remove or deprecate

- [src/server/db.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/db.ts)
- local-data assumptions in [src/server/files.ts](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/src/server/files.ts)
- `ADMIN_PASSWORD` production dependency
- volume-based deployment assumptions

### Outcome

- production architecture is no longer split across old and new storage layers

## PartyKit Position

PartyKit remains in place during this migration.

That means:

- no change to the collaboration model
- no Firebase rewrite of realtime presence is required for alpha
- only token minting and host configuration stay coupled to the backend

## User Experience Expectations

### What should stay unchanged

- `/login` as the admin entry point
- participant join flow at `/:sessionId`
- session creation and onboarding flow
- canvas interaction
- realtime collaboration behavior
- upload, brief generation, and export workflows

### What may change slightly

- admin sign-in implementation under the same screen
- some error states while auth/session rules are tightened

## Risk Assessment

### Low-risk areas

- moving runtime to Cloud Run
- keeping PartyKit unchanged
- preserving the existing frontend routes and UI

### Medium-risk areas

- Firestore document shape and query behavior
- attachment migration and Cloud Storage permissions
- export generation after source-of-truth changes

### Highest-risk areas

- auth migration if admin roles and token verification are rushed
- mixed-mode persistence if SQLite and Firestore stay live too long
- incomplete import tooling for existing sessions

## Recommended Execution Order

1. introduce backend interfaces and adapter seams
2. move runtime to Cloud Run
3. add Firebase Auth-backed admin path
4. migrate sessions/cards/connections to Firestore
5. migrate attachments to Cloud Storage
6. import existing data
7. remove SQLite/local-file runtime dependence

## Recommendation

Proceed with a staged backend migration, but treat Firebase as the production destination now rather than as a future optional improvement.

This repo does not need a fundamental UX rewrite.

It does need a deliberate backend rewrite in the specific areas listed above.
