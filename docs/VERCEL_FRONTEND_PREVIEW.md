# Vercel Frontend Preview

This began as the first approved Phase 5 Vercel slice: frontend preview hosting only.

The repo now includes a thin same-origin Vercel `/api/*` compatibility wrapper, but the live preview should still be treated as frontend-only until a preview deployment is intentionally configured with server-side provider environment variables and smoke-tested.

## Current Vercel Project

| Field | Value |
| --- | --- |
| Project slug | `sqd-bbp` |
| Requested project title | Beyond Bulletpoints Canvas x SQD |
| Team | `the-shapers-projects` |
| Live URL | `https://sqd-bbp.vercel.app` |
| Current deployment | Direct CLI deployment using browser-safe build env values |

Vercel project slugs are URL-safe; `sqd-bbp` is the slug that provides `sqd-bbp.vercel.app`. Keep "Beyond Bulletpoints Canvas x SQD" as the human-facing title in handoff material.

## Vercel Project Settings

Use these settings for the preview project:

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | Vercel default or `npm install` |

The checked-in `vercel.json` records the Vite build command, output directory, API rewrite, and SPA fallback rewrite for client-side routes.

## Preview Environment Variables

Set these as Vercel Preview environment variables in the Vercel dashboard or CLI:

| Variable | Example | Notes |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `https://bbp-backend-staging-471025386718.us-central1.run.app` | Existing backend origin for the first preview. Do not leave empty until same-origin API work is implemented. |
| `VITE_PARTYKIT_HOST` | `beyond-bullet-points.the-shaper.partykit.dev` | Existing PartyKit host used by the browser. |
| `VITE_PARTYKIT_PARTY` | `main` | Existing PartyKit party name. |

Do not add AI keys, admin passwords, Convex server URLs, or PartyKit admin secrets to the frontend-only Vercel project unless a later slice adds a server-side API runtime there.

When the same-origin compatibility API is intentionally deployed, configure these as server-side Vercel environment variables rather than browser variables:

- `DATA_STORE_PROVIDER=convex`
- `ATTACHMENT_STORE_PROVIDER=convex`
- `ADMIN_AUTH_PROVIDER=password`
- `CONVEX_URL`
- `ADMIN_PASSWORD`
- `AI_PROVIDER` and the matching server-side AI key, if AI routes will be smoke-tested
- `PARTYKIT_ADMIN_SECRET` and `PARTYKIT_HOST`, if admin PartyKit token routes will be smoke-tested

## Local Verification

Before deploying:

```bash
npm run lint
npm run build
```

Current verification:

- `https://sqd-bbp.vercel.app` returns HTTP 200.
- `https://sqd-bbp.vercel.app/login` returns the SPA shell.
- The deployed bundle includes the configured staging backend origin and PartyKit host.
- The deployed bundle does not include server-only AI key names.
- `https://bbp-backend-staging-471025386718.us-central1.run.app/api/health` returns `{"status":"ok"}`.
- `npm run smoke:provider-api` against the staging backend currently fails because session reads do not include the newer `notes` array. This means the frontend preview is live, but the configured backend origin is stale relative to this migration branch.
- Treat the current Cloud Run backend origin as a legacy compatibility bridge only. The migration target remains Vercel + Convex, with Convex Storage for uploaded source documents.
- Do not make `gcloud`/Cloud Run redeploy the recommended next path unless a human explicitly approves a temporary emergency bridge.

After Vercel creates a preview URL:

1. Open the preview URL.
2. Log in as admin against the backend configured by `VITE_API_BASE_URL`.
3. Open or create a test session.
4. Verify PartyKit presence connects through `VITE_PARTYKIT_HOST`.
5. Run backend smokes against the backend origin, not the Vercel frontend URL:

```bash
API_BASE_URL=<backend-origin> ADMIN_PASSWORD=<admin-password> npm run smoke:provider-api
API_BASE_URL=<backend-origin> ADMIN_PASSWORD=<admin-password> SMOKE_DIRECT_ATTACHMENT_UPLOAD=1 npm run smoke:attachments-api
API_BASE_URL=<backend-origin> ADMIN_PASSWORD=<admin-password> SMOKE_DIRECT_ATTACHMENT_UPLOAD=1 npm run smoke:brief-from-uploads
API_BASE_URL=<backend-origin> ADMIN_PASSWORD=<admin-password> SMOKE_DIRECT_ATTACHMENT_UPLOAD=1 npm run smoke:exports-api
```

## Deferred

- Deploying and smoke-testing same-origin `/api/*` on Vercel.
- Serverless-clean Convex provider imports.
- Admin session persistence outside SQLite.
- Production Vercel deployment.
- Extraction runtime decision.
