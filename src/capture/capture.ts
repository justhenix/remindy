import type { CaptureResult, RichMemory, Tag } from '../types.js';
import type { MemoryStore } from '../memory/store.js';
import type { Compressor } from './compressor.js';

/** Render a rich memory to its caveman projection: `[TAG] antiPattern -> fix (xN)`. */
export function renderCaveman(m: RichMemory): string {
  return `[${m.tag}] ${m.antiPattern} -> ${m.fix} (x${m.burns})`;
}

/**
 * Capture orchestration: compress -> find near-duplicate -> insert-or-increment.
 *
 *  - On a dedup hit: increment the burn count and persist, return the existing id.
 *  - Otherwise: create a new rich memory (burns = 1) and store it.
 */
export async function capture(
  store: MemoryStore,
  compressor: Compressor,
  mistake: string,
  tag?: Tag,
): Promise<CaptureResult> {
  const compressed = await compressor.compress(mistake, tag);

  const existing = await store.findSimilar(compressed.tag, compressed.antiPattern, compressed.fix);
  if (existing) {
    const updated: RichMemory = { ...existing, burns: existing.burns + 1 };
    await store.update(updated);
    return { id: updated.id, caveman: renderCaveman(updated), burns: updated.burns };
  }

  const created: RichMemory = {
    id: crypto.randomUUID(),
    tag: compressed.tag,
    antiPattern: compressed.antiPattern,
    fix: compressed.fix,
    burns: 1,
    createdAt: new Date().toISOString(),
  };
  await store.add(created);
  return { id: created.id, caveman: renderCaveman(created), burns: created.burns };
}
