import type { Tag } from '../types.js';
import type { RepoReader } from './reader.js';

/**
 * The subset of a RichMemory a detector can produce. Deliberately narrower than
 * RichMemory: `id`, `burns`, and `createdAt` are assigned later, at merge time.
 */
export interface TasteRuleDraft {
  /** Always the detector's own tag. */
  tag: Tag;
  /** Deterministic detection text — the primary, always-stored content. */
  antiPattern: string;
  /** Concrete correct action. Mandatory. */
  fix: string;
  /** Optional keyword hints to improve recall. */
  context?: string;
}

/** A pure detector: reads the repo, returns a draft when its signal is present, else null. */
export type Detector = (reader: RepoReader) => TasteRuleDraft | null;

/**
 * The fixed set of tags repo inference covers, in a stable order. PERF is excluded
 * by construction — there is no repo signal we can deterministically infer for it.
 */
export const INFER_TAGS: readonly Tag[] = ['UI', 'COPY', 'CODE', 'SEC', 'COMMIT', 'REQ'];
