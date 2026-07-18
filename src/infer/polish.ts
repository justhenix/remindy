import type { RichMemory } from '../types.js';
import type { Compressor } from '../capture/compressor.js';
import { LlmCompressor } from '../capture/llm-compressor.js';
import { CLOUD_PROVIDERS, isLlmConfigured, resolveLlmConfig } from '../config/index.js';

/** Inferred rules carry this id prefix; starter-pack rules never do. */
const INFERRED_PREFIX = 'inferred-';

/**
 * Best-effort wording polish for inferred rules via the configured LLM (b.ai).
 *
 * This NEVER changes which tag or which detection outcome was chosen, it only
 * rewords `antiPattern` / `fix`. Any failure (unconfigured, unreachable, tag
 * mismatch, empty fix, thrown error) keeps the deterministic detection text, so
 * the seed always succeeds.
 *
 *  - `polisher === null` -> return rules unchanged.
 *  - starter-sourced rules (no `inferred-` id) are never polished.
 */
export async function polishRules(
  rules: RichMemory[],
  polisher: Compressor | null,
): Promise<RichMemory[]> {
  if (!polisher) {
    return rules;
  }

  const out: RichMemory[] = [];
  for (const rule of rules) {
    if (!rule.id.startsWith(INFERRED_PREFIX)) {
      out.push(rule);
      continue;
    }
    out.push(await polishOne(rule, polisher));
  }
  return out;
}

async function polishOne(rule: RichMemory, polisher: Compressor): Promise<RichMemory> {
  try {
    const prompt = `${rule.antiPattern} -> ${rule.fix}`;
    const reworded = await polisher.compress(prompt, rule.tag);
    // Accept only if the tag is preserved and the fix stays concrete.
    if (reworded.tag === rule.tag && reworded.fix.trim().length > 0 && reworded.antiPattern.trim().length > 0) {
      return { ...rule, antiPattern: reworded.antiPattern, fix: reworded.fix };
    }
  } catch {
    // Keep the deterministic text on any failure.
  }
  return rule;
}

/**
 * Build the polisher, or null when the LLM isn't usable for this run.
 *
 * Built for any configured cloud provider (OpenAI, Anthropic, b.ai), local Ollama
 * is skipped because it is too slow for a seed on CPU. Uses a throwing strict
 * fallback (same pattern as `remindy doctor`) so a live API/parse failure surfaces
 * as a caught error in polishOne -> deterministic text kept, rather than silently
 * degrading to the offline template compressor.
 */
export function buildPolisher(): Compressor | null {
  const llm = resolveLlmConfig();
  if (!CLOUD_PROVIDERS.includes(llm.provider) || !isLlmConfigured(llm)) {
    return null;
  }
  const strict: Compressor = {
    async compress() {
      throw new Error('polish: model returned no usable JSON rule');
    },
  };
  return new LlmCompressor(llm, { fallback: strict });
}
