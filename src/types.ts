/**
 * Core domain types for remindy.
 *
 * Two-layer data model (see AGENTS.md):
 *  - RichMemory: stored + embedded; used for match / dedup / regeneration.
 *  - Caveman projection: a derived single-line string, the thing actually injected.
 */

/** Fixed tag taxonomy. See conventions.md. */
export type Tag = 'UI' | 'COPY' | 'CODE' | 'COMMIT' | 'SEC' | 'REQ' | 'PERF';

export const TAGS: readonly Tag[] = ['UI', 'COPY', 'CODE', 'COMMIT', 'SEC', 'REQ', 'PERF'];

/** The rich, stored form of a standard/anti-pattern. */
export interface RichMemory {
  id: string;
  tag: Tag;
  antiPattern: string;
  fix: string;
  context?: string;
  badExample?: string;
  goodExample?: string;
  burns: number;
  createdAt: string;
}

/**
 * Caveman projection: the derived single-line string injected into agents.
 * Format: `[TAG] antiPattern -> fix (xN)`. Represented as a plain string.
 */
export type CavemanRule = string;

/** Result of remindy_recall. */
export interface RecallResult {
  rules: CavemanRule[];
  tokens: number;
}

/** Result of remindy_capture. */
export interface CaptureResult {
  id: string;
  caveman: CavemanRule;
  burns: number;
}
