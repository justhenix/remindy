import type { Tag } from '../types.js';
import type { RepoReader } from './reader.js';
import { DETECTORS } from './detectors.js';
import { INFER_TAGS, type TasteRuleDraft } from './types.js';

/**
 * Run every detector over the repo and collect the drafts they produce.
 *
 * Each detector is wrapped so a thrown error is swallowed and treated as "no
 * signal" for that tag — inference is best-effort and must never fail the seed.
 * The result is keyed by the detector's own tag, so there is at most one draft
 * per tag and PERF never appears.
 */
export function inferRepoRules(reader: RepoReader): Map<Tag, TasteRuleDraft> {
  const drafts = new Map<Tag, TasteRuleDraft>();
  for (const tag of INFER_TAGS) {
    const detector = DETECTORS.get(tag);
    if (!detector) {
      continue;
    }
    try {
      const draft = detector(reader);
      // Trust the detector's own tag over whatever it returned, to keep the map keyed correctly.
      if (draft) {
        drafts.set(tag, { ...draft, tag });
      }
    } catch {
      // Best-effort: a detector failure means no signal for this tag.
    }
  }
  return drafts;
}
