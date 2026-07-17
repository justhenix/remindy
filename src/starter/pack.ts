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
    id: 'starter-ui-inline-styles',
    tag: 'UI',
    antiPattern: 'inline styles',
    fix: 'use design tokens',
    context: 'styling react components css color spacing theme',
    burns: 3,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-copy-slop',
    tag: 'COPY',
    antiPattern: '"unlock/seamless/elevate" slop',
    fix: 'plain verbs',
    context: 'copywriting marketing ai slop words headline microcopy',
    burns: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-commit-message',
    tag: 'COMMIT',
    antiPattern: '"fix stuff"',
    fix: 'conventional: type(scope): msg',
    context: 'git commit message convention',
    burns: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-sec-secrets',
    tag: 'SEC',
    antiPattern: 'secrets in code',
    fix: 'env vars + gitignore',
    context: 'security api key password token credentials',
    burns: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-code-useeffect',
    tag: 'CODE',
    antiPattern: 'useEffect for derived state',
    fix: 'compute in render',
    context: 'react hooks derived state rendering',
    burns: 4,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'starter-req-unrequested',
    tag: 'REQ',
    antiPattern: 'unrequested features',
    fix: 'build only what is specced',
    context: 'yagni scope requirements speculative',
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
