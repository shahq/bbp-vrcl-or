# SQD Handoff Guide 3: Session 2 Codex Prompt

Use this in the second client call/session, after local setup works.

Session 2 is for:

- Client-owned accounts.
- Environment variables.
- Deployment.
- Smoke testing.

Do not start Session 2 until Session 1 has succeeded.

Session 1 success means:

- The repo is cloned on the client's computer.
- `npm install` has completed.
- The local app can open at `http://localhost:3000/login`.
- The client knows where the project folder is.

Copy the full prompt below, paste it into a new Codex thread, and replace the bracketed placeholders before sending.

```text
I need help with Session 2 of a project handoff: accounts, environment variables, deployment, and smoke testing.

Session 1 is complete:
- The GitHub repo is cloned on my computer.
- Dependencies were installed with `npm install`.
- The local app opened at `http://localhost:3000/login`.

Project context:
- Project name: Beyond Bullet Points / SQD handoff
- Local project folder: [PASTE_LOCAL_PROJECT_FOLDER_PATH_HERE]
- GitHub repository URL: [PASTE_REPOSITORY_URL_HERE]
- I am the client taking ownership of this project.
- The original developer's Vercel, Convex, PartyKit, and AI-provider accounts should not be treated as mine.

My Session 2 goal:
- Create or connect my own service accounts.
- Collect the required environment variable names.
- Configure deployment safely.
- Deploy only after I explicitly approve.
- Smoke-test the deployed app.

Please work in this order:

1. Open or inspect the local project folder.
2. Read these files before making deployment decisions:
   - `README.md`
   - `sqd handoff guide/02-owner-setup-and-deployment.md`
   - `docs/CONVEX_LOCAL_SETUP.md`
   - `docs/VERCEL_PHASE5_COMPATIBILITY_PLAN.md`
   - `docs/VERCEL_FRONTEND_PREVIEW.md`
   - `vercel.json`
   - `partykit.json`
3. Confirm that `npm run lint` and `npm run build` still pass locally.
4. Help me create or confirm access to these client-owned accounts:
   - GitHub repo access or ownership
   - Vercel account or team
   - Convex account or team
   - PartyKit account/project
   - One AI provider account/API key
5. Keep an environment-variable checklist.
6. Do not ask me to paste secrets directly into chat. Tell me where to enter secrets in provider dashboards or local secret files.
7. Do not change code unless a deployment blocker requires it. If code changes seem necessary, explain why and ask before editing.
8. Do not remove SQLite/local fallback code.
9. Do not remove old Firebase or Cloud Run files.
10. Do not change `/api/*` request or response behavior.
11. Do not deploy until I explicitly confirm the accounts and env vars are ready.

Deployment target:
- Vercel hosts the app and compatibility API.
- Convex stores durable app data and uploaded source files.
- PartyKit handles realtime collaboration.
- AI provider keys stay server-side.

Use these Vercel server/runtime environment variables as the starting checklist:
- `DATA_STORE_PROVIDER=convex`
- `ATTACHMENT_STORE_PROVIDER=convex`
- `ADMIN_AUTH_PROVIDER=stateless`
- `SESSION_FILE_STORE_PROVIDER=none`
- `CONVEX_URL`
- `ADMIN_PASSWORD`
- `ADMIN_SESSION_SECRET`
- `PARTYKIT_ADMIN_SECRET`
- `PARTYKIT_HOST`
- `APP_URL`
- `AI_PROVIDER`
- `AI_DEFAULT_MODEL`
- one matching AI key, such as `OPENCODE_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_API_KEY`

Use these Vercel browser-safe environment variables:
- `VITE_PARTYKIT_HOST`
- `VITE_PARTYKIT_PARTY=main`

Leave `VITE_API_BASE_URL` unset unless we intentionally use a separate backend host.

Important risk:
- Document extraction is still the main unresolved serverless concern. Before production handoff, help me test upload, extraction, brief generation, and export flows with real documents.

After deployment, help me smoke-test:
1. Open deployed URL.
2. Log in at `/login`.
3. Create a test session.
4. Open participant session URL in another browser/private window.
5. Verify PartyKit presence/cursors connect.
6. Complete project brief flow.
7. Generate Act I cards.
8. Edit and connect cards.
9. Use shared notes.
10. Export a session.
11. Upload a source document and test the expected document workflow.
12. Run available smoke scripts against the deployed URL when appropriate.

At the end, summarize:
- Which accounts are now client-owned.
- Which env vars were configured and where.
- What deployed URL was tested.
- Which smoke checks passed.
- Which risks or follow-ups remain.
```

## What This Prompt Is For

This prompt keeps the second session focused on ownership, environment variables, deployment, and verification.

It should prevent Codex from jumping into code changes or deployment before the client has confirmed the needed accounts and secrets.

## Use With The Reference Guide

Keep [02-owner-setup-and-deployment.md](02-owner-setup-and-deployment.md) open during Session 2. That file contains the longer explanation and command reference.
