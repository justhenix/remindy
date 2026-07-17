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
/**
 * Absolute path to the project-root .env. This file compiles to
 * dist/src/config/index.js, so the project root is three levels up. Exported so
 * the BYOK writer targets the exact same file config reads from.
 */
export const ENV_PATH = resolve(import.meta.dirname, '../../../.env');

loadDotenv({ quiet: true, path: ENV_PATH });

/**
 * OpenAI-compatible LLM providers remindy can route to (config only, no code change).
 * Every provider speaks the OpenAI chat-completions shape, so one client covers all:
 *  - ollama:    local, on-machine compression (the default; qwen2.5-coder:3b).
 *  - openai:    OpenAI cloud (api.openai.com).
 *  - anthropic: Claude via Anthropic's OpenAI-compatible endpoint (api.anthropic.com/v1/).
 *  - bai:       b.ai cloud (OpenAI-compatible).
 */
export type LlmProviderName = 'ollama' | 'openai' | 'anthropic' | 'bai';

/** Providers that require a real API key (everything except local Ollama). */
export const CLOUD_PROVIDERS: readonly LlmProviderName[] = ['openai', 'anthropic', 'bai'];

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
// Anthropic's OpenAI-compatible endpoint; the openai client appends /chat/completions.
const ANTHROPIC_DEFAULT_URL = 'https://api.anthropic.com/v1/';
const SUPERMEMORY_DEFAULT_URL = 'http://localhost:6767';

/** Read a trimmed, non-empty env var, else undefined. */
function env(name: string): string | undefined {
  const v = process.env[name];
  return v !== undefined && v.trim().length > 0 ? v.trim() : undefined;
}

/** Resolve the active provider from LLM_PROVIDER; default ollama; unknown -> ollama. */
export function resolveLlmProvider(): LlmProviderName {
  const raw = (env('LLM_PROVIDER') ?? 'ollama').toLowerCase();
  if (raw === 'ollama' || raw === 'openai' || raw === 'anthropic' || raw === 'bai') {
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
    case 'openai':
      return {
        provider,
        // undefined => the openai client's own default (https://api.openai.com/v1).
        baseURL: env('OPENAI_API_URL'),
        apiKey: env('OPENAI_API_KEY'),
        model: env('OPENAI_MODEL'),
      };
    case 'anthropic':
      return {
        provider,
        baseURL: env('ANTHROPIC_API_URL') ?? ANTHROPIC_DEFAULT_URL,
        apiKey: env('ANTHROPIC_API_KEY'),
        model: env('ANTHROPIC_MODEL'),
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

/** Secret-free view of the LLM config for display (CLI `config`, dashboard settings). */
export interface LlmConfigView {
  provider: LlmProviderName;
  model: string | undefined;
  baseURL: string | undefined;
  /** True when a real API key is present (the 'ollama' placeholder does not count). */
  apiKeySet: boolean;
}

export function viewLlmConfig(cfg: LlmConfig = resolveLlmConfig()): LlmConfigView {
  return {
    provider: cfg.provider,
    model: cfg.model,
    baseURL: cfg.baseURL,
    apiKeySet: Boolean(cfg.apiKey && cfg.apiKey !== 'ollama'),
  };
}

/** Supermemory Local requires an API key (printed on first boot); no key => offline. */
export function isSupermemoryConfigured(
  cfg: SupermemoryConfig = resolveSupermemoryConfig(),
): boolean {
  return Boolean(cfg.apiKey);
}
