---
title: MCP tools
description: The remindy_recall and remindy_capture tools your agent calls.
---

remindy exposes two MCP tools. Any MCP-compatible client can call them.

## remindy_recall

Called **before** writing or editing code. Returns the known standards to avoid.

| | |
| --- | --- |
| **Input** | `task_context: string` |
| **Returns** | `{ rules: string[], tokens: number }` |

**Flow:** `documents.list` -> filter by tag scope -> rank by relevance x burn count -> trim to ~100 tokens -> return formatted rules.

The tool description is imperative on purpose: _always call before writing or editing code._

## remindy_capture

Fires on any sign of dissatisfaction, an explicit correction, or an implicit "meh" / "i hate it" / "why are you doing that". The injected project rule tells every agent to capture taste itself, so you rarely trigger it by hand.

| | |
| --- | --- |
| **Input** | `mistake: string, tag?: Tag` |
| **Returns** | `{ id: string, caveman: string, burns: number }` |

**Flow:** model compresses to `[TAG] anti-pattern -> fix` -> dedup (same tag + matching anti-pattern/fix) -> match bumps the burn count, else insert a new rule.

`Tag` ∈ `UI · COPY · CODE · COMMIT · SEC · REQ · PERF`.
