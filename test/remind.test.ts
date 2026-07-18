import { describe, it, expect } from 'vitest';
import type { RichMemory } from '../src/types.js';
import type { LlmConfig } from '../src/config/index.js';
import { InMemoryStore } from '../src/memory/in-memory-store.js';
import { TemplateCompressor } from '../src/capture/template-compressor.js';
import { LlmCompressor, type OpenAiLike } from '../src/capture/llm-compressor.js';
import { capture, renderCaveman } from '../src/capture/capture.js';
import { recall } from '../src/recall/recall.js';
import { seed } from '../src/starter/pack.js';

async function freshStore(): Promise<InMemoryStore> {
  return new InMemoryStore();
}

/** Build a mock openai-compatible client that returns a fixed completion string. */
function mockClient(content: string | null, onCall?: () => void): OpenAiLike {
  return {
    chat: {
      completions: {
        create: async () => {
          onCall?.();
          return { choices: [{ message: { content } }] };
        },
      },
    },
  };
}

const TEST_LLM_CONFIG: LlmConfig = {
  provider: 'openai',
  baseURL: 'https://example.invalid/',
  apiKey: 'test-key',
  model: 'test-model',
};

describe('recall over the starter pack', () => {
  it('returns a relevant rule and stays within the token budget', async () => {
    const store = await freshStore();
    await seed(store);

    const result = await recall(store, 'styling a react component');

    expect(result.rules.length).toBeGreaterThan(0);
    // The UI styling rule should be the most relevant hit.
    expect(result.rules[0]).toContain('[UI]');
    expect(result.rules[0]).toContain('reuse');
    expect(result.tokens).toBeLessThanOrEqual(100);
  });
});

describe('capture + dedup', () => {
  it('creates a rule, then increments burns on a near-duplicate', async () => {
    const store = await freshStore();
    const compressor = new TemplateCompressor();

    const first = await capture(
      store,
      compressor,
      "commit message 'fix stuff' → use conventional commits",
      'COMMIT',
    );
    expect(first.burns).toBe(1);
    expect(first.caveman).toContain('[COMMIT]');
    expect(first.caveman).toContain('(×1)');

    // Near-duplicate: different case + punctuation, same meaning.
    const second = await capture(
      store,
      compressor,
      'Commit message: fix stuff -> use conventional commits!!',
      'COMMIT',
    );
    expect(second.id).toBe(first.id);
    expect(second.burns).toBe(2);
    expect(second.caveman).toContain('(×2)');

    // Only one rule should exist after dedup.
    const all = await store.all();
    expect(all).toHaveLength(1);
  });

  it('merges a re-worded anti-pattern that shares the same fix', async () => {
    const store = await freshStore();
    const compressor = new TemplateCompressor();

    const first = await capture(store, compressor, 'var keyword → use const or let', 'CODE');
    // Different anti-pattern wording, same fix — semantically the same mistake.
    const second = await capture(store, compressor, 'var for variables → use const or let', 'CODE');

    expect(second.id).toBe(first.id);
    expect(second.burns).toBe(2);
    expect(await store.all()).toHaveLength(1);
  });

  it('keeps genuinely distinct rules in the same tag separate', async () => {
    const store = await freshStore();
    const compressor = new TemplateCompressor();

    await capture(store, compressor, 'var keyword → use const or let', 'CODE');
    await capture(store, compressor, 'console.log in production → remove debug logs', 'CODE');

    expect(await store.all()).toHaveLength(2);
  });
});

describe('recall via store.search: burn weight affects ranking', () => {
  it('ranks a high-burn rule above an equally-relevant low-burn rule', async () => {
    const store = await freshStore();
    const compressor = new TemplateCompressor();

    // Build a high-burn rule via repeated capture (1 -> 3).
    await capture(store, compressor, 'slow endpoint → add caching', 'PERF');
    await capture(store, compressor, 'slow endpoint → add caching', 'PERF');
    const high = await capture(store, compressor, 'slow endpoint → add caching', 'PERF');
    expect(high.burns).toBe(3);

    // Add an equally-relevant competitor with the same text but burns = 1.
    const competitor: RichMemory = {
      id: 'competitor',
      tag: 'PERF',
      antiPattern: 'slow endpoint',
      fix: 'add caching',
      burns: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
    };
    await store.add(competitor);

    const result = await recall(store, 'slow endpoint');

    expect(result.rules[0]).toContain('(×3)');
    expect(result.rules.indexOf(renderCaveman(competitor))).toBeGreaterThan(0);
  });
});

describe('TemplateCompressor', () => {
  it('splits an arrow input into a non-empty antiPattern and fix', async () => {
    const compressor = new TemplateCompressor();
    const out = await compressor.compress('inline styles → use design tokens', 'UI');

    expect(out.tag).toBe('UI');
    expect(out.antiPattern).toBe('inline styles');
    expect(out.fix).toBe('use design tokens');
    expect(out.fix.length).toBeGreaterThan(0);
  });

  it('always produces a non-empty fix, even without an arrow', async () => {
    const compressor = new TemplateCompressor();
    const out = await compressor.compress('vague commit message', 'COMMIT');

    expect(out.antiPattern.length).toBeGreaterThan(0);
    expect(out.fix.length).toBeGreaterThan(0);
  });
});

describe('LlmCompressor (mocked client, no network)', () => {
  it('parses strict JSON from the model', async () => {
    const client = mockClient(
      JSON.stringify({ tag: 'UI', antiPattern: 'inline styles', fix: 'use design tokens' }),
    );
    const compressor = new LlmCompressor(TEST_LLM_CONFIG, { client });

    const out = await compressor.compress('you used inline styles');
    expect(out.tag).toBe('UI');
    expect(out.antiPattern).toBe('inline styles');
    expect(out.fix).toBe('use design tokens');
  });

  it('strips ```json code fences before parsing', async () => {
    const fenced =
      '```json\n{"tag":"SEC","antiPattern":"secrets in code","fix":"use env vars"}\n```';
    const compressor = new LlmCompressor(TEST_LLM_CONFIG, { client: mockClient(fenced) });

    const out = await compressor.compress('committed an API key');
    expect(out.tag).toBe('SEC');
    expect(out.fix).toBe('use env vars');
  });

  it('honors the caller-provided tag over the model tag', async () => {
    const client = mockClient(
      JSON.stringify({ tag: 'CODE', antiPattern: 'x', fix: 'do y' }),
    );
    const compressor = new LlmCompressor(TEST_LLM_CONFIG, { client });

    const out = await compressor.compress('something', 'PERF');
    expect(out.tag).toBe('PERF');
  });

  it('falls back to the template compressor on invalid JSON', async () => {
    let templateUsed = false;
    const fallback = {
      async compress() {
        templateUsed = true;
        return { tag: 'REQ' as const, antiPattern: 'a', fix: 'b' };
      },
    };
    const compressor = new LlmCompressor(TEST_LLM_CONFIG, {
      client: mockClient('not json at all'),
      fallback,
    });

    const out = await compressor.compress('some correction');
    expect(templateUsed).toBe(true);
    expect(out.tag).toBe('REQ');
  });

  it('falls back when the model omits a concrete fix', async () => {
    // fix is MANDATORY — an empty fix must trigger the fallback.
    const client = mockClient(JSON.stringify({ tag: 'UI', antiPattern: 'inline styles', fix: '' }));
    const realFallback = new TemplateCompressor();
    const compressor = new LlmCompressor(TEST_LLM_CONFIG, { client, fallback: realFallback });

    const out = await compressor.compress('inline styles → use design tokens', 'UI');
    expect(out.fix.length).toBeGreaterThan(0);
    expect(out.fix).toBe('use design tokens'); // came from the template fallback
  });

  it('falls back when the client throws (network/auth failure)', async () => {
    const throwingClient: OpenAiLike = {
      chat: {
        completions: {
          create: async () => {
            throw new Error('network down');
          },
        },
      },
    };
    const compressor = new LlmCompressor(TEST_LLM_CONFIG, {
      client: throwingClient,
      fallback: new TemplateCompressor(),
    });

    const out = await compressor.compress('vague commit message', 'COMMIT');
    expect(out.antiPattern.length).toBeGreaterThan(0);
    expect(out.fix.length).toBeGreaterThan(0);
  });
});

describe('token budget', () => {
  it('caps returned rules within the ~100 token budget even with many rules', async () => {
    const store = await freshStore();
    for (let i = 0; i < 50; i++) {
      await store.add({
        id: `perf-${i}`,
        tag: 'PERF',
        antiPattern: `slow query ${i}`,
        fix: 'add an index',
        context: 'database performance latency',
        burns: 1,
        createdAt: '2024-01-01T00:00:00.000Z',
      });
    }

    const result = await recall(store, 'slow database query performance');

    expect(result.tokens).toBeLessThanOrEqual(100);
    expect(result.rules.length).toBeLessThan(50);
  });
});

describe('delete rule', () => {
  it('removes a rule from the store by ID', async () => {
    const store = new InMemoryStore();
    const rule: RichMemory = {
      id: 'test-delete-id',
      tag: 'UI',
      antiPattern: 'inline styles',
      fix: 'use design tokens',
      burns: 1,
      createdAt: new Date().toISOString(),
    };
    await store.add(rule);
    expect(await store.all()).toHaveLength(1);

    await store.delete('test-delete-id');
    expect(await store.all()).toHaveLength(0);
  });
});
