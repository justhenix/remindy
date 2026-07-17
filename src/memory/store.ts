import type { RichMemory, Tag } from '../types.js';
import type { Embedder } from '../recall/embedder.js';

/**
 * Storage abstraction for rich memories.
 *
 * Two implementations exist, so this interface is justified (see conventions.md):
 *  - InMemoryStore   — offline default used by tests and the offline fallback.
 *  - SupermemoryLocalStore — the real on-machine backend (storage via documents.list).
 */
export interface MemoryStore {
  add(m: RichMemory): Promise<void>;
  all(): Promise<RichMemory[]>;
  update(m: RichMemory): Promise<void>;
  /**
   * Find an existing memory that is a near-duplicate of a new (tag, antiPattern, fix),
   * so capture can increment its burn count instead of storing a duplicate.
   */
  findSimilar(tag: Tag, antiPattern: string, fix: string): Promise<RichMemory | null>;
  /**
   * Relevance-ranked search over stored memories. Powers recall for both stores, so the
   * recall path is identical. Returns at most `limit` hits sorted by descending relevance.
   */
  search(query: string, limit?: number): Promise<Array<{ memory: RichMemory; score: number }>>;
  /**
   * Delete a stored rule by its unique ID.
   */
  delete(id: string): Promise<void>;
}

/**
 * Normalize an anti-pattern string for dedup matching:
 * lowercase, strip punctuation, collapse whitespace.
 */
export function normalizeAntiPattern(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Similarity at/above which two same-tag rules are treated as the same mistake.
 * Tuned for the combined "antiPattern + fix" text: differently-worded corrections
 * with the same fix (e.g. "var keyword" vs "var for variables", both "use const or let")
 * land ~0.6-0.7, while genuinely distinct rules in a tag stay well below.
 */
export const DEDUP_THRESHOLD = 0.5;

/**
 * Shared dedup logic used by every store. A candidate is a duplicate when it shares the
 * tag AND either (a) its normalized anti-pattern is identical (a certain match, even if the
 * fix was reworded), or (b) the combined "antiPattern + fix" text clears DEDUP_THRESHOLD.
 * Semantic dedup would be nicer, but Supermemory Local's vector search is unusable, so we
 * rank locally with the same deterministic KeywordEmbedder used for recall.
 */
export function findDuplicate(
  memories: readonly RichMemory[],
  tag: Tag,
  antiPattern: string,
  fix: string,
  embedder: Embedder,
): RichMemory | null {
  const normalized = normalizeAntiPattern(antiPattern);
  const target = `${antiPattern} ${fix}`;
  let best: RichMemory | null = null;
  let bestScore = 0;
  for (const m of memories) {
    if (m.tag !== tag) {
      continue;
    }
    if (normalizeAntiPattern(m.antiPattern) === normalized) {
      return m;
    }
    const score = embedder.score(target, `${m.antiPattern} ${m.fix}`);
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return bestScore >= DEDUP_THRESHOLD ? best : null;
}
