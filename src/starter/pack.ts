import type { RichMemory } from '../types.js';
import type { MemoryStore } from '../memory/store.js';

/**
 * Curated starter TASTE pack.
 *
 * These seed rules make remindy_recall useful on first run and demonstrate the
 * taste/standards angle (things a linter can't catch). Contexts are included to
 * improve keyword recall. Fixed ids + createdAt keep tests deterministic.
 */
export const STARTER_PACK: readonly RichMemory[] = [
  {
    id: 'starter-code-invented-apis',
    tag: 'CODE',
    antiPattern: 'invented APIs, guessed signatures',
    fix: 'verify against the docs first',
    context: 'hallucinated api method signature library framework docs grounding verify imports',
    burns: 4,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-req-overbuild',
    tag: 'REQ',
    antiPattern: 'gold-plating beyond the ask',
    fix: "build only what's specced; ask first",
    context: 'yagni scope requirements speculative over-engineering unrequested extra abstraction',
    burns: 3,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-ui-design-system',
    tag: 'UI',
    antiPattern: 'bespoke UI instead of the design system',
    fix: 'reuse tokens + components',
    context: 'ui styling react components css design system tokens reuse consistency accessibility',
    burns: 3,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-copy-slop',
    tag: 'COPY',
    antiPattern: '"delve/seamless/robust" LLM slop',
    fix: 'plain, concrete language',
    context: 'copywriting marketing llm ai slop words tone voice headline microcopy',
    burns: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-commit-message',
    tag: 'COMMIT',
    antiPattern: 'one giant, vague commit',
    fix: 'small, conventional: type(scope): msg',
    context: 'git commit message convention atomic scope',
    burns: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-sec-defaults',
    tag: 'SEC',
    antiPattern: 'permissive defaults, missing authz',
    fix: 'deny by default, least privilege',
    context: 'security authorization access control permissions cors pii logging least privilege',
    burns: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
];

/** Load the starter pack into a store. */
export async function seed(store: MemoryStore): Promise<void> {
  for (const rule of STARTER_PACK) {
    await store.add({ ...rule });
  }
}
