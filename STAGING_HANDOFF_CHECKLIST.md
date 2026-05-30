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
- Attachment metadata, extracted text, and shared notes: Firestore
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

## Staging frontend build settings

Firebase Hosting staging should be built with:

```bash
npm run build:staging
firebase deploy --only hosting --project sqd-bbp
```

The staging build reads `.env.staging`, which should contain only browser-safe `VITE_*` variables:

```bash
VITE_API_BASE_URL=https://bbp-backend-staging-471025386718.us-central1.run.app
VITE_PARTYKIT_HOST=beyond-bullet-points.the-shaper.partykit.dev
VITE_PARTYKIT_PARTY=main
```

For local development, use `npm run dev` and leave `VITE_API_BASE_URL`, `NODE_ENV`, and `PORT` unset in `.env.local`.

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
- admin and guest-with-edit-access brief editing
- upload, rename, note, and delete briefing documents
- extract text and summaries from uploads
- generate project brief from all usable uploads
- regenerate cards from the completed brief as an edit-mode user
- capture shared canvas notes in the right-panel Notepad
- export overview and full canvas as DOCX
- export docx / markdown / json / zip
- replace the current session from an exported ZIP archive, including shared notes when present

## Intentional alpha tradeoffs

### 1. Admin auth is still password-based

This is intentional for alpha because the admin group is currently small and trusted.

Implication:
- Firebase Auth is deferred, not abandoned

### 2. Uploaded file binaries are not durable yet

`ATTACHMENT_STORE_PROVIDER=ephemeral` means:

- uploaded files are kept only long enough for server-side extraction
- extracted text, summaries, source notes, shared notes, and metadata persist in Firestore
- original file binaries may disappear when the backend instance is replaced, restarted, or redeployed

Implication:
- uploads are usable for briefing and card generation
- uploads are not yet client-grade durable storage

### 3. ZIP export/import is honest about temporary uploads

If original upload binaries are no longer available:

- `attachments.json` still exists in the export
- extracted text and summaries still persist
- the ZIP can include a note explaining that original binaries were temporary
- importing the ZIP restores attachment metadata, extracted text, summaries, source notes, and shared notepad records
- importing the ZIP cannot restore original binaries unless they were present in the archive

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
9. Rename the upload and add a source note
10. Generate a project brief from uploads
11. Return to canvas and confirm a guest with edit access can return to brief and regenerate cards
12. Add text in the canvas **Notepad** tab and confirm another admin/guest browser receives the update
13. Export overview DOCX, full canvas DOCX, markdown, json, and zip
14. Confirm the full canvas DOCX and ZIP include **Notes**
15. Upload the exported ZIP through **Upload Session** and confirm the current session is replaced with the archive contents, including notes

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
