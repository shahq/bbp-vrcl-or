# Staging Handoff Checklist

This file captures the current deployed staging environment, the alpha tradeoffs that are intentionally in place, and the next migration phases for client handoff.

## Current staging URLs

- Frontend: `https://sqd-bbp.web.app`
- Backend: `https://bbp-backend-staging-471025386718.us-central1.run.app`
- PartyKit: `https://beyond-bullet-points.the-shaper.partykit.dev`

## Current staging architecture

- Frontend: Firebase Hosting
- Backend runtime: Cloud Run
- Realtime: PartyKit
- Session/card/connection persistence: Firestore
- Attachment metadata and extracted text: Firestore
- Original uploaded file binaries: temporary only
- Admin auth: shared password

## Current backend settings

These are the important runtime settings for staging:

```bash
DATA_STORE_PROVIDER=firestore
ATTACHMENT_STORE_PROVIDER=ephemeral
ADMIN_AUTH_PROVIDER=password
PARTYKIT_HOST=beyond-bullet-points.the-shaper.partykit.dev
CORS_ALLOWED_ORIGINS=https://sqd-bbp.web.app,https://sqd-bbp.firebaseapp.com
```

Backend also requires:

```bash
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
ADMIN_PASSWORD
PARTYKIT_ADMIN_SECRET
AI_PROVIDER
AI_DEFAULT_MODEL
GOOGLE_API_KEY
```

## What works in staging now

- admin login
- create session
- participant join via session link
- PartyKit multiplayer / realtime canvas sync
- generate cards
- edit / add / delete cards
- upload documents
- extract text and summaries from uploads
- generate project brief from uploads
- export markdown / json / zip

## Intentional alpha tradeoffs

### 1. Admin auth is still password-based

This is intentional for alpha because the admin group is currently small and trusted.

Implication:
- Firebase Auth is deferred, not abandoned

### 2. Uploaded file binaries are not durable yet

`ATTACHMENT_STORE_PROVIDER=ephemeral` means:

- uploaded files are kept only long enough for server-side extraction
- extracted text, summaries, source notes, and metadata persist in Firestore
- original file binaries may disappear when the backend instance is replaced, restarted, or redeployed

Implication:
- uploads are usable for briefing and card generation
- uploads are not yet client-grade durable storage

### 3. ZIP export is honest about temporary uploads

If original upload binaries are no longer available:

- `attachments.json` still exists in the export
- extracted text and summaries still persist
- the ZIP can include a note explaining that original binaries were temporary

## Smoke test checklist

Use this after backend or frontend deploys:

1. Open `https://sqd-bbp.web.app`
2. Log in as admin
3. Create a new session
4. Generate cards
5. Edit, add, and delete cards
6. Open the same session in a second browser/incognito window
7. Confirm realtime sync works
8. Upload a document
9. Generate a project brief from uploads
10. Export markdown, json, and zip

## Client handoff discussion points

These are the next platform decisions to review with the client:

### 1. Cloud Storage / Blaze

Needed when the client wants:

- durable uploaded source documents
- stable attachment downloads
- client-owned long-term document storage

When enabled later:

- switch `ATTACHMENT_STORE_PROVIDER=firebase`
- set `FIREBASE_STORAGE_BUCKET=...`

### 2. Firebase Auth

Needed when the client wants:

- managed admin identities
- admin onboarding/offboarding without touching env vars
- cleaner long-term ownership and security posture

### 3. Production Firebase project

Staging is now online. The next environment decision is whether to:

- keep iterating in staging only
- or replicate this stack into the client-owned production Firebase / GCP project

## Recommended next phases

1. Keep testing and stabilizing staging
2. Decide on Cloud Storage / Blaze with the client
3. Add Firebase Auth when admin management needs to move out of shared-password mode
4. Create the client production environment using the same deployment shape
