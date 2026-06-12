# SQD Handoff Guide 1: GitHub Access And Terminal Clone

This guide explains how to get access to the code and clone it onto your computer with Terminal commands.

If you are using the Codex app, start with [00-paste-this-into-codex.md](00-paste-this-into-codex.md). That is the preferred first path because Codex can help run the Terminal checks and setup steps with you.

This guide belongs to Session 1: local setup only.

Session 1 should stop when the repo is cloned, dependencies are installed, and the local app can open. Account ownership, environment variables for hosting, and deployment belong in Session 2.

Use this guide if:

- You want to understand what Codex is doing.
- Codex asks you to run a command manually.
- You are cloning the repo yourself without GitHub Desktop.

## Plain-English Vocabulary

- **GitHub**: The website where the project code is stored.
- **Repository** or **repo**: The project folder on GitHub.
- **Clone**: Download a working copy of the repo to your computer.
- **Local copy**: The copy of the project that lives on your computer.
- **Branch**: A version line of the project. For this handoff, use the default branch unless the developer tells you otherwise.
- **Terminal**: A text-based app used to run setup commands.
- **Command**: A line of text you paste into Terminal and run by pressing Enter.

## Important Before You Clone

Cloning the GitHub repo copies the code only.

It does not copy:

- The current Vercel account.
- The current Convex account.
- The current PartyKit account.
- AI provider API keys.
- Production passwords or secrets.
- Existing deployed data.

Those services live outside GitHub. They are currently tied to the original developer's accounts unless they are transferred or recreated under your own accounts.

The normal handoff path is:

1. Get access to the GitHub repo.
2. Clone the repo to your computer.
3. Run the app locally.
4. Create your own Vercel, Convex, PartyKit, and AI provider accounts.
5. Configure those accounts with your own environment variables and secrets.
6. Deploy your own copy.

The Session 2 account/deployment guide is in [02-owner-setup-and-deployment.md](02-owner-setup-and-deployment.md).

## What You Need

- A GitHub account.
- Access to the repository.
- Terminal access on your computer.
- Git installed.
- Node.js and npm installed before running the app.

Current repo URL at the time this guide was written:

```text
https://github.com/the-shaper/bbp-vrcl-or
```

If the project owner transfers the repo to your organization later, the URL may change. Use the URL the project owner gives you.

## Step 1: Create Or Sign In To GitHub

1. Go to [https://github.com](https://github.com).
2. Create an account, or sign in if you already have one.
3. Tell the project owner your GitHub username or the email connected to your GitHub account.

## Step 2: Get Access To The Repository

The project owner has two common options:

- **Add you as a collaborator**: You can access the repo, but the repo still belongs to the original owner.
- **Transfer the repository to your GitHub account or organization**: You become the owner of the repo.

For a real client handoff, repository transfer is usually cleaner than staying as a collaborator forever.

You know you have access when you can open the repo URL in your browser and see the project files.

## Step 3: Open Terminal

On Mac:

1. Open Spotlight with Command + Space.
2. Type `Terminal`.
3. Press Enter.

On Windows:

1. Open the Start menu.
2. Search for `PowerShell` or `Terminal`.
3. Open it.

## Step 4: Check Git

Run:

```bash
git --version
```

If Git is installed, Terminal prints a version number.

If Git is missing:

- On Mac, run `xcode-select --install` and follow the prompt.
- On Windows, install Git from [https://git-scm.com](https://git-scm.com).

## Step 5: Choose A Folder For Projects

This example uses:

```text
Documents/Projects
```

On Mac or Linux, run:

```bash
mkdir -p ~/Documents/Projects
cd ~/Documents/Projects
```

On Windows PowerShell, run:

```powershell
mkdir "$HOME\Documents\Projects"
cd "$HOME\Documents\Projects"
```

If the folder already exists, that is fine.

## Step 6: Clone The Repository

Run this command, replacing the URL if the project has been transferred:

```bash
git clone https://github.com/the-shaper/bbp-vrcl-or.git
```

If GitHub asks you to sign in, follow the prompt.

If you see an error such as `Repository not found` or `Permission denied`, you probably do not have access yet. Ask the project owner to add your GitHub account or transfer the repo.

## Step 7: Enter The Project Folder

Run:

```bash
cd bbp-vrcl-or
```

Then run:

```bash
ls
```

On Windows PowerShell, you can also use:

```powershell
dir
```

You should see files such as:

```text
README.md
package.json
src/
docs/
convex/
vercel.json
```

That means the clone worked.

## Step 8: Check Node.js And npm

Run:

```bash
node --version
npm --version
```

If both commands print version numbers, continue.

If either command is missing, install Node.js from:

[https://nodejs.org](https://nodejs.org)

Use the LTS version unless a developer tells you otherwise.

## Step 9: Install Project Dependencies

From inside the project folder, run:

```bash
npm install
```

This downloads the code libraries the project needs.

## Step 10: Do Not Add Secrets To GitHub

Do not paste passwords, API keys, or account secrets into files and commit them.

Files like `.env.local` are for private local settings. They should stay on your computer and should not be uploaded to GitHub.

If a developer gives you secrets, store them in a password manager and in the relevant hosting dashboard, not in a committed repo file.

## Step 11: What Comes Next

After cloning, installing dependencies, and proving the app opens locally, schedule Session 2:

[02-owner-setup-and-deployment.md](02-owner-setup-and-deployment.md)

That guide explains:

- How to run the app locally.
- Which accounts you need.
- What currently belongs to the original developer.
- How to prepare your own Vercel, Convex, PartyKit, and AI provider setup.
- What to configure before deploying your own copy.

## Official References

- GitHub cloning docs: [https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository)
- Git install downloads: [https://git-scm.com](https://git-scm.com)
