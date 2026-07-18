---
title: How it works
description: The recall and capture loop, the caveman rule format, and where each piece runs.
---

Two tools, one loop, on every code write:

- **recall**: before writing, the agent pulls your standards, ranked by relevance x burn count, trimmed to ~100 tokens.
- **capture**: when you correct it, the fix is compressed to one line and stored (or its burn count bumps).

## Caveman rule format

```text
[TAG] anti-pattern -> fix (xN)
```

Every rule is one terse line. The `-> fix` is mandatory, a rule without a concrete fix
is just nagging and gets ignored. The `xN` burn count records how many times you have
been corrected on it and drives ranking.

| Part | Meaning |
| --- | --- |
| `TAG` | One of `UI`, `COPY`, `CODE`, `COMMIT`, `SEC`, `REQ`, `PERF` |
| `anti-pattern` | The habit to avoid |
| `fix` | The concrete thing to do instead |
| `xN` | **Burn count**: times you've been corrected on this rule. Higher burns rank higher in recall. |

Examples:

```text
[CODE]   invented APIs, guessed signatures -> verify against the docs first (x4)
[REQ]    gold-plating beyond the ask -> build only what's specced; ask first (x3)
[UI]     bespoke UI instead of the design system -> reuse tokens + components (x3)
[COPY]   "delve/seamless/robust" LLM slop -> plain, concrete language (x2)
[COMMIT] one giant, vague commit -> small, conventional: type(scope): msg (x2)
[SEC]    permissive defaults, missing authz -> deny by default, least privilege (x1)
```

## What runs where

- **Supermemory Local**: the shared, on-machine store at `http://localhost:6767`. Holds the rich memories + local embeddings.
- **Ranking is local**: self-hosted vector search returns nothing (current release), so remindy lists via `documents.list` and ranks with a deterministic keyword scorer. Recall needs no LLM.
- **Compression**: an OpenAI-compatible model at capture time ([BYOK](/docs/byok/)). Unreachable? It falls back to a template so capture never blocks.

## Two-layer data model

remindy stores a **rich memory** and injects a **caveman projection** derived from it.

```json
{ "id": "…", "tag": "COPY", "antiPattern": "…", "fix": "…", "burns": 3, "createdAt": "…" }
```

- **Match & dedup** run on the rich memory.
- **Only the one-line projection** is injected into the agent.
- Projections can be regenerated from rich memories if compression improves.
