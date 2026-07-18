---
title: CLI reference
description: Every remindy command, for setup, seeding, diagnostics, and the dashboard.
---

The CLI is only for setup and maintenance. Day to day, remindy runs inside your editor
as an MCP server.

| Command | What it does |
| --- | --- |
| `remindy init [--seed]` | Register the MCP server in detected editors, drop the project rule, and optionally seed rules inferred from this repo |
| `remindy seed` | Infer and store standards from this repo |
| `remindy doctor` | Check config, LLM, and Supermemory; print the active backend |
| `remindy dashboard` | Launch the local dashboard at `http://localhost:3456` |
| `remindy config [set]` | View or set the compression provider (see [BYOK](/docs/byok/)) |
| `remindy uninstall` | Remove the MCP entry and project rule (stored rules stay) |

## Examples

```bash
# One-command setup: register, drop rule, seed from this repo
npx remindy init --seed

# Re-seed after big repo changes
npx remindy seed

# Confirm you're on the shared store
npx remindy doctor

# Switch compression to a local Ollama model
npx remindy config set --provider ollama --model qwen2.5-coder:3b
```
