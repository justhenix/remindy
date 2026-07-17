import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ENV_PATH } from './index.js';

/**
 * Minimal .env writer for BYOK (bring-your-own-key).
 *
 * Updates or appends `KEY=value` lines in the project-root .env, preserving every
 * other line, comment, and blank. Only the keys passed in are touched. This is the
 * single place remindy writes credentials, and it writes ONLY to the gitignored
 * .env — nothing is logged and nothing leaves the machine.
 */

/** Keys BYOK is allowed to write. Anything else is ignored, so the writer can't be abused. */
const ALLOWED_KEYS = new Set([
  'LLM_PROVIDER',
  'OLLAMA_URL',
  'OLLAMA_MODEL',
  'OPENAI_API_URL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'ANTHROPIC_API_URL',
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_MODEL',
  'BAI_API_URL',
  'BAI_API_KEY',
  'BAI_MODEL',
]);

/**
 * Apply `updates` to the .env file. A value of `undefined` or `''` is ignored
 * (we never blank out an existing key). Returns the keys that were written.
 */
export function writeEnvVars(updates: Record<string, string | undefined>): string[] {
  const lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8').split(/\r?\n/) : [];

  const toApply = new Map<string, string>();
  for (const [key, value] of Object.entries(updates)) {
    if (ALLOWED_KEYS.has(key) && value !== undefined && value.trim().length > 0) {
      toApply.set(key, value.trim());
    }
  }
  if (toApply.size === 0) {
    return [];
  }

  const written: string[] = [];
  // Rewrite existing lines in place. A commented `# KEY=...` is treated as a slot
  // to activate, so the file's structure is respected rather than duplicated.
  const updated = lines.map((line) => {
    const match = line.match(/^\s*#?\s*([A-Z0-9_]+)\s*=/);
    if (match && toApply.has(match[1])) {
      const key = match[1];
      const value = toApply.get(key)!;
      toApply.delete(key);
      written.push(key);
      return `${key}=${value}`;
    }
    return line;
  });

  // Append any keys that had no existing slot.
  if (toApply.size > 0) {
    if (updated.length > 0 && updated[updated.length - 1].trim() !== '') {
      updated.push('');
    }
    for (const [key, value] of toApply) {
      updated.push(`${key}=${value}`);
      written.push(key);
    }
  }

  writeFileSync(ENV_PATH, updated.join('\n'), 'utf8');
  return written;
}
