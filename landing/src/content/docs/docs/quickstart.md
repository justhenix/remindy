---
title: Quickstart
description: Set up remindy once, then watch a correction made in one editor show up in another.
---

Five minutes, one terminal, then you never touch the CLI again. This is the whole
point of remindy in four steps.

## 1. Set it up once

```bash
npm install
npm run build

# Start Supermemory Local (Unix binary; run inside WSL2 on Windows)
curl -fsSL https://supermemory.ai/install | bash
supermemory-server                 # listens on http://localhost:6767

# Register the MCP server, drop the project rule, and seed rules from this repo
npx remindy init --seed
```

Reload your editor so it spawns the MCP server. Then confirm you are on the shared
store, not isolated memory:

```bash
npx remindy doctor                 # backend should read "Supermemory Local"
```

:::note
Put the `SUPERMEMORY_API_KEY` that Supermemory prints on first boot into your
`.env` (see `.env.example`). `remindy doctor` masks it and never logs the value.
:::

## 2. Just code

Ask your agent to build something. Before it writes, it calls `remindy_recall` and
pulls your seeded standards, so the first draft already avoids inline styles, slop
copy, and secrets in code.

## 3. Correct it once

When the agent slips, say it writes *"unlock a seamless experience"* in a heading,
correct it in chat. It calls `remindy_capture`, and the rule's burn count goes up so
it ranks higher next time.

```text
you: don't use words like "unlock" or "seamless", keep copy plain
-> captured  [COPY] "unlock/seamless" slop -> plain verbs (x3)
```

## 4. Switch tools, same standard

Open a different editor (Cursor to Claude to Kiro) and ask for the same kind of work.
It already respects the correction, pulled from the same on-machine store, for about
15 tokens. That cross-tool moment is the whole product.

:::caution
No Supermemory Local? remindy still runs on a per-process in-memory store, so a
single editor works, but corrections are **not shared across tools** and **do not
survive a restart**. `remindy doctor` and the dashboard badge tell you which mode
you are in.
:::
