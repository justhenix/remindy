<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="misc/dark_banner.svg">
  <img alt="remindy" src="misc/white_banner.svg" width="600">
</picture>

### The portable taste &amp; standards layer for AI coding agents

Teach any MCP agent how you want code written **once**.<br/>
It stops breaking your standards, in every tool, for **~15 tokens a turn**.

[![Docs](https://img.shields.io/badge/docs-remindy.henix.my.id-4ADE80?style=flat-square&labelColor=0C0C0C)](https://remindy.henix.my.id/docs)
[![Built on Supermemory Local](https://img.shields.io/badge/built_on-Supermemory_Local-6D5BD0?style=flat-square&labelColor=0C0C0C)](https://supermemory.ai)
[![Protocol MCP](https://img.shields.io/badge/protocol-MCP-2F6FB0?style=flat-square&labelColor=0C0C0C)](https://modelcontextprotocol.io)
[![Runs local-first](https://img.shields.io/badge/runs-local--first-3D7A45?style=flat-square&labelColor=0C0C0C)](https://remindy.henix.my.id/docs)
[![License MIT](https://img.shields.io/badge/license-MIT-B7791F?style=flat-square&labelColor=0C0C0C)](LICENSE)

</div>

---

**Linters catch syntax. remindy catches taste**: AI-slop copy, bespoke UI, vague commits, security foot-guns, and features you never asked for.

> Better models won't fix this. They still don't know how _you_ work, and forget it the moment you switch tools. remindy feeds your standards to the agent **before** it writes.

## How you use it

Not a CLI you babysit; it's an MCP server your editor spawns.

| # | Do | What happens |
| --- | --- | --- |
| 1 | `npx remindy init --seed` | Registers the MCP server, drops a project rule, seeds rules from your repo |
| 2 | reload your editor | It picks up the MCP server |
| 3 | just code | Agent calls `remindy_recall` before writing, `remindy_capture` when you correct it |
| 4 | `npx remindy dashboard` | Local UI to view, edit, and stress-test rules |

## The loop

- **recall**: agent pulls your known standards, ranked by relevance × burn count, trimmed to ~100 tokens.
- **capture**: a correction is compressed to one line, deduped, and stored (or its burn count bumps).

Rule format: `[TAG] anti-pattern → fix (×N)` &nbsp;·&nbsp; `TAG ∈ {UI, COPY, CODE, COMMIT, SEC, REQ, PERF}`

`×N` is the **burn count**: how many times you've been corrected on that rule. More burns means it ranks higher in recall, so your most-repeated mistakes surface first.

```text
[CODE] invented APIs, guessed signatures → verify against the docs first (×4)
[COPY] "delve/seamless/robust" LLM slop → plain, concrete language (×2)
[SEC]  permissive defaults, missing authz → deny by default, least privilege (×1)
```

## Quickstart

```bash
npm install && npm run build

# Supermemory Local, the on-machine store (Unix binary; WSL2 on Windows)
curl -fsSL https://supermemory.ai/install | bash
supermemory-server                 # http://localhost:6767

npx remindy doctor                 # verify: backend = Supermemory Local
npx remindy init --seed
```

## Commands

| Command | Does |
| --- | --- |
| `remindy init [--seed]` | Register MCP server + drop rule (+ seed from repo) |
| `remindy seed` | Infer and store standards from this repo |
| `remindy doctor` | Check config, LLM, Supermemory; print active backend |
| `remindy dashboard` | Local web UI at `http://localhost:3456` |
| `remindy config [set]` | View or set the compression provider (BYOK) |

## What runs where

- **Supermemory Local**: shared on-machine store + embeddings. Load-bearing: it's what makes a fix in one tool show up in another, and what survives restarts.
- **Ranking is local**: self-hosted vector search returns nothing (v0.0.5), so remindy lists via `documents.list` and ranks with a deterministic keyword scorer.
- **Compression**: any OpenAI-compatible model (local Ollama or cloud), config-picked. Only polishes wording; never blocks a seed.

> No Supermemory Local? remindy falls back to a per-process in-memory store, fine for dev, but **not shared and not persistent**. `remindy doctor` says which mode you're in.

## Links

| Item | Link |
| --- | --- |
| Docs | https://remindy.henix.my.id/docs |
| Repository | https://github.com/justhenix/remindy |
| Supermemory Local | https://supermemory.ai |
| Model Context Protocol | https://modelcontextprotocol.io |

## Build &amp; test

```bash
npm install    # no external services needed for tests
npm run build  # tsc → dist/
npm test       # vitest (single run)
```

<div align="center"><sub>2026 · MIT · powered by <a href="https://supermemory.ai">supermemory.ai</a></sub></div>
