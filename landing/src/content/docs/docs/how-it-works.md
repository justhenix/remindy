---
title: How it works
description: The recall and capture loop, the caveman rule format, and where each piece runs.
---

Two tools run the loop on every code write.

- **recall**: before writing, the agent pulls your known standards, ranked by
  relevance and how often each was corrected, trimmed to a roughly 100-token budget.
- **capture**: when you correct the agent, the correction is compressed to a one-line
  rule and stored, or its burn count is bumped if the rule already exists.

## Caveman rule format

```text
[TAG] anti-pattern → fix (×N)
```

Every rule is one terse line. The `→ fix` is mandatory, a rule without a concrete fix
is just nagging and gets ignored. The `×N` burn count records how many times you have
been corrected on it and drives ranking.

| Part | Meaning |
| --- | --- |
| `TAG` | One of `UI`, `COPY`, `CODE`, `COMMIT`, `SEC`, `REQ`, `PERF` |
| `anti-pattern` | The habit to avoid |
| `fix` | The concrete thing to do instead |
| `×N` | Burn count: how often it was corrected |

Examples:

```text
[CODE]   invented APIs, guessed signatures → verify against the docs first (×4)
[REQ]    gold-plating beyond the ask → build only what's specced; ask first (×3)
[UI]     bespoke UI instead of the design system → reuse tokens + components (×3)
[COPY]   "delve/seamless/robust" LLM slop → plain, concrete language (×2)
[COMMIT] one giant, vague commit → small, conventional: type(scope): msg (×2)
[SEC]    permissive defaults, missing authz → deny by default, least privilege (×1)
```

## What runs where

- **Supermemory Local** is the shared, on-machine store at `http://localhost:6767`.
  It holds the rich memories and the local embeddings.
- **Ranking is local.** Supermemory Local's self-hosted vector search returns nothing
  in the current release, so remindy lists rules via `documents.list` and ranks them
  with a deterministic keyword scorer. Supermemory is storage; remindy is ranking.
  Recall needs no LLM.
- **Compression** at capture time uses an OpenAI-compatible model (see [BYOK](/docs/byok/)).
  If the model is unreachable, remindy falls back to a deterministic template so
  capture never blocks.

## Two-layer data model

remindy stores a **rich memory** and injects a **caveman projection** derived from it.

```json
{
  "id": "…",
  "tag": "COPY",
  "antiPattern": "\"unlock/seamless\" slop",
  "fix": "plain verbs",
  "context": "copywriting headline microcopy",
  "burns": 3,
  "createdAt": "…"
}
```

Matching and dedup work on the rich memory; only the single-line projection is
injected into the agent. If compression improves, projections can be regenerated from
the rich memories.
