#!/usr/bin/env node
/**
 * remindy CLI.
 *
 *  - `remindy init`   : register MCP server in detected clients + drop project rule.
 *                       `--seed` also infers rules from this repo (needs Supermemory).
 *  - `remindy doctor` : smoke-checks the resolved config, the LLM, and Supermemory Local.
 *  - `remindy seed`   : infers rules from this repo into the real Supermemory store.
 *  - `remindy dashboard` : local web UI to view/edit rules.
 */
import type { Compressor } from '../src/capture/compressor.js';
import { LlmCompressor } from '../src/capture/llm-compressor.js';
import { runInit } from '../src/install/init.js';
import { describeBackend } from '../src/server/index.js';
import { startDashboard } from '../src/dashboard/server.js';
import { SupermemoryLocalStore } from '../src/memory/supermemory-local-store.js';
import { seedFromRepo } from '../src/starter/seed-store.js';
import {
  isLlmConfigured,
  isSupermemoryConfigured,
  resolveLlmConfig,
  resolveSupermemoryConfig,
  viewLlmConfig,
} from '../src/config/index.js';
import { writeEnvVars } from '../src/config/env-file.js';

// printInit stub removed — real implementation lives in src/install/init.ts.

/** Never reveal secret values — only whether they are present. */
function mask(value: string | undefined): string {
  return value ? 'set' : 'unset';
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Smoke check. Prints resolved config (secrets masked), runs one real LLM
 * compression, and probes Supermemory Local. Live failures are reported, never
 * thrown — the offline path always works, so we exit 0.
 */
async function doctor(): Promise<void> {
  const llm = resolveLlmConfig();
  const sm = resolveSupermemoryConfig();

  console.log('remindy doctor');
  console.log('');
  console.log('Config:');
  console.log(`  LLM provider:     ${llm.provider}`);
  console.log(`  LLM model:        ${llm.model ?? '(unset)'}`);
  console.log(`  LLM base URL:     ${llm.baseURL ?? '(openai default)'}`);
  console.log(`  LLM API key:      ${mask(llm.apiKey)}`);
  console.log(`  Supermemory URL:  ${sm.url}`);
  console.log(`  Supermemory key:  ${mask(sm.apiKey)}`);
  console.log('');

  console.log('LLM check:');
  if (!isLlmConfigured(llm)) {
    console.log('  SKIP: not configured; capture falls back to the offline template compressor.');
  } else {
    try {
      // A throwing fallback surfaces real API/parse failures instead of silently
      // degrading to the template compressor, so the check is meaningful.
      const strict: Compressor = {
        async compress() {
          throw new Error('model returned no usable JSON rule');
        },
      };
      const compressor = new LlmCompressor(llm, { fallback: strict });
      const rule = await compressor.compress(
        'you shipped inline styles again instead of using our design tokens',
        'UI',
      );
      console.log(`  PASS: [${rule.tag}] ${rule.antiPattern} -> ${rule.fix}`);
    } catch (err) {
      console.log(`  FAIL: ${errMessage(err)}`);
    }
  }
  console.log('');

  console.log('Supermemory check:');
  try {
    const store = new SupermemoryLocalStore(sm);
    await store.search('remindy health check', 1);
    console.log(`  PASS: reachable at ${sm.url}`);
  } catch (err) {
    console.log(`  FAIL: unreachable at ${sm.url} (${errMessage(err)})`);
    console.log('         hint: start it with `supermemory-server` (inside WSL2 on Windows)');
  }
  console.log('');

  // Blunt verdict so a demo never runs on isolated memory by accident.
  const backend = describeBackend();
  console.log('Active backend:');
  console.log(`  store:      ${backend.store}`);
  console.log(`  compressor: ${backend.compressor}`);
  if (!backend.supermemoryActive) {
    console.log('  ⚠ Not on Supermemory: cross-tool sharing and persistence are OFF.');
  }

  process.exitCode = 0;
}

/**
 * Seed the real store with standards inferred from THIS repo.
 *
 * Scans the repo, infers up to six taste rules (one per non-PERF tag), fills any
 * gaps from the curated starter pack, best-effort polishes wording via b.ai, and
 * stores exactly six rules. Detection is deterministic and never fails; the LLM
 * step is optional. The result: recall returns personalized standards on the very
 * first run — no correction loop required.
 */
async function seedStore(): Promise<void> {
  const sm = resolveSupermemoryConfig();
  if (!isSupermemoryConfigured(sm)) {
    console.log(
      'remindy seed: SUPERMEMORY_API_KEY not set — nothing to do ' +
        '(offline mode seeds the in-memory store automatically).',
    );
    return;
  }

  const store = new SupermemoryLocalStore(sm);
  const result = await seedFromRepo(store, process.cwd());

  console.log(
    `remindy seed: stored ${result.added} rules into Supermemory Local @ ${sm.url}` +
      (result.added < result.total ? ` (${result.total - result.added} already present)` : ''),
  );
  console.log(`  inferred from repo: ${result.inferred.length ? result.inferred.join(', ') : '(none)'}`);
  console.log(`  starter fallback:   ${result.starter.length ? result.starter.join(', ') : '(none)'}`);
}

/** Parse `--flag value` pairs into a map. Values are never logged. */
function parseFlags(args: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = next;
        i++;
      } else {
        out[key] = 'true';
      }
    }
  }
  return out;
}

/**
 * `remindy config`         — print the resolved LLM config (key presence only, never the value).
 * `remindy config set ...` — BYOK: write provider/key/model/url to the gitignored .env.
 *
 * Examples:
 *   remindy config set --provider bai --key sk-... --model claude-sonnet-5
 *   remindy config set --provider ollama --model qwen2.5-coder:3b
 */
function configCommand(sub: string | undefined, rest: string[]): void {
  if (sub === 'set') {
    const f = parseFlags(rest);
    const provider = f.provider;
    const updates: Record<string, string | undefined> = { LLM_PROVIDER: provider };
    if (provider === 'bai') {
      updates.BAI_API_KEY = f.key;
      updates.BAI_MODEL = f.model;
      updates.BAI_API_URL = f.url;
    } else if (provider === 'openai') {
      updates.OPENAI_API_KEY = f.key;
      updates.OPENAI_MODEL = f.model;
      updates.OPENAI_API_URL = f.url;
    } else if (provider === 'anthropic') {
      updates.ANTHROPIC_API_KEY = f.key;
      updates.ANTHROPIC_MODEL = f.model;
      updates.ANTHROPIC_API_URL = f.url;
    } else if (provider === 'ollama') {
      updates.OLLAMA_MODEL = f.model;
      updates.OLLAMA_URL = f.url;
    } else if (provider !== undefined) {
      console.log(`remindy config: unknown provider "${provider}" (use openai, anthropic, bai, or ollama)`);
      process.exitCode = 1;
      return;
    }
    const written = writeEnvVars(updates);
    if (written.length === 0) {
      console.log('remindy config: nothing to write (pass --provider and its --key/--model/--url).');
      return;
    }
    console.log(`remindy config: updated ${written.join(', ')} in .env`);
    console.log('  Restart the MCP server / editor so the new config is picked up.');
    return;
  }

  // Default: show current config with secrets masked.
  const llm = viewLlmConfig();
  const sm = resolveSupermemoryConfig();
  console.log('remindy config');
  console.log(`  LLM provider:  ${llm.provider}`);
  console.log(`  LLM model:     ${llm.model ?? '(unset)'}`);
  console.log(`  LLM base URL:  ${llm.baseURL ?? '(default)'}`);
  console.log(`  LLM API key:   ${llm.apiKeySet ? 'set' : 'unset'}`);
  console.log(`  Supermemory:   ${sm.url} (key ${isSupermemoryConfigured(sm) ? 'set' : 'unset'})`);
  console.log('');
  console.log('Set with:  remindy config set --provider bai --key <k> --model <m>');
}

async function main(argv: string[]): Promise<void> {
  const command = argv[0];
  const flags = argv.slice(1);
  switch (command) {
    case 'init': {
      // `remindy init --seed` is the one-command path: register + infer rules from this repo.
      const willSeed = flags.includes('--seed');
      runInit(process.cwd(), { willSeed });
      if (willSeed) {
        console.log('');
        await seedStore();
      }
      break;
    }
    case 'doctor':
      await doctor();
      break;
    case 'seed':
      await seedStore();
      break;
    case 'dashboard':
      await startDashboard();
      break;
    case 'config':
      configCommand(flags[0], flags.slice(1));
      break;
    default:
      console.log('Usage: remindy <init [--seed] | doctor | seed | dashboard | config [set ...]>');
      if (command !== undefined && command !== '--help' && command !== '-h') {
        process.exitCode = 1;
      }
  }
}

main(process.argv.slice(2)).catch((err) => {
  console.error('remindy failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
