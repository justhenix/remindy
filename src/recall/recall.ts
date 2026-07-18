import type { RecallResult } from '../types.js';
import type { MemoryStore } from '../memory/store.js';
import { renderCaveman } from '../capture/capture.js';

/** Approximate token count for a string (~4 chars per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface RecallOptions {
  /** Max number of rules to return. Default: 8. */
  maxRules?: number;
  /** Approximate token budget for the returned rules. Default: 100. */
  tokenBudget?: number;
}

const DEFAULT_MAX_RULES = 8;
const DEFAULT_TOKEN_BUDGET = 100;

/**
 * Burn weight: rules corrected more often rank higher. burns >= 1 => weight >= 1.
 * finalScore = relevance * (1 + ln(burns)).
 */
function weight(relevance: number, burns: number): number {
  return relevance * (1 + Math.log(burns));
}

/**
 * Recall known standards relevant to a task context.
 *
 * store.search (keyword for the offline store, vector for Supermemory Local) ->
 * apply burn weighting -> drop non-positive -> rank desc -> take top N ->
 * trim to the token budget -> format as caveman rules.
 * The returned `tokens` is guaranteed <= tokenBudget.
 */
export async function recall(
  store: MemoryStore,
  taskContext: string,
  opts: RecallOptions = {},
): Promise<RecallResult> {
  const maxRules = opts.maxRules ?? DEFAULT_MAX_RULES;
  const tokenBudget = opts.tokenBudget ?? DEFAULT_TOKEN_BUDGET;

  // Pull a candidate pool larger than maxRules so burn weighting can actually
  // reorder which rules survive, not just re-sort the top few.
  const candidateLimit = Math.max(maxRules * 3, 24);
  const candidates = await store.search(taskContext, candidateLimit);

  const ranked = candidates
    .map(({ memory, score }) => ({ memory, score: weight(score, memory.burns) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const rules: string[] = [];
  let tokens = 0;
  for (const { memory } of ranked) {
    if (rules.length >= maxRules) {
      break;
    }
    const rule = renderCaveman(memory);
    const cost = estimateTokens(rule);
    if (tokens + cost > tokenBudget) {
      break;
    }
    rules.push(rule);
    tokens += cost;
  }

  return { rules, tokens };
}
