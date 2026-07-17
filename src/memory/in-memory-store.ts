import type { RichMemory, Tag } from '../types.js';
import { MemoryStore, findDuplicate } from './store.js';
import { KeywordEmbedder } from '../recall/keyword-embedder.js';

/** Text used for relevance scoring: the searchable parts of a memory. */
function searchableText(m: RichMemory): string {
  return [m.tag, m.antiPattern, m.fix, m.context ?? ''].join(' ');
}

/**
 * In-process MemoryStore backed by a plain array.
 *
 * findSimilar delegates to the shared findDuplicate (exact anti-pattern match, or
 * combined antiPattern+fix similarity over DEDUP_THRESHOLD). search() uses the
 * deterministic KeywordEmbedder so the offline recall path mirrors the real store.
 */
export class InMemoryStore implements MemoryStore {
  private readonly memories: RichMemory[] = [];
  private readonly embedder = new KeywordEmbedder();

  async add(m: RichMemory): Promise<void> {
    this.memories.push(m);
  }

  async all(): Promise<RichMemory[]> {
    // Return a shallow copy so callers can't mutate internal state.
    return [...this.memories];
  }

  async update(m: RichMemory): Promise<void> {
    const i = this.memories.findIndex((x) => x.id === m.id);
    if (i === -1) {
      throw new Error(`update: memory not found: ${m.id}`);
    }
    this.memories[i] = m;
  }

  async findSimilar(tag: Tag, antiPattern: string, fix: string): Promise<RichMemory | null> {
    return findDuplicate(this.memories, tag, antiPattern, fix, this.embedder);
  }

  async search(
    query: string,
    limit = 8,
  ): Promise<Array<{ memory: RichMemory; score: number }>> {
    return this.memories
      .map((memory) => ({ memory, score: this.embedder.score(query, searchableText(memory)) }))
      .filter((hit) => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async delete(id: string): Promise<void> {
    const idx = this.memories.findIndex((x) => x.id === id);
    if (idx !== -1) {
      this.memories.splice(idx, 1);
    }
  }
}
