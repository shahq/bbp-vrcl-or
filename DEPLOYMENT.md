# Beyond Bullet Points - Deployment Guide

## Table of Contents
1. [Pre-Deployment Considerations](#pre-deployment-considerations)
2. [Architecture Overview](#architecture-overview)
3. [Firebase Client-Handoff Track](#firebase-client-handoff-track)
4. [GitHub Collaboration And Repo Handoff](#github-collaboration-and-repo-handoff)
5. [PartyKit Deployment](#partykit-deployment)
6. [Express Backend Deployment](#express-backend-deployment)
7. [Frontend Deployment](#frontend-deployment)
8. [Testing Multiplayer](#testing-multiplayer)
9. [Environment Configuration](#environment-configuration)
10. [Monitoring & Debugging](#monitoring--debugging)
11. [Troubleshooting](#troubleshooting)
12. [Security Checklist](#security-checklist)

---

## Pre-Deployment Considerations

### 1. Hosting Requirements

**PartyKit (Real-time Multiplayer):**
- Runs on Cloudflare Workers (serverless)
- Requires Cloudflare account (free tier available)
- Global edge deployment (low latency worldwide)
- Automatic scaling

**Express Backend:**
- Preferred Firebase-aligned runtime: **Cloud Run**
- Repo now includes a production [Dockerfile](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/Dockerfile)
- Current alpha backend shape no longer requires SQLite or persistent attachment storage if using:
  - `DATA_STORE_PROVIDER=firestore`
  - `ATTACHMENT_STORE_PROVIDER=ephemeral`
- PartyKit still remains separate

**Frontend (React + Vite):**
- Static files after `npm run build`
- Can host on: Cloudflare Pages, Vercel, Netlify, GitHub Pages
- Or serve from Express backend (included in current setup)

**Firebase client handoff (recommended alpha direction):**
- Use separate Firebase projects for developer testing and client production
- Treat Firebase as the client-owned target architecture from the start, even if every subsystem is not migrated before alpha
- Prioritize Firebase for hosting ownership, auth, data, and file-storage seams first
- Keep AI calls, document extraction, exports, and privileged role changes server-side until the Firebase transition is complete

### 2. Domain & SSL

**Recommended Setup For Alpha:**
- Main domain: `bbp.yourdomain.com` (Firebase Hosting or Netlify frontend)
- API domain: `api.bbp.yourdomain.com` (Express backend)
- PartyKit: `partykit.yourdomain.com` or use PartyKit's subdomain
- All domains need SSL certificates (HTTPS required for WebSockets)

**CORS Configuration:**
PartyKit server must accept connections from your domain:
```typescript
// In party/index.ts - CORS headers will be needed for production
```

### 3. Database Persistence

**Current alpha backend target:**
- Firestore persists sessions, cards, connections, attachment metadata, extracted text, summaries, and source notes
- SQLite is no longer required in the deployment path when `DATA_STORE_PROVIDER=firestore`
- If you intentionally fall back to `DATA_STORE_PROVIDER=sqlite`, you would again need persistent disk

### 4. File Storage

**Current alpha backend target:**
- Card/session runtime persistence no longer depends on local files when using Firestore
- Uploaded source document binaries can run in `ATTACHMENT_STORE_PROVIDER=ephemeral` mode
- In ephemeral mode, original uploaded files are temporary processing artifacts
- Durable uploaded file storage is deferred until Cloud Storage / Blaze is enabled

### 5. Recommended Alpha Path

The cleanest alpha path for this repo is a hybrid deployment that keeps the current backend stable while aligning ownership with the client's Firebase stack.

Recommended hybrid alpha path:

1. Deploy PartyKit separately.
2. Deploy the Express backend to Cloud Run.
3. Use Firestore for sessions/cards/connections.
4. Use temporary upload processing with `ATTACHMENT_STORE_PROVIDER=ephemeral`.
5. Host the frontend on Firebase Hosting.
6. Introduce Cloud Storage and Firebase Auth later as explicit follow-up phases.

Why this is the recommended alpha path:

- The app can launch without rewriting exports, document extraction, and AI integrations.
- The client still gets a Firebase-owned destination architecture.
- The next owner can migrate adapters one seam at a time instead of unwinding an emergency pre-launch rewrite.

What should move to Firebase first:

1. Frontend hosting ownership
2. Admin authentication
3. Session, card, and connection storage
4. Attachment storage and metadata

What can stay outside Firebase through alpha:

1. AI provider adapters
2. Document extraction
3. Export generation
4. PartyKit realtime fanout

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  React App (Vite)                                        │  │
│  │  - User Interface                                        │  │
│  │  - PartyKit Client (WebSocket)                          │  │
│  │  - REST API Client (HTTP)                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼ WebSocket                   ▼ HTTP
┌──────────────────────────┐    ┌──────────────────────────┐
│      PARTYKIT SERVER     │    │     EXPRESS SERVER       │
│   (Cloudflare Workers)   │    │   (Your Hosting)         │
│  ┌────────────────────┐  │    │  ┌────────────────────┐  │
│  │ Session Rooms      │  │    │  │ REST API           │  │
│  │ - Real-time sync   │  │    │  │ - CRUD operations  │  │
│  │ - Presence         │  │    │  │ - Auth             │  │
│  │ - Cursor tracking  │  │    │  │ - Export           │  │
│  └────────────────────┘  │    │  └────────────────────┘  │
└──────────────────────────┘    │  ┌────────────────────┐  │
                                │  │ SQLite Database    │  │
                                │  │ - Sessions         │  │
                                │  │ - Cards index      │  │
                                │  │ - Connections      │  │
                                │  └────────────────────┘  │
                                │  ┌────────────────────┐  │
                                │  │ File System        │  │
                                │  │ - Card markdown    │  │
                                │  │ - Session JSON     │  │
                                │  └────────────────────┘  │
                                └──────────────────────────┘
```

### Firebase Target Architecture

The Firebase handoff architecture should keep product code separated from vendor code:

```
CLIENT BROWSER
  React App
  - Firebase Auth client
  - Firestore reads/listeners where safe
  - Cloud Storage uploads where allowed by rules
  - PartyKit WebSocket client
  - REST client for privileged AI/export/document operations

SERVER / FUNCTIONS
  - Firebase Admin SDK
  - AI provider adapters
  - Document extraction
  - Export generation
  - Role/custom-claim management

FIREBASE
  - Auth: admin/client identities
  - Firestore: sessions, cards, connections, attachment metadata
  - Cloud Storage: uploaded source files
  - Security Rules: user/session-level access boundaries

PARTYKIT
  - Live presence
  - Cursor sync
  - Realtime canvas event fanout
```

### Recommended Alpha Architecture

Use this as the default plan unless the client requires a full Firebase migration before launch:

```text
CLIENT BROWSER
  React App
  - Hosted on Firebase Hosting or Netlify
  - PartyKit WebSocket client
  - REST client to Express backend

EXPRESS BACKEND
  - AI calls
  - document extraction
  - exports
  - temporary session/data adapters where migration is incomplete

FIREBASE
  - Production project owned by client
  - Hosting now or soon
  - Auth introduced early
  - Firestore and Cloud Storage introduced in stages

PARTYKIT
  - Presence and realtime sync
```

---

## Firebase Client-Handoff Track

Use this track when preparing the app for a client-owned Firebase production environment while still testing against developer-owned accounts. For this project, this is the preferred handoff track, but it should be executed in staged slices rather than a single rewrite.

### Recommended Project Structure

Create separate Firebase projects:

- `bbp-dev` or `bbp-staging`: owned by the developer/team, used for implementation and QA
- `bbp-prod`: owned by the client, used for production workshops

Do not share one Firebase project between development and production. Separate projects keep test data, test users, rules experiments, and billing isolated from the client production environment.

### Recommended Rollout Strategy

For this repo, use a hybrid alpha rollout:

1. Deploy the current backend and PartyKit stack so the product is live.
2. Put production ownership on the client's Firebase project as early as possible.
3. Move frontend hosting to Firebase Hosting when the client is ready, or start there immediately if the backend remains separate.
4. Introduce Firebase Auth and role management before final handoff.
5. Migrate sessions, cards, connections, and attachments from local storage into Firestore and Cloud Storage in controlled stages.
6. Keep AI, exports, and document processing server-side until the Firebase data migration is stable.

### Ownership Model

Recommended handoff flow:

1. Developer creates and tests against `bbp-dev`.
2. Client creates `bbp-prod` under their Google/Firebase organization.
3. Client grants developer temporary admin access during launch.
4. Developer configures production Auth, Firestore, Storage, Rules, and env vars.
5. Developer imports seed/session data if needed.
6. Client verifies access with their own admin users.
7. Developer access is removed or reduced to agreed support access.

### Firebase Products To Enable

Enable these products in both dev and production projects:

- Firebase Authentication
- Cloud Firestore
- Cloud Storage for Firebase
- Firebase Local Emulator Suite for local development

Optional later:

- Firebase App Check
- Cloud Functions for Firebase, if moving privileged backend routes into Firebase
- Firebase Hosting, either instead of Netlify or as the final client-owned hosting target

### Environment Variables

Frontend variables use the `VITE_` prefix because they are bundled into the browser app:

```bash
VITE_API_BASE_URL=...
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_PARTYKIT_HOST=...
VITE_PARTYKIT_PARTY=main
```

Server-only variables must not be exposed to the browser:

```bash
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
AI_PROVIDER=opencode
AI_DEFAULT_MODEL=minimax-m2.5
GOOGLE_API_KEY=...
OPENCODE_API_KEY=...
OPENROUTER_API_KEY=...
PARTYKIT_HOST=...
PARTYKIT_ADMIN_SECRET=...
```

For Netlify, put frontend variables in the build environment and server-only variables in the backend/Functions runtime environment. Do not commit `.env` files.

### Adapter Boundaries

Before swapping storage providers, keep Firebase behind clear seams:

- `src/server/auth/*`: admin/session role resolution
- `src/server/database/*`: sessions, cards, connections, metadata
- `src/server/storage/*`: uploaded files and extracted artifacts
- `src/server/ai/*`: AI provider calls

The current app already has useful seams around AI, sessions, files, and auth context. Preserve that shape so Firebase is an adapter, not a rewrite threaded through UI components.

### Suggested Firestore Model

Use this as the first production-ready data shape:

```text
sessions/{sessionId}
  name
  projectClient
  projectBackground
  projectNotes
  onboardingCompleted
  passwordRequired
  ownerOrgId
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

sessions/{sessionId}/attachments/{attachmentId}
  filename
  storagePath
  mimeType
  size
  status
  summary
  extractedText
  note
  createdAt
  updatedAt

admins/{uid}
  email
  role
  createdAt
```

Store actual uploaded files in Cloud Storage:

```text
sessions/{sessionId}/attachments/{attachmentId}/{filename}
```

### Auth And Roles

Recommended first pass:

- Admins sign in with Firebase Auth.
- Admin authorization is checked through either:
  - Firebase custom claims, or
  - an `admins/{uid}` Firestore document.
- Participants can keep the current session-link/password model during the transition.
- Later, participants can use anonymous Auth or named accounts if the client needs auditability.

Custom claims are cleaner for rules and UI branching, but they require server/Admin SDK code to set and update roles.

### Security Rules Direction

Do not deploy with broad `allow read, write: if request.auth != null` rules.

Minimum production rules should enforce:

- Only admins can create/delete sessions.
- Admins can read and write all sessions they manage.
- Participants can read only sessions they are allowed to access.
- Card and connection writes require edit permission.
- Attachment reads/writes are scoped to the session.
- Storage access checks the matching Firestore session/attachment permission.

Privileged operations should stay server-side:

- AI generation
- document extraction
- export ZIP generation
- custom-claim updates
- destructive admin operations

### Local Firebase Testing

Use Firebase Emulator Suite for local Firebase work:

```bash
firebase login
firebase init emulators
firebase emulators:start
```

Recommended emulators:

- Authentication
- Firestore
- Storage
- Functions, if Functions are introduced

Use emulators to test:

- Admin sign-in
- Firestore reads/writes
- Storage uploads
- Security Rules
- Migration scripts

### Migration Plan From Local Data

Move in stages:

1. Add Firebase config and emulator setup.
2. Add Firebase Auth for admin sign-in while keeping current admin password as a fallback.
3. Move attachment files to Cloud Storage and attachment metadata to Firestore.
4. Move sessions/cards/connections to Firestore.
5. Replace local SQLite/file reads with database/storage adapters.
6. Add a one-time import script from `data/sessions` into Firestore/Storage.
7. Run the import against `bbp-dev`.
8. Validate app behavior and Security Rules.
9. Run the import against client-owned `bbp-prod`.
10. Remove the fallback admin password once Firebase Auth is verified.

### Firebase Handoff Checklist

- [ ] Client owns the production Firebase project
- [ ] Developer has temporary admin access only as needed
- [ ] Separate dev/staging Firebase project exists
- [ ] Firebase Auth enabled
- [ ] Firestore enabled with production rules
- [ ] Cloud Storage enabled with production rules
- [ ] Local Emulator Suite configured
- [ ] Frontend Firebase env vars configured in hosting provider
- [ ] Server Firebase Admin credentials configured only in backend/Functions
- [ ] AI provider keys configured only in backend/Functions
- [ ] PartyKit host and admin secret configured
- [ ] Test admin account created for developer QA
- [ ] Client admin account created and verified
- [ ] Migration/import dry run completed in dev
- [ ] Production import completed or seed data intentionally skipped
- [ ] Developer access removed or reduced after launch

---

## GitHub Collaboration And Repo Handoff

Use this section when both the developer and client will edit the same codebase before final handoff.

### Recommended Ownership Model

Preferred final state:

- The production repo lives in the client's GitHub organization.
- The developer has collaborator or team access during active development and support.
- The client owns production Firebase, production hosting, and production deploy settings.
- The developer keeps a fork or separate dev/staging repo only if needed for experimental work.

Acceptable transition state:

- The repo starts under the developer account while product shape is still changing.
- Before launch, transfer the repo to the client organization or mirror it into a client-owned repo.
- Reconnect Netlify/Firebase/hosting deploys after transfer so production deploy credentials are client-owned.

Avoid:

- Production deploys tied permanently to the developer's personal GitHub account.
- Both parties pushing directly to `main`.
- Secrets stored in repo files.

### Branch And Deploy Model

Recommended branch layout:

```text
main       production
staging    shared QA, optional
feature/*  developer/client changes
fix/*      small corrections
```

Recommended deploy mapping:

- `main` deploys to production.
- `staging` deploys to a shared QA environment, if used.
- Pull requests get preview deploys through Netlify or another preview-capable host.
- Firebase production data is used only by production deploys.
- Firebase dev/staging data is used by preview and QA deploys.

### Pull Request Rules

Use pull requests even while the team is small.

Minimum rules:

- Require PRs before merging to `main`.
- Require `npm run lint` to pass.
- Require `npm run build` to pass before production merges.
- Require at least one reviewer when the client starts editing code.
- Protect `main` from force pushes.
- Prefer squash merges to keep history readable.

Recommended PR checklist:

- [ ] Change is scoped and described clearly
- [ ] Screenshots or preview URL included for UI changes
- [ ] Data/security impact noted if Firebase rules, auth, uploads, or AI keys are touched
- [ ] `npm run lint` passes
- [ ] `npm run build` passes for deploy-impacting changes

### Client Editing Workflow

When the client starts touching the project:

1. Give the client GitHub access through an organization team, not a shared account.
2. Ask the client to work on feature branches.
3. Use PR previews for visual review.
4. Merge to `staging` for shared QA when the change needs broader testing.
5. Merge to `main` only when the change is ready for production.
6. Keep Firebase Security Rules and production env var changes behind explicit review.

This keeps collaboration lightweight while preventing accidental production deploys.

### Handoff Access Checklist

- [ ] Client owns or controls the GitHub organization/repo
- [ ] Developer has collaborator/team access with the minimum required permissions
- [ ] `main` branch protection enabled
- [ ] Production deploys are connected to `main`
- [ ] Preview deploys are enabled for pull requests
- [ ] Firebase dev/staging and production projects are clearly separated
- [ ] Production secrets are stored only in hosting/backend provider settings
- [ ] Client has at least one verified repo admin
- [ ] Client has at least one verified Firebase production admin
- [ ] Developer access removal/reduction date is agreed before final handoff

---

## PartyKit Deployment

### Step 1: Create Cloudflare Account

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Sign up for free account
3. Verify email address

### Step 2: Install PartyKit CLI (if not already)

```bash
# Already installed as devDependency
npm list partykit
```

### Step 3: Login to PartyKit

```bash
npx partykit login
```

This will open a browser window to authenticate with Cloudflare.

### Step 4: Deploy

```bash
# Deploy to PartyKit
npm run partykit:deploy

# Or directly:
npx partykit deploy
```

**Expected Output:**
```
✨ Built project
🌍 Deployed to https://beyond-bullet-points.{username}.partykit.dev
```

### Step 5: Verify Deployment

```bash
# Check health endpoint
curl https://beyond-bullet-points.{username}.partykit.dev/health

# Expected response:
{"status":"ok","room":"test","connections":0,"users":0,"lastActivity":...}
```

### Step 6: Configure Custom Domain (Optional)

1. Go to Cloudflare dashboard
2. Select your PartyKit project
3. Add custom domain in settings
4. Update DNS records as instructed

---

## Express Backend Deployment

### Recommended Path: Cloud Run

Use Cloud Run for the backend runtime. It keeps the app in the client’s Google/Firebase environment without forcing a full Functions rewrite.

The repo now includes:

- [Dockerfile](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/Dockerfile)
- [.dockerignore](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/.dockerignore)
- [requirements.txt](/Users/HAND/Documents/a/work/2026/sqd/sqd-bbp/requirements.txt) for document extraction dependencies

### Alpha backend assumptions

For the current alpha deployment:

- `DATA_STORE_PROVIDER=firestore`
- `ATTACHMENT_STORE_PROVIDER=ephemeral`
- `ADMIN_AUTH_PROVIDER=password`
- PartyKit stays separate
- uploaded document binaries are temporary processing artifacts
- extracted text, summaries, source notes, sessions, cards, and connections persist

### 1. Enable required Google services

In project `sqd-bbp`, make sure these are enabled:

- Cloud Run
- Artifact Registry
- Firestore

Cloud Storage is **not** required yet if you stay on `ATTACHMENT_STORE_PROVIDER=ephemeral`.

### 2. Authenticate gcloud

```bash
gcloud auth login
gcloud config set project sqd-bbp
```

### 3. Build and deploy the backend

From the repo root:

```bash
gcloud run deploy bbp-backend-staging \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

If you prefer Docker explicitly instead of `--source`, you can also build from the checked-in Dockerfile:

```bash
gcloud builds submit --tag us-central1-docker.pkg.dev/sqd-bbp/bbp/bbp-backend-staging

gcloud run deploy bbp-backend-staging \
  --image us-central1-docker.pkg.dev/sqd-bbp/bbp/bbp-backend-staging \
  --region us-central1 \
  --allow-unauthenticated
```

### 4. Set backend environment variables

Set these on the Cloud Run service:

```bash
NODE_ENV=production
DATA_STORE_PROVIDER=firestore
ATTACHMENT_STORE_PROVIDER=ephemeral
ADMIN_AUTH_PROVIDER=password

FIREBASE_PROJECT_ID=sqd-bbp
FIREBASE_CLIENT_EMAIL=your_service_account_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

ADMIN_PASSWORD=your_admin_password
PARTYKIT_HOST=beyond-bullet-points.the-shaper.partykit.dev
PARTYKIT_ADMIN_SECRET=your_partykit_secret

AI_PROVIDER=google
AI_DEFAULT_MODEL=gemini-3.1-pro-preview
GOOGLE_API_KEY=your_google_api_key
OPENCODE_API_KEY=your_opencode_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

Notes:

- `PORT` is provided by Cloud Run automatically
- `FIREBASE_STORAGE_BUCKET` is **not needed** in `ephemeral` attachment mode
- if you later enable Cloud Storage, switch:
  - `ATTACHMENT_STORE_PROVIDER=firebase`
  - `FIREBASE_STORAGE_BUCKET=...`

### 5. Verify backend staging

After deploy, test:

```bash
curl https://YOUR_CLOUD_RUN_URL/api/health
```

Then verify in the UI:

1. admin login
2. create session
3. generate cards
4. edit cards
5. upload document
6. generate brief from uploads
7. export docx / zip / markdown / json
8. import an exported ZIP into an existing session

### Historical alternatives

Railway, Render, and Fly.io can still host the current Express app, but they are no longer the recommended path for this repo’s Firebase handoff goal.

---

## Frontend Deployment

### Option 1: Serve from Express

The Express server already serves static files from `dist/` folder after build.

**Build steps:**
```bash
npm run build
npm start
```

### Option 2: Netlify Frontend + Separate Backend

**Build for production:**
```bash
npm run build
```

**Deploy to Netlify:**
```bash
npm i -g netlify-cli
netlify deploy --prod --dir=dist
```

**Recommended `netlify.toml` for frontend-only Netlify hosting:**
```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/api/*"
  to = "https://YOUR-BACKEND-DOMAIN.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

**Important:** If using separate static hosting, proxy `/api/*` to the backend or configure the frontend API base URL. Keep server-only keys out of Netlify browser builds.

This is appropriate for developer previews and short-term alpha hosting. It is not a full replacement for the backend in the current architecture.

### Option 3: Firebase Hosting For Client-Owned Production

Firebase Hosting can serve the same Vite `dist/` output as Netlify. This is useful when the developer wants Netlify previews during active collaboration, but the client should be able to own hosting later from the same Firebase project they use for Auth, Firestore, and Storage.

Recommended `firebase.json`:
```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

For the current hybrid alpha architecture, keep the backend outside Firebase Hosting and set `VITE_API_BASE_URL` to the backend origin at build time, for example `https://api.bbp.yourdomain.com`. This avoids coupling the frontend deploy to a Firebase Function before the backend migration is ready.

Deploy flow:
```bash
npm run build
firebase deploy --only hosting
```

Handoff notes:

- Keep both `netlify.toml` and `firebase.json` in the repo once Firebase Hosting is introduced.
- Use Netlify for developer previews if desired.
- Use Firebase Hosting for client-owned production by default when the client wants Firebase ownership from the start.
- Keep Firebase and API URLs env-driven so moving hosting providers does not require UI code changes.
- Use the checked-in `firebase.json` for SPA rewrites and keep backend routing separate until Functions or Cloud Run are intentionally introduced.

---

## Testing Multiplayer

### Local Testing

**1. Start PartyKit Dev Server:**
```bash
# Terminal 1
npm run partykit:dev

# Server starts on localhost:1999
```

**2. Start Express Backend:**
```bash
# Terminal 2
npm run dev

# Server starts on localhost:3000
```

**3. Test with Multiple Browsers:**

**Setup:**
- Browser 1: Open `http://localhost:3000/bdo-xxxx` (incognito/private mode)
- Browser 2: Open `http://localhost:3000/bdo-xxxx` (regular mode)

**Test Checklist:**

**Initial Connection:**
- [ ] Both browsers show "Connecting..." → "Connected"
- [ ] Profile prompt appears on first visit
- [ ] Active users show in top-right (2 users)

**Card Operations:**
- [ ] Create card in Browser 1 → appears in Browser 2 within 1 second
- [ ] Edit card in Browser 2 → updates in Browser 1 immediately
- [ ] Delete card in Browser 1 → removed from Browser 2
- [ ] Reorder cards in Browser 2 → order updates in Browser 1

**Connection Lines:**
- [ ] Create connection in Browser 1 → visible in Browser 2
- [ ] Delete connection in Browser 2 → removed from Browser 1

**Disconnection Handling:**
- [ ] Close Browser 1 tab → Browser 2 shows 1 active user
- [ ] Reopen Browser 1 → reconnects automatically
- [ ] Stop PartyKit server → shows "Disconnected" status
- [ ] Restart PartyKit → reconnects automatically

### Production Testing

**Before going live:**

1. **Create test session:**
   ```bash
   curl -X POST https://your-domain.com/api/sessions \
     -H "Content-Type: application/json" \
     -H "x-admin-session: your-admin-token" \
     -d '{"name":"Test Session","require_password":false}'
   ```

2. **Verify PartyKit connectivity:**
   ```bash
   wscat -c "wss://beyond-bullet-points.{username}.partykit.dev/party/session-test"
   ```

3. **Load testing (optional):**
   - Open 5+ browser tabs
   - Rapid card creation
   - Verify no performance degradation

---

## Environment Configuration

### Production `.env` File

```bash
# Required
ADMIN_PASSWORD=shazam!
AI_PROVIDER=opencode
AI_DEFAULT_MODEL=minimax-m2.5
GOOGLE_API_KEY=your_google_api_key
OPENCODE_API_KEY=your_opencode_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# PartyKit (Production)
PARTYKIT_HOST=beyond-bullet-points.{username}.partykit.dev
PARTYKIT_ADMIN_SECRET=your_partykit_admin_secret
VITE_API_BASE_URL=https://api.your-domain.com
VITE_PARTYKIT_HOST=beyond-bullet-points.{username}.partykit.dev
VITE_PARTYKIT_PARTY=main

# Firebase client config (browser-safe, used by Vite)
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Firebase Admin config (server-only, if Firebase backend adapters are enabled)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_client_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Optional
DATABASE_PATH=./data/sessions.db
FILE_STORAGE_PATH=./data/sessions
NODE_ENV=production
PORT=3000
```

### Development `.env` File

```bash
# Required
ADMIN_PASSWORD=shazam!
AI_PROVIDER=opencode
AI_DEFAULT_MODEL=minimax-m2.5
GOOGLE_API_KEY=your_google_api_key
OPENCODE_API_KEY=your_opencode_api_key
OPENROUTER_API_KEY=your_openrouter_api_key

# PartyKit (Development - defaults)
# PARTYKIT_HOST=localhost:1999
# VITE_PARTYKIT_HOST=localhost:1999
# VITE_PARTYKIT_PARTY=main

# Firebase development project or emulator-backed config
VITE_FIREBASE_API_KEY=your_dev_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_dev_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_dev_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_dev_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_dev_sender_id
VITE_FIREBASE_APP_ID=your_dev_app_id

# Optional
DATABASE_PATH=./data/sessions.db
FILE_STORAGE_PATH=./data/sessions
NODE_ENV=development
PORT=3000
```

### Netlify Environment Notes

- Netlify does not read `.env` files during production builds. Add variables in the Netlify UI or CLI.
- `VITE_*` variables are embedded into the browser bundle and must not contain secrets.
- Firebase Admin credentials, AI keys, and PartyKit admin secrets belong in the backend host or Netlify Functions runtime, not in client-side code.
- If deploying only the frontend on Netlify, configure the backend host separately and proxy `/api/*`.

---

## Monitoring & Debugging

### PartyKit Logs

**View logs in Cloudflare Dashboard:**
1. Go to Cloudflare dashboard
2. Navigate to Workers & Pages
3. Select your PartyKit project
4. View real-time logs

**Local logs:**
```bash
npm run partykit:dev
# Logs appear in terminal
```

### Express Backend Logs

**Structured logging (add to server.ts):**
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

### Health Checks

**Backend health:**
```bash
curl https://your-domain.com/api/health
```

**PartyKit health:**
```bash
curl https://beyond-bullet-points.{username}.partykit.dev/health
```

### Key Metrics to Monitor

1. **PartyKit:**
   - Active connections per room
   - Message throughput
   - Error rates

2. **Express:**
   - Response times
   - API error rates
   - Database connection health

3. **Storage:**
   - Disk usage (SQLite + files)
   - Backup success/failure

---

## Troubleshooting

### Common Issues

**1. "WebSocket connection failed"**
- **Cause:** PartyKit not running or wrong host
- **Fix:** 
  - Check PartyKit is deployed: `npm run partykit:deploy`
  - Verify PARTYKIT_HOST in .env
  - Check browser console for CORS errors

**2. "Changes not syncing between users"**
- **Cause:** Users in different PartyKit rooms
- **Fix:** 
  - Verify both users have same session ID in URL
  - Check PartyKit logs for room mismatch

**3. "Session data lost after deployment"**
- **Cause:** Volume not persisted
- **Fix:**
  - Ensure volume is mounted at correct path
  - Check data directory exists: `ls -la /app/data`

**4. "High latency in real-time updates"**
- **Cause:** User far from PartyKit edge location
- **Fix:**
  - Check PartyKit is deployed to closest region
  - Consider upgrading to paid Cloudflare plan for more regions

**5. "CORS errors in browser"**
- **Cause:** PartyKit not accepting connections from your domain
- **Fix:**
  - Add CORS headers in PartyKit server
  - Verify domain is whitelisted

### Debugging Commands

**Check WebSocket connection:**
```bash
# Install wscat
npm i -g wscat

# Connect to PartyKit room
wscat -c "wss://beyond-bullet-points.{username}.partykit.dev/party/session-test"

# Send test message
> {"type":"test","data":"hello"}
```

**Check API endpoints:**
```bash
# Get sessions
curl https://your-domain.com/api/sessions \
  -H "x-admin-session: your-token"

# Create card
curl -X POST https://your-domain.com/api/sessions/bdo-test/cards \
  -H "Content-Type: application/json" \
  -H "x-admin-session: your-token" \
  -d '{"section":"place","content":"Test card"}'
```

---

## Security Checklist

**Before deploying to production:**

- [ ] Change default admin password (`shazam!`)
- [ ] Use strong, unique passwords for all sessions
- [ ] Protect the production GitHub branch
- [ ] Require PR review and passing checks before production deploys
- [ ] Enable HTTPS (required for WebSockets)
- [ ] Set up environment variables securely (not in code)
- [ ] Configure CORS properly (restrict to your domain)
- [ ] Enable rate limiting on API endpoints
- [ ] Set up database backups
- [ ] Configure file storage backups
- [ ] Use secure session storage (HttpOnly cookies if possible)
- [ ] Add input validation for all API endpoints
- [ ] Sanitize user inputs (prevent XSS)
- [ ] If using Firebase, deploy restrictive Firestore and Storage Security Rules
- [ ] If using Firebase, verify admin role checks with custom claims or `admins/{uid}` documents
- [ ] If using Firebase, test rules in the Emulator Suite before production
- [ ] If using Firebase, keep service account credentials out of browser builds
- [ ] Set up logging and monitoring
- [ ] Configure auto-restart for services
- [ ] Test disaster recovery (restore from backup)

### Security Best Practices

**1. Admin Password:**
```bash
# Generate strong password
openssl rand -base64 32
```

**2. Session Passwords:**
- Auto-generated hex passwords are secure
- Store hashed in database (already implemented)
- Never log or expose in client-side code

**3. API Security:**
```typescript
// Add rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

**4. CORS Configuration:**
```typescript
// In PartyKit server (party/index.ts)
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-domain.com',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
```

---

## Post-Deployment Checklist

**Immediate (within 1 hour):**
- [ ] Verify application loads correctly
- [ ] Test admin login
- [ ] Create test session
- [ ] Test multiplayer with 2 browsers
- [ ] Verify exports work (DOCX, ZIP, Markdown)
- [ ] Verify exported ZIP restore works against a disposable session

**Within 24 hours:**
- [ ] Monitor error logs
- [ ] Check PartyKit connection metrics
- [ ] Verify data persistence (create session, restart server, verify data intact)
- [ ] Test backup/restore process

**Ongoing:**
- [ ] Weekly: Review logs for errors
- [ ] Weekly: Monitor disk usage
- [ ] Monthly: Update dependencies
- [ ] Monthly: Review security settings

---

## Support & Resources

**Documentation:**
- PartyKit Docs: [docs.partykit.io](https://docs.partykit.io)
- Cloudflare Workers: [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers)
- Firebase multiple environments: [firebase.google.com/docs/projects/multiprojects](https://firebase.google.com/docs/projects/multiprojects)
- Firebase Emulator Suite: [firebase.google.com/docs/emulator-suite](https://firebase.google.com/docs/emulator-suite)
- Firestore Security Rules: [firebase.google.com/docs/firestore/security/get-started](https://firebase.google.com/docs/firestore/security/get-started)
- Firebase custom claims: [firebase.google.com/docs/auth/admin/custom-claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- Netlify Functions: [docs.netlify.com/build/functions/overview](https://docs.netlify.com/build/functions/overview)
- Netlify environment variables: [docs.netlify.com/environment-variables/overview](https://docs.netlify.com/environment-variables/overview)

**Community:**
- PartyKit Discord: [discord.gg/partykit](https://discord.gg/partykit)
- Cloudflare Community: [community.cloudflare.com](https://community.cloudflare.com)

**Emergency Contacts:**
- Save this guide and TODO.md offline
- Document your specific hosting provider's support contacts
- Set up monitoring alerts

---

## Quick Reference

**Start development:**
```bash
# Terminal 1
npm run partykit:dev

# Terminal 2
npm run dev
```

**Deploy to production:**
```bash
# Build frontend
npm run build

# Deploy PartyKit
npm run partykit:deploy

# Deploy backend (platform-specific)
# Railway: railway up
# Render: git push
# Fly: fly deploy
```

**Check status:**
```bash
# Backend
curl https://your-domain.com/api/health

# PartyKit
curl https://beyond-bullet-points.{username}.partykit.dev/health
```

---

**Last Updated:** 2026-04-30
**Version:** 1.1
