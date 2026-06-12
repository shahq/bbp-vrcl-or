# SQD Handoff Guide 0: Session 1 Codex Prompt

This is the first thing to give the client if they are using the Codex app.

Session 1 is only for local setup. The goal is:

> Clone the repo, install dependencies, and open the app locally.

Do not use Session 1 for Vercel, Convex, PartyKit production setup, AI-provider keys, production environment variables, domains, or deployment. Those belong in Session 2.

Copy the full prompt below, paste it into a new Codex thread, and replace the bracketed placeholders before sending.

Before starting, make sure the GitHub account you use has access to the repo. If the repo is private and your GitHub account has not been added yet, Codex will not be able to clone it.

```text
I need help with Session 1 of a project handoff: local setup only.

Project context:
- Project name: Beyond Bullet Points / SQD handoff
- GitHub repository URL: [PASTE_REPOSITORY_URL_HERE]
- I want to clone the repo using Terminal commands, not GitHub Desktop.
- I am the client taking ownership of this project.
- The original developer's Vercel, Convex, PartyKit, and AI-provider accounts should not be treated as mine.
- My Session 1 goal is only to clone the repo, install dependencies, and run the app locally.
- Do not help me configure Vercel, Convex production, PartyKit production, AI-provider keys, domains, or deployment in this session.
- At the end, give me a short checklist of what to prepare for Session 2: accounts and environment variables.
- Do not deploy anything until I explicitly approve it.
- Do not push commits, change branches, or alter remote Git settings unless I explicitly approve it.
- Do not ask me to paste secrets directly into chat. If secrets are needed, tell me where to put them in local files or provider dashboards.
- If you cannot access my Terminal, filesystem, or browser, tell me exactly what permission or manual step is needed.

Please work in this order:

1. Check whether Git, Node.js, and npm are installed on my computer.
2. If anything is missing, explain the simplest installation step and pause for me to complete it.
3. Ask me where I want the project folder to live, or suggest a safe default such as `~/Documents/Projects`.
4. Clone the GitHub repository using `git clone` in Terminal.
5. Enter the project folder and inspect the repo files.
6. Read these files before making setup decisions:
   - `README.md`
   - `sqd handoff guide/01-start-here-github-and-clone.md`
   - `sqd handoff guide/02-owner-setup-and-deployment.md`
   - `docs/CONVEX_LOCAL_SETUP.md`
   - `docs/VERCEL_PHASE5_COMPATIBILITY_PLAN.md`
7. Install dependencies with `npm install`.
8. Create a local `.env.local` file for local development only, using safe placeholder values and no production secrets.
9. Start PartyKit locally in one terminal with `npm run partykit:dev`.
10. Start the app locally in another terminal with `npm run dev`.
11. Help me open `http://localhost:3000/login`.
12. Run `npm run lint` and `npm run build` after the local setup is working.
13. Stop and summarize what worked, what failed, and what accounts/environment variables I should prepare for Session 2.

Important project facts:

- The active target is Vercel + Convex + PartyKit.
- SQLite and local file storage are still intentional local fallbacks.
- Do not remove SQLite/local fallback code.
- Do not remove old Firebase or Cloud Run files.
- Do not change `/api/*` request or response behavior.
- Document extraction is still the main unresolved serverless concern, so upload/extraction/deploy behavior needs real smoke testing before production.
- Vercel, Convex, PartyKit, and AI keys must eventually be created under my own account or team.

If you hit an access problem with GitHub, stop and tell me exactly what access I need from the original project owner.

If you need to make a choice, choose the safest local-only setup path first.
```

## What This Prompt Is For

This prompt is designed to let Codex act like the setup assistant.

The client should not need to understand every Terminal command before starting. Codex should inspect the computer, clone the repo, run setup commands, and pause when human account access or secrets are needed.

The success condition is simple: the local app opens at `http://localhost:3000/login`.

## What This Prompt Does Not Do

It does not transfer ownership of external accounts.

The client still needs their own:

- GitHub access.
- Vercel account or team.
- Convex account or team.
- PartyKit account/project.
- AI provider key.

Those steps are covered in Session 2: [02-owner-setup-and-deployment.md](02-owner-setup-and-deployment.md).

## When To Use The Other Guides

- Use [01-start-here-github-and-clone.md](01-start-here-github-and-clone.md) if Codex asks the client to run clone commands manually.
- Use [02-owner-setup-and-deployment.md](02-owner-setup-and-deployment.md) in a second call/session after the local clone works and the client is ready to set up their own service accounts and environment variables.
