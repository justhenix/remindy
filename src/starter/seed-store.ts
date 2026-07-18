import type { Tag } from '../types.js';
import type { MemoryStore } from '../memory/store.js';
import { NodeRepoReader } from '../infer/reader.js';
import { inferRepoRules } from '../infer/inferrer.js';
import { mergeWithStarter } from '../infer/merge.js';
import { buildPolisher, polishRules } from '../infer/polish.js';

export interface SeedResult {
  /** Rules actually written this run (already-present ids are skipped). */
  added: number;
  /** Total rules in the seed set (added + skipped). */
  total: number;
  inferred: Tag[];
  starter: Tag[];
}

/**
 * Seed a store with standards inferred from the repo at `cwd`, filled from the
 * curated starter pack, and best-effort polished. Shared by `remindy seed` (CLI)
 * and the dashboard's one-click seed so both produce identical rules.
 *
 * Idempotent: rules whose id already exists are skipped, so re-seeding never
 * duplicates or resets burn counts.
 */
export async function seedFromRepo(store: MemoryStore, cwd: string): Promise<SeedResult> {
  const reader = new NodeRepoReader(cwd);
  const drafts = inferRepoRules(reader);
  const merged = mergeWithStarter(drafts);
  const rules = await polishRules(merged, buildPolisher());

  const existing = new Set((await store.all()).map((m) => m.id));
  let added = 0;
  for (const rule of rules) {
    if (existing.has(rule.id)) continue;
    await store.add(rule);
    added++;
  }

  return {
    added,
    total: rules.length,
    inferred: rules.filter((r) => r.id.startsWith('inferred-')).map((r) => r.tag),
    starter: rules.filter((r) => !r.id.startsWith('inferred-')).map((r) => r.tag),
  };
}
