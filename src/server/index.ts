import { pathToFileURL } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { MemoryStore } from '../memory/store.js';
import type { Compressor } from '../capture/compressor.js';
import { InMemoryStore } from '../memory/in-memory-store.js';
import { SupermemoryLocalStore } from '../memory/supermemory-local-store.js';
import { TemplateCompressor } from '../capture/template-compressor.js';
import { LlmCompressor } from '../capture/llm-compressor.js';
import { seed } from '../starter/pack.js';
import {
  isLlmConfigured,
  isSupermemoryConfigured,
  resolveLlmConfig,
  resolveSupermemoryConfig,
} from '../config/index.js';
import { createRemindyServer, RemindyDeps } from './server.js';

export { createRemindyServer } from './server.js';
export type { RemindyDeps } from './server.js';

/**
 * Offline default dependency set (Phase 1 PoC): in-memory store seeded with the
 * starter pack + deterministic template compressor. Used by the test suite.
 */
export async function createOfflineDeps(): Promise<RemindyDeps> {
  const store = new InMemoryStore();
  await seed(store);
  return { store, compressor: new TemplateCompressor() };
}

/**
 * Resolve real dependencies from config, falling back to offline defaults per layer:
 *  - Supermemory Local when SUPERMEMORY_API_KEY is set, else a seeded in-memory store.
 *  - LlmCompressor when an LLM key+model are set, else the template compressor.
 *
 * Backend selection is logged to STDERR (stdout is reserved for the stdio transport).
 * The real store is intentionally NOT seeded here — seeding on every boot would spam
 * duplicates. Load the starter pack once with `remindy seed` instead.
 */
export async function createDeps(): Promise<RemindyDeps> {
  const smConfig = resolveSupermemoryConfig();
  const llmConfig = resolveLlmConfig();

  let store: MemoryStore;
  if (isSupermemoryConfigured(smConfig)) {
    store = new SupermemoryLocalStore(smConfig);
    console.error(`[remindy] memory: Supermemory Local @ ${smConfig.url}`);
  } else {
    const mem = new InMemoryStore();
    await seed(mem);
    store = mem;
    console.error('[remindy] memory: in-memory (offline), seeded with starter pack');
  }

  let compressor: Compressor;
  if (isLlmConfigured(llmConfig)) {
    compressor = new LlmCompressor(llmConfig);
    console.error(`[remindy] compressor: LLM (${llmConfig.provider}/${llmConfig.model})`);
  } else {
    compressor = new TemplateCompressor();
    console.error('[remindy] compressor: template (offline)');
  }

  return { store, compressor };
}

/** Human-readable status of the resolved backends, for `doctor` and the dashboard. */
export interface BackendStatus {
  /** True only when the shared, persistent Supermemory store is active. */
  supermemoryActive: boolean;
  /** Store label, e.g. "Supermemory Local @ …" or the offline in-memory warning. */
  store: string;
  /** Compressor label, e.g. "b.ai/claude-sonnet-5" or "template (offline)". */
  compressor: string;
}

/**
 * Report which backends config resolves to, without constructing them.
 *
 * The store line is deliberately blunt about the offline case: an in-memory store
 * is per-process, so it is neither shared across tools nor persistent. Surfacing
 * this stops a demo from silently running on isolated memory and looking real.
 */
export function describeBackend(): BackendStatus {
  const sm = resolveSupermemoryConfig();
  const llm = resolveLlmConfig();
  const supermemoryActive = isSupermemoryConfigured(sm);
  return {
    supermemoryActive,
    store: supermemoryActive
      ? `Supermemory Local @ ${sm.url} (shared, persistent)`
      : 'in-memory (offline — NOT shared across tools, NOT persistent)',
    compressor: isLlmConfigured(llm)
      ? `LLM (${llm.provider}/${llm.model})`
      : 'template (offline)',
  };
}

/** Start the remindy MCP server over stdio using config-resolved dependencies. */
export async function main(): Promise<void> {
  const deps = await createDeps();
  const server = createRemindyServer(deps);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Run only when invoked directly (npm run dev / node dist/src/server/index.js),
// so importing this module (e.g. from tests) has no side effects.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error('remindy server failed to start:', err);
    process.exit(1);
  });
}
