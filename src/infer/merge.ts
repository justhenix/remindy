import type { RichMemory, Tag } from '../types.js';
import { STARTER_PACK } from '../starter/pack.js';
import { INFER_TAGS, type TasteRuleDraft } from './types.js';

/** Fixed epoch so a re-seed of the same repo produces byte-identical rules. */
const INFERRED_CREATED_AT = '2024-01-01T00:00:00.000Z';

/** Index the starter pack by tag once, for O(1) fallback lookup. */
const starterByTag: ReadonlyMap<Tag, RichMemory> = new Map(
  STARTER_PACK.map((rule) => [rule.tag, rule]),
);

/**
 * Merge inferred drafts over the curated starter pack, producing exactly one rule
 * per non-PERF tag, in fixed INFER_TAGS order.
 *
 *  - Tag has an inferred draft -> use it (id `inferred-<tag>`, burns 1, fixed createdAt).
 *  - Tag has no draft          -> fall back to the starter-pack rule verbatim.
 *
 * The two never coexist, and the returned array is always exactly INFER_TAGS.length.
 */
export function mergeWithStarter(drafts: Map<Tag, TasteRuleDraft>): RichMemory[] {
  const rules: RichMemory[] = [];
  for (const tag of INFER_TAGS) {
    const draft = drafts.get(tag);
    if (draft) {
      rules.push({
        id: `inferred-${tag.toLowerCase()}`,
        tag,
        antiPattern: draft.antiPattern,
        fix: draft.fix,
        burns: 1,
        createdAt: INFERRED_CREATED_AT,
        ...(draft.context ? { context: draft.context } : {}),
      });
      continue;
    }
    const starter = starterByTag.get(tag);
    if (starter) {
      // Copy so callers can't mutate the shared STARTER_PACK constant.
      rules.push({ ...starter });
    }
  }
  return rules;
}
