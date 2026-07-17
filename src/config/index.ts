import { resolve } from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * Load .env once, at import time. This NEVER throws: a missing variable simply
 * resolves to an offline default below. Config is read lazily by the resolvers
 * so tests that never touch config stay fully offline.
 *
 * - quiet: suppresses dotenv v17's stdout banner ("◇ injected env …") which
 *   would corrupt the MCP stdio JSON-RPC stream.
 * - path: anchored to the project root via import.meta.dirname so .env is
 *   found regardless of the spawning process's cwd. This file compiles to
 *   dist/src/config/index.js, so the project root is three levels up.
 */
loadDotenv({ quiet: true, path: resolve(import.meta.dirname, '../../../.env') });

/**
 * OpenAI-compatible LLM providers remind can route to (config only, no code change).
 * Scoped to what we actually run and have validated:
 *  - ollama: local, on-machine compression (the default; qwen2.5-coder:3b).
 *  - bai:    b.ai cloud (OpenAI-compatible; a real key is present and the API is verified).
 * Other providers were removed to avoid claiming untested paths.
 */
export type LlmProviderName = 'ollama' | 'bai';

export interface LlmConfig {
  provider: LlmProviderName;
  /** OpenAI-compatible base URL. `undefined` means the openai client's own default. */
  baseURL: string | undefined;
  apiKey: string | undefined;
  model: string | undefined;
}

export interface SupermemoryConfig {
  url: string;
  apiKey: string | undefined;
}

// Verified base URLs (see provider docs).
const BAI_DEFAULT_URL = 'https://api.b.ai/v1';
const OLLAMA_DEFAULT_URL = 'http://localhost:11434';
const SUPERMEMORY_DEFAULT_URL = 'http://localhost:6767';

/** Read a trimmed, non-empty env var, else undefined. */
function env(name: string): string | undefined {
  const v = process.env[name];
  return v !== undefined && v.trim().length > 0 ? v.trim() : undefined;
}

/** Resolve the active provider from LLM_PROVIDER; default ollama; unknown -> ollama. */
export function resolveLlmProvider(): LlmProviderName {
  const raw = (env('LLM_PROVIDER') ?? 'ollama').toLowerCase();
  if (raw === 'ollama' || raw === 'bai') {
    return raw;
  }
  return 'ollama';
}

/** Map the active provider to { baseURL, apiKey, model }. Never throws. */
export function resolveLlmConfig(): LlmConfig {
  const provider = resolveLlmProvider();
  switch (provider) {
    case 'ollama':
      return {
        provider,
        baseURL: `${env('OLLAMA_URL') ?? OLLAMA_DEFAULT_URL}/v1`,
        // Ollama's OpenAI-compatible endpoint ignores the key but the client requires one.
        apiKey: 'ollama',
        model: env('OLLAMA_MODEL'),
      };
    case 'bai':
      return {
        provider,
        baseURL: env('BAI_API_URL') ?? BAI_DEFAULT_URL,
        apiKey: env('BAI_API_KEY'),
        model: env('BAI_MODEL'),
      };
  }
}

/** Resolve Supermemory Local config. url always defaults; apiKey may be undefined. */
export function resolveSupermemoryConfig(): SupermemoryConfig {
  return {
    url: env('SUPERMEMORY_API_URL') ?? SUPERMEMORY_DEFAULT_URL,
    apiKey: env('SUPERMEMORY_API_KEY'),
  };
}

/** LLM usable only when we have both a key and a model to send. */
export function isLlmConfigured(cfg: LlmConfig = resolveLlmConfig()): boolean {
  return Boolean(cfg.apiKey && cfg.model);
}

/** Supermemory Local requires an API key (printed on first boot); no key => offline. */
export function isSupermemoryConfigured(
  cfg: SupermemoryConfig = resolveSupermemoryConfig(),
): boolean {
  return Boolean(cfg.apiKey);
}
