# SQD Handoff Guide 2: Session 2 Accounts, Environment Variables, And Deployment

This guide explains how to set up this project under the client's own accounts after local setup works.

Do not start here unless Session 1 has already succeeded.

Session 1 success means:

- The repo is cloned on the client's computer.
- `npm install` has completed.
- The local PartyKit dev server can start.
- The local app can open at `http://localhost:3000/login`.

For Session 1 in Codex, start with:

[00-paste-this-into-codex.md](00-paste-this-into-codex.md)

That document gives Codex a setup prompt it can follow as an assistant.

For Session 1 manual cloning, start with:

[01-start-here-github-and-clone.md](01-start-here-github-and-clone.md)

Session 2 is for accounts, environment variables, deployment, and smoke testing.

If the client is using Codex for Session 2, start with:

[03-session-2-paste-this-into-codex.md](03-session-2-paste-this-into-codex.md)

This file is the longer reference guide for the same session.

## The Big Idea

The GitHub repo contains the code.

The live app also depends on outside services:

- **Vercel**: Hosts the website and compatibility API.
- **Convex**: Stores durable sessions, cards, connections, notes, attachment metadata, and uploaded source files.
- **PartyKit**: Runs realtime collaboration, cursors, live card sync, and the shared timer.
- **AI provider**: Generates project briefs, cards, and chat responses.

At the time of handoff, those services may still be connected to the original developer's personal accounts. The repo alone does not transfer them.

For a clean handoff, the client should own or control each account.

## Recommended Handoff Order

1. Transfer or grant access to the GitHub repo.
2. Paste [00-paste-this-into-codex.md](00-paste-this-into-codex.md) into Codex, or clone manually with [01-start-here-github-and-clone.md](01-start-here-github-and-clone.md).
3. Run the app locally with SQLite/local-file fallback.
4. Create the client's Vercel account or team.
5. Create the client's Convex account or team.
6. Create or transfer the client's PartyKit account/project.
7. Choose the AI provider account and API key.
8. Deploy PartyKit.
9. Deploy Convex functions/data schema.
10. Deploy the Vercel app.
11. Run smoke checks before calling it production-ready.

## What Should Be Owned By The Client

| Service | What it does | Recommended ownership |
| --- | --- | --- |
| GitHub | Stores the code | Client-owned repo or client organization |
| Vercel | Hosts the app and `/api/*` routes | Client-owned Vercel account or team |
| Convex | Durable app data and file storage | Client-owned Convex account or team |
| PartyKit | Realtime collaboration | Client-owned PartyKit account/project |
| AI provider | AI generation and chat | Client-owned API key |
| Domain/DNS | Public website address | Client-owned domain account |

Avoid running a client production app long-term from the original developer's personal accounts.

## Current Technical Direction

The active target is Vercel + Convex + PartyKit.

This project still keeps SQLite and local file storage as local fallback options. Do not remove those fallbacks yet. They are useful for local testing and recovery.

The old Firebase and Cloud Run files are historical or fallback context. They should not be treated as the active deployment direction unless the project owner explicitly decides to reactivate that path.

The current deployment path is not a full rewrite. The frontend still calls existing `/api/*` routes. Vercel has a compatibility API wrapper so those routes can keep working while persistence moves to Convex.

## Known Migration Note

Document extraction is still the main unresolved serverless concern.

The app can store uploaded source files in Convex Storage, but the existing extraction path still uses a server-side extraction script. Before promising production-grade upload-to-brief behavior on Vercel, test the upload, extraction, brief generation, and export flows with real documents.

Do not add Railway or any other paid infrastructure assumption unless the client approves it.

## Local Setup On Your Computer

### 1. Install Node.js

Install Node.js 18 or newer.

If you are not sure which version to use, install the current LTS version from:

[https://nodejs.org](https://nodejs.org)

### 2. Install Dependencies

Open Terminal inside the cloned project folder and run:

```bash
npm install
```

### 3. Create `.env.local`

Create a file named `.env.local` in the project root.

For local fallback mode, start with:

```bash
AI_PROVIDER=opencode
AI_DEFAULT_MODEL=minimax-m3

DATA_STORE_PROVIDER=sqlite
ATTACHMENT_STORE_PROVIDER=local
ADMIN_AUTH_PROVIDER=password
ADMIN_PASSWORD=shazam!

PARTYKIT_HOST=localhost:1999
PARTYKIT_ADMIN_SECRET=shazam!
VITE_PARTYKIT_HOST=localhost:1999
VITE_PARTYKIT_PARTY=main
```

If you have an AI provider key, add one of these:

```bash
OPENCODE_API_KEY=
OPENROUTER_API_KEY=
GOOGLE_API_KEY=
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
CLAUDE_API_KEY=
```

You only need one working provider key to test AI generation.

Do not commit `.env.local` to GitHub.

### 4. Run PartyKit Locally

In Terminal 1:

```bash
npm run partykit:dev
```

Leave this running.

### 5. Run The App Locally

In Terminal 2:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/login
```

Use the local admin password from `.env.local`.

Default example:

```text
shazam!
```

### 6. Local Checks

Run these before deploying:

```bash
npm run lint
npm run build
```

Optional API smoke checks:

```bash
API_BASE_URL=http://localhost:3000 ADMIN_PASSWORD=shazam! npm run smoke:provider-api
API_BASE_URL=http://localhost:3000 ADMIN_PASSWORD=shazam! npm run smoke:attachments-api
API_BASE_URL=http://localhost:3000 ADMIN_PASSWORD=shazam! npm run smoke:exports-api
```

## Create The Client's Convex Account

1. Go to [https://convex.dev](https://convex.dev).
2. Create an account or sign in.
3. Create a team or project owned by the client.
4. From the project folder, run:

```bash
npm run convex:dev
```

The Convex CLI will guide you through linking the codebase to a Convex project.

For production deployment, the technical maintainer can deploy Convex functions with:

```bash
npx convex deploy
```

After deployment, copy the Convex deployment URL. It will look similar to:

```text
https://your-project-name.convex.cloud
```

This becomes the Vercel environment variable:

```bash
CONVEX_URL=https://your-project-name.convex.cloud
```

## Create The Client's PartyKit Project

PartyKit must be deployed separately from Vercel.

From the project folder:

```bash
npm run partykit:deploy
```

The first time, PartyKit may ask you to log in with GitHub.

When deployment finishes, PartyKit gives you a host like:

```text
beyond-bullet-points.your-github-username.partykit.dev
```

Save that value. Use it without `https://` in the app environment variables:

```bash
PARTYKIT_HOST=beyond-bullet-points.your-github-username.partykit.dev
VITE_PARTYKIT_HOST=beyond-bullet-points.your-github-username.partykit.dev
VITE_PARTYKIT_PARTY=main
```

PartyKit and Vercel must share the same admin secret for protected admin/timer actions:

```bash
PARTYKIT_ADMIN_SECRET=<long-random-secret>
```

Set that value in PartyKit and in Vercel.

If using the PartyKit CLI, the technical maintainer can manage PartyKit environment variables with the `partykit env` commands documented by PartyKit.

## Create The Client's Vercel Account

1. Go to [https://vercel.com](https://vercel.com).
2. Create an account or sign in.
3. Connect Vercel to the client's GitHub account.
4. Click **New Project**.
5. Import the GitHub repo.
6. Use the Vite framework preset.

Project settings for this repo:

```text
Framework preset: Vite
Build command: node scripts/build-vercel-api.mjs && npm run build
Output directory: dist
Install command: npm install
```

The repo also has `vercel.json`, which records the Vercel app/API wrapper setup.

## Vercel Environment Variables

In Vercel, go to:

```text
Project Settings -> Environment Variables
```

For the client-owned Vercel deployment, set these.

### Server/runtime values

```bash
DATA_STORE_PROVIDER=convex
ATTACHMENT_STORE_PROVIDER=convex
ADMIN_AUTH_PROVIDER=stateless
SESSION_FILE_STORE_PROVIDER=none
CONVEX_URL=<client-convex-url>
ADMIN_PASSWORD=<client-admin-password>
ADMIN_SESSION_SECRET=<long-random-secret>
PARTYKIT_ADMIN_SECRET=<same-secret-used-in-partykit>
PARTYKIT_HOST=<client-partykit-host-without-https>
APP_URL=<client-vercel-or-custom-domain-url>
```

### Browser-safe values

```bash
VITE_PARTYKIT_HOST=<client-partykit-host-without-https>
VITE_PARTYKIT_PARTY=main
```

Leave this unset for same-origin Vercel API mode:

```bash
VITE_API_BASE_URL
```

Set `VITE_API_BASE_URL` only if the frontend is intentionally calling a separate backend host.

### AI values

Choose one provider path.

Opencode example:

```bash
AI_PROVIDER=opencode
AI_DEFAULT_MODEL=minimax-m3
OPENCODE_API_KEY=<client-opencode-key>
```

OpenRouter example:

```bash
AI_PROVIDER=openrouter
AI_DEFAULT_MODEL=openrouter/auto
OPENROUTER_API_KEY=<client-openrouter-key>
```

OpenAI example:

```bash
AI_PROVIDER=openai
AI_DEFAULT_MODEL=gpt-4o-mini
OPENAI_API_KEY=<client-openai-key>
```

Anthropic example:

```bash
AI_PROVIDER=anthropic
AI_DEFAULT_MODEL=claude-3-5-haiku-latest
ANTHROPIC_API_KEY=<client-anthropic-key>
```

Google/Gemini example:

```bash
AI_PROVIDER=google
AI_DEFAULT_MODEL=gemini-3.1-pro-preview
GOOGLE_API_KEY=<client-google-key>
```

Do not put AI keys in browser variables. AI keys belong in server-side Vercel environment variables only.

## Deploy To Vercel

After the environment variables are set:

1. In Vercel, click **Deploy**.
2. Wait for the build to finish.
3. Open the Vercel URL.
4. Test `/login`.
5. Log in with the client admin password.

Vercel should publish a URL similar to:

```text
https://your-project-name.vercel.app
```

After the URL exists, update:

```bash
APP_URL=https://your-project-name.vercel.app
```

Then redeploy so the app sees the final URL.

## Optional: Automate Convex Deploys From Vercel

The first deployment can be done manually: deploy Convex, copy `CONVEX_URL`, then deploy Vercel.

Later, a technical maintainer can automate Convex deployment from Vercel with a Convex deploy key.

The generic Convex/Vercel pattern is:

```bash
npx convex deploy --cmd 'npm run build'
```

For this repo, the build command must also build the Vercel API bundle, so use:

```bash
npx convex deploy --cmd 'node scripts/build-vercel-api.mjs && npm run build'
```

This requires a `CONVEX_DEPLOY_KEY` in Vercel. Use the Convex dashboard to generate the key, then save it in Vercel Environment Variables.

## Post-Deploy Smoke Checks

After deploying, test these as a real user:

1. Open the Vercel URL.
2. Go to `/login`.
3. Log in as admin.
4. Create a test session.
5. Open the participant session URL in another browser or private window.
6. Confirm PartyKit presence/cursors connect.
7. Complete the project brief flow.
8. Generate Act I cards.
9. Edit and connect cards.
10. Use the shared notes panel.
11. Export a session.
12. Upload a source document and verify the exact document workflow expected for launch.

Technical smoke commands can also be run against the deployed URL:

```bash
API_BASE_URL=https://your-project-name.vercel.app ADMIN_PASSWORD=<client-admin-password> npm run smoke:provider-api
API_BASE_URL=https://your-project-name.vercel.app ADMIN_PASSWORD=<client-admin-password> SMOKE_DIRECT_ATTACHMENT_UPLOAD=1 npm run smoke:attachments-api
API_BASE_URL=https://your-project-name.vercel.app ADMIN_PASSWORD=<client-admin-password> SMOKE_DIRECT_ATTACHMENT_UPLOAD=1 npm run smoke:exports-api
```

Only run the live AI smoke after an AI key is configured:

```bash
API_BASE_URL=https://your-project-name.vercel.app ADMIN_PASSWORD=<client-admin-password> SMOKE_AI_LIVE=1 npm run smoke:ai-api
```

## What Not To Do Without Approval

- Do not delete SQLite/local fallback code yet.
- Do not delete old Firebase or Cloud Run files just because they are not the active direction.
- Do not remove PartyKit until another realtime solution is designed and tested.
- Do not change `/api/*` request or response shapes without checking the frontend.
- Do not commit `.env.local`, API keys, admin passwords, deploy keys, or account secrets.
- Do not add Railway or new paid infrastructure without explicit client approval.

## Original Developer Account Cleanup

After the client deployment is verified:

1. Confirm the client can access GitHub, Vercel, Convex, PartyKit, and the AI provider.
2. Confirm the client Vercel URL works.
3. Confirm the client Convex deployment stores new sessions.
4. Confirm the client PartyKit host is used by the browser.
5. Confirm the original developer's Vercel, Convex, PartyKit, and AI keys are no longer needed for the client site.
6. Remove old developer-owned environment variables from any client-owned deployment.
7. Decide whether to shut down or keep the old developer-owned preview as a temporary backup.

Do not shut down the old deployment until the client-owned deployment has passed smoke testing.

## Official References

- Vercel Git deployments: [https://vercel.com/docs/git](https://vercel.com/docs/git)
- Vercel environment variables: [https://vercel.com/docs/environment-variables](https://vercel.com/docs/environment-variables)
- Convex with Vercel: [https://docs.convex.dev/production/hosting/vercel](https://docs.convex.dev/production/hosting/vercel)
- Convex environment variables: [https://docs.convex.dev/production/environment-variables](https://docs.convex.dev/production/environment-variables)
- Convex production deployments: [https://docs.convex.dev/production](https://docs.convex.dev/production)
- PartyKit deployment: [https://docs.partykit.io/guides/deploying-your-partykit-server/](https://docs.partykit.io/guides/deploying-your-partykit-server/)
