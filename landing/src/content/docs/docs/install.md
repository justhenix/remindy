---
title: Install & setup
description: Install Supermemory Local, initialise remindy in your project, and reload your editor.
---

remindy is not a CLI you keep running. After `init` it lives inside your editor as an
MCP server. The CLI is only for setup, seeding, and the dashboard.

It's published on [npm](https://www.npmjs.com/package/remindy), so every `npx remindy` command below works with no clone.

## 1. Start Supermemory Local

Supermemory Local is the shared, on-machine store. It is a Unix binary; on Windows,
run it inside WSL2.

```bash
curl -fsSL https://supermemory.ai/install | bash
supermemory-server                 # listens on http://localhost:6767
```

Copy the API key it prints on first boot into your `.env` as `SUPERMEMORY_API_KEY`.

:::tip[Why it's load-bearing]
Each editor spawns its own remindy process. A shared external store is the only thing
that lets a correction made in one tool show up in another, and the only thing that
survives an editor restart. Nothing leaves your machine.
:::

## 2. Initialise remindy in your project

```bash
npx remindy init --seed
```

This does three things:

- Registers the remindy MCP server in every detected editor (Kiro, Cursor, Windsurf, Antigravity).
- Appends a one-line project rule to your agent rules file (`AGENTS.md`, `CLAUDE.md`, or `.cursorrules`).
- Seeds standards inferred from your repo, so recall is useful immediately (`--seed`).

## 3. Reload your editor

Your editor spawns the MCP server on reload. That's it, now just code with your agent.

## Verify

```bash
npx remindy doctor
```

`doctor` checks everything in one shot:

- resolved config (secrets masked)
- one real compression
- Supermemory Local probe + active backend

Anything other than Supermemory Local means cross-tool sharing and persistence are **off**: fix it before you rely on shared memory.

## Setup for reviewers

If you are running from a clone rather than `npx`:

```bash
npm install
npm run build
node dist/bin/remindy.js doctor
node dist/bin/remindy.js init --seed
```

## Uninstall

```bash
npx remindy uninstall
```

This reverses `init` in every detected editor:

- Removes the `remindy` entry from the MCP config (`.kiro/settings/mcp.json`, `.cursor/mcp.json`, `.windsurf/mcp.json`, or `.agents/mcp_config.json`).
- Strips the rule block between `<!-- remindy -->` and `<!-- /remindy -->` from `AGENTS.md`, `CLAUDE.md`, or `.cursorrules`.

Then reload your editor. Your stored standards stay in Supermemory Local; clear them from the [dashboard](/docs/dashboard/) for a clean slate, or run `npm rm -g remindy` if you installed globally.
