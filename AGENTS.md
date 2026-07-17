# AGENTS.md — remindy

> The portable taste & standards layer for AI coding agents.
> Teach any agent your standards once; it stops violating them — in every tool, for ~15 tokens a turn.
> Supermemory Local hackathon build: one command, runs entirely on your machine.

## Positioning (read before pitching)
remindy enforces HOW you want code written — subjective standards, not objective bugs. Stay distinct from the field:
- NOT a bug/error memory (that comparison loses). NOT a general fact/decision memory.
- The wedge: taste & standards a linter can't catch — slop-free UI/copy, commit style, security rules, DRY/YAGNI, build-only-what's-specced.
- The edge: universal via MCP — a correction made in one tool (e.g. Cursor) is respected by another (e.g. Claude, Kiro). No single-tool competitor can do this.
- The wow: ~15 tokens per turn. "Your standards, enforced for near-zero tokens" is the headline metric.
- Do NOT pitch bug/error capture. The engine can store any correction; we just don't sell it as a bug tool.

## Read this first (every agent, every session)
1. This is a hackathon. Optimize for a working demo, not perfection. Ship the smallest thing that advances the loop below.
2. Dogfood our values — the product exists to prevent exactly these: DRY, YAGNI, conventional commits, no AI-slop copy, no secrets in code, no unrequested features.
3. Never invent upstream APIs. Before writing integration code against the Supermemory SDK or the MCP SDK, confirm the calls against node_modules types / official docs. If unsure, stub behind a small interface and leave a TODO.
4. Prefer editing existing files over adding new ones. Match the existing style.
5. Always call the `remindy_recall` MCP tool before writing or editing code.

## The loop we are building
`npx remindy init` → boots Supermemory Local + remindy MCP server, writes MCP config, drops a one-line project rule → agent calls `remindy_recall` before coding → gets a tiny "known mistakes" block → when corrected, agent (or user) calls `remindy_capture` → next similar task is clean, ~15 tokens injected.

## MVP scope (build this)
- One-command init/boot: server + MCP registration + rule-line drop.
- `remindy_recall` and `remindy_capture` MCP tools.
- Two-layer storage (rich memory + caveman projection) in Supermemory Local.
- Compression at capture time via an OpenAI-compatible model (local Ollama by default).
- Curated starter TASTE pack (AI-slop word blocklist, conventional-commit rule, a couple of DRY/YAGNI + security rules) so recall is useful on first run and demonstrates the taste angle immediately.

## Out of scope (do NOT build now — v2)
Auto-mining from logs, git revert detection, memory decay/staleness, conflict resolution between rules, team sync/sharing. Building these now is a YAGNI violation.

## Architecture (as-built)
- MCP client (any) ⇄ remindy MCP server (`@modelcontextprotocol/sdk`) — exposes recall/capture.
- Orchestration (inside the server): recall = list rules → tag-scope → rank(relevance × burn) → token-budget → format; capture = compress → dedup → insert-or-increment.
- Compression — an OpenAI-compatible client (`openai` npm) pointed at a local (Ollama) or cloud (b.ai) model. No llm-bridge; config picks the provider.
- Supermemory Local (core) — on-machine storage + local embeddings. It's a Unix binary; on Windows it runs in WSL2.
- Ranking is LOCAL: Supermemory Local's self-hosted vector search (v0.0.5) returns nothing, so remindy lists rules via `documents.list` and ranks them with a deterministic keyword scorer. Supermemory = storage; remindy = ranking. See "As-built reality" below.

## As-built reality (hard-won; don't relearn)
- Supermemory Local is a Unix binary; on Windows run it in WSL2 (`curl -fsSL https://supermemory.ai/install | bash`). remindy reaches it at http://localhost:6767 (WSL2 forwards localhost).
- Self-hosted vector search (v0.0.5) returns 0 results even for stored, indexed docs → remindy ranks locally over `documents.list`. Recall needs no LLM and no memory agent.
- Supermemory runs an internal LLM "memory agent" on ingest. remindy IGNORES its output, and a document persists even if that agent fails — so any model (or a failing one) works.
- Memory-agent model reality: local Ollama works (slow on CPU), b.ai `claude-sonnet-5` works, Gemini (`3.1-flash-lite` AND `3.5-flash`) do NOT work with the self-hosted agent. Default: local Ollama (free, on-machine).
- No usable GPU on the dev machine (AMD iGPU; Ollama runs CPU-only, ~5-7 tok/s). Compression model: `qwen2.5-coder:3b`.
- Dedup is keyword-based (semantic search unavailable): same tag AND (exact anti-pattern match OR combined antiPattern+fix similarity ≥ threshold).

## MCP tool contracts
`remindy_recall(task_context: string) -> { rules: string[], tokens: number }`
- Called BEFORE writing/editing code. Returns known mistakes to avoid.
- Behavior: list stored rules (`documents.list`) → filter by tag scope → rank by keyword relevance × burn count → trim to ≤ ~100 tokens → return formatted caveman rules.
- The tool description MUST be imperative: "ALWAYS call before writing or editing code."

`remindy_capture(mistake: string, tag?: Tag) -> { id: string, caveman: string, burns: number }`
- Called when the agent is corrected, or invoked directly by the user.
- Behavior: an OpenAI-compatible model compresses to `[TAG] anti-pattern → fix` → dedup against existing rules (same tag + matching anti-pattern/fix) → if match, increment burn count; else insert new rich memory + caveman projection.

## Caveman rule format
`[TAG] anti-pattern → fix (×N)`
- TAG ∈ { UI, COPY, CODE, COMMIT, SEC, REQ, PERF } (fixed set).
- `→ fix` is MANDATORY. A rule without a concrete fix is nagging and gets ignored — reject and re-compress it.
- Target ≤ 15 tokens per rule. `(×N)` is the burn count and drives ranking.

Examples:
- `[UI] inline styles → use design tokens (×3)`
- `[COPY] "unlock/seamless/elevate" slop → plain verbs (×2)`
- `[COMMIT] "fix stuff" → conventional: type(scope): msg (×2)`
- `[SEC] secrets in code → env vars + gitignore (×1)`
- `[CODE] useEffect for derived state → compute in render (×4)`
- `[REQ] unrequested features → build only what's specced (×1)`

## Data model (two layers)
Rich memory (stored + embedded; used for match/dedup/regeneration):
```
{ id, tag, antiPattern, fix, context, badExample?, goodExample?, burns, createdAt }
```
Caveman projection (derived, cached, injected): the single-line string above.
Rule: match/dedup on rich semantics; inject only the projection. Regenerate projections from rich memories if compression improves.

## Project structure (proposed — adjust to upstream reality)
```
remindy/
  src/
    server/        # MCP server + tool registration
    recall/        # query, scope, rank, budget, format
    capture/       # compress (OpenAI-compatible), dedup, store
    memory/        # Supermemory Local client wrapper (interface + impl)
    starter/       # curated starter pack rules
    install/       # `remindy init`: boot, MCP config, rule-line drop
    types.ts
  bin/remindy.ts    # CLI entry (npx remindy)
  test/
  package.json
```

## Commands (confirm once package.json exists)
- `npm install` — deps
- `npm run dev` — run server locally (do NOT run long-lived watchers inside agent tool calls; the user runs these)
- `npm run build` — compile TS
- `npm test` — tests, single run, no watch
- `npx remindy init` — the one-command setup

## Conventions (fast iteration)
- TypeScript strict. Small, single-responsibility, pure-where-possible functions.
- No premature abstraction. Add an interface only for ≥2 implementations or to hide an unstable upstream API.
- Conventional commits: `type(scope): summary` (feat, fix, chore, docs, refactor, test). No "fix stuff".
- No secrets in code or commits. Local-first: nothing leaves the machine.
- No AI-slop copy in UI/docs. Plain, concrete language.
- Test non-trivial behavior: recall ranking, dedup, compression parsing.

## Definition of done (per change)
- Builds (`npm run build`) and tests pass (`npm test`).
- No upstream API guessed without a verified reference or a stubbed interface + TODO.
- Advances the demo loop or fixes a bug in it.

## Demo checklist (cross-tool is the winning moment)
- `npx remindy init` works from a clean clone in one command.
- Starter taste pack makes `remindy_recall` return useful standards immediately.
- Correct a standard ONCE in one MCP client via `remindy_capture` (sloppy UI + AI-slop copy + vague commit).
- Switch to a DIFFERENT MCP client and show it already respects all three standards from the same local memory.
- Show the injected token count (~15) to prove the near-zero-cost claim.
