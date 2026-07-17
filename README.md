# remindy

The portable taste & standards layer for AI coding agents. Teach any MCP-compatible
agent how you want code written once; it stops violating your standards, in every
tool, for about 15 tokens a turn.

Linters catch syntax. remindy catches taste: AI-slop UI and copy, non-conventional
commits, DRY/YAGNI violations, security foot-guns, and building things you didn't ask
for. It feeds those standards to your agent before it writes.

## How you actually use it

remindy is not a CLI you keep running. It is an MCP server your editor spawns for you.

1. `npx remindy init --seed`: registers the remindy MCP server in your editor's
   config, drops a one-line project rule, and seeds standards inferred from THIS repo.
2. Reload your editor so it picks up the MCP server.
3. Just code with your agent. It calls `remindy_recall` before writing, and
   `remindy_capture` when you correct it.
4. `npx remindy dashboard`: a local web UI to view, edit, and stress-test your rules.

## The loop

`remindy_recall(task_context)` returns a tiny block of known standards to avoid,
ranked by relevance × burn count and trimmed to a ~100 token budget.
`remindy_capture(mistake, tag?)` compresses a correction into a caveman rule, dedups
against existing rules, and either inserts a new rule or increments its burn count.

Caveman rule format: `[TAG] anti-pattern → fix (×N)` where
`TAG ∈ {UI, COPY, CODE, COMMIT, SEC, REQ, PERF}`.

## What runs where (honest architecture)

- **Supermemory Local** is the shared, on-machine store at `http://localhost:6767`.
  It is load-bearing: because each editor spawns its own remindy process, a shared
  external store is the only thing that lets a correction made in one tool show up in
  another, and the only thing that survives an editor restart. Nothing leaves the
  machine.
- **Ranking is local.** Supermemory Local's self-hosted vector search (v0.0.5)
  returns nothing, so remindy lists rules via `documents.list` and ranks them with a
  deterministic keyword scorer. Supermemory = storage; remindy = ranking.
- **Compression** at capture time uses an OpenAI-compatible model (b.ai cloud or local
  Ollama), chosen by config. Repo inference is deterministic; the model only polishes
  wording and never blocks a seed.

If Supermemory Local is not configured, remindy falls back to a per-process in-memory
store. That mode is useful for local dev but is **not shared across tools and not
persistent**. `remindy doctor` and the dashboard badge say so plainly.

## Repo taste inference

`remindy seed` scans the repository and infers one standard per tag from real signals:
inline styles vs design tokens (UI), AI-slop words in copy (COPY), tsconfig/React
patterns (CODE), hardcoded secrets and `.env` coverage (SEC), conventional-commit
adherence in the git log (COMMIT), and spec/requirements presence (REQ). Where a signal
is absent, the curated starter pack fills the gap, so recall is useful on the first run.

## Setup for reviewers

```bash
npm install
npm run build
# Start Supermemory Local (Unix binary; use WSL2 on Windows):
curl -fsSL https://supermemory.ai/install | bash
# Put SUPERMEMORY_API_KEY (printed on first boot) and your b.ai keys in .env (see .env.example)
node dist/bin/remindy.js doctor    # verify: all checks PASS, backend = Supermemory Local
node dist/bin/remindy.js init --seed
```

## Build & test

```bash
npm install     # no external services required for tests
npm run build   # tsc -> dist/
npm test        # vitest run (single pass)
```
