import { describe, it, expect } from 'vitest';
import type { Tag } from '../src/types.js';
import type { RichMemory } from '../src/types.js';
import type { Compressor } from '../src/capture/compressor.js';
import type { RepoReader } from '../src/infer/reader.js';
import {
  detectUi,
  detectCopy,
  detectCode,
  detectSec,
  detectCommit,
  detectReq,
} from '../src/infer/detectors.js';
import { inferRepoRules } from '../src/infer/inferrer.js';
import { mergeWithStarter } from '../src/infer/merge.js';
import { INFER_TAGS, type TasteRuleDraft } from '../src/infer/types.js';
import { polishRules } from '../src/infer/polish.js';

/** In-memory RepoReader for pure, network-free detector tests. */
class FakeReader implements RepoReader {
  constructor(
    private readonly files: Record<string, string> = {},
    private readonly commits: string[] = [],
  ) {}
  listFiles(): string[] {
    return Object.keys(this.files).sort();
  }
  readTextFile(relPath: string): string | null {
    return relPath in this.files ? this.files[relPath] : null;
  }
  gitLog(limit: number): string[] {
    return this.commits.slice(0, limit);
  }
}

describe('detectUi', () => {
  it('flags inline styles when tokens are absent', () => {
    const reader = new FakeReader({ 'src/App.tsx': 'const x = <div style={{ color: "red" }} />;' });
    expect(detectUi(reader)?.tag).toBe('UI');
    expect(detectUi(reader)?.fix).toBe('use design tokens');
  });
  it('returns null when design tokens dominate', () => {
    const reader = new FakeReader({
      'src/theme.css': ':root { --color-primary: #333; } .a { color: var(--color-primary); }',
    });
    expect(detectUi(reader)).toBeNull();
  });
});

describe('detectCopy', () => {
  it('flags AI-slop words in the README', () => {
    const reader = new FakeReader({ 'README.md': 'Unlock a seamless way to elevate your workflow.' });
    expect(detectCopy(reader)?.tag).toBe('COPY');
  });
  it('returns null for plain copy', () => {
    const reader = new FakeReader({ 'README.md': 'A small tool that stores your coding standards.' });
    expect(detectCopy(reader)).toBeNull();
  });
});

describe('detectCode', () => {
  it('flags derived-state footgun when React is a dependency', () => {
    const reader = new FakeReader({ 'package.json': JSON.stringify({ dependencies: { react: '^18.0.0' } }) });
    const draft = detectCode(reader);
    expect(draft?.tag).toBe('CODE');
    expect(draft?.fix).toBe('compute in render');
  });
  it('flags a loose tsconfig when strict is off', () => {
    const reader = new FakeReader({
      'package.json': JSON.stringify({ dependencies: {} }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { strict: false } }),
    });
    expect(detectCode(reader)?.fix).toBe('enable strict');
  });
  it('returns null for a strict, non-React project', () => {
    const reader = new FakeReader({
      'package.json': JSON.stringify({ dependencies: {} }),
      'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true } }),
    });
    expect(detectCode(reader)).toBeNull();
  });
});

describe('detectSec', () => {
  it('flags a .env not covered by .gitignore', () => {
    const reader = new FakeReader({ '.env': 'API_KEY=abc', '.gitignore': 'dist\nnode_modules' });
    expect(detectSec(reader)?.tag).toBe('SEC');
  });
  it('flags a hardcoded secret-like literal in source', () => {
    const reader = new FakeReader({
      'src/x.ts': 'const key = "sk-ABCDEF0123456789abcdef";',
    });
    expect(detectSec(reader)?.fix).toBe('env vars + gitignore');
  });
  it('returns null when .env is gitignored and no secrets in source', () => {
    const reader = new FakeReader({ '.env': 'API_KEY=abc', '.gitignore': '.env\ndist' });
    expect(detectSec(reader)).toBeNull();
  });
});

describe('detectCommit', () => {
  it('flags a mostly non-conventional git log', () => {
    const reader = new FakeReader({}, ['fix stuff', 'wip', 'more changes', 'feat(x): add thing']);
    expect(detectCommit(reader)?.tag).toBe('COMMIT');
  });
  it('returns null for a conventional log', () => {
    const reader = new FakeReader({}, ['feat(a): x', 'fix(b): y', 'chore: z']);
    expect(detectCommit(reader)).toBeNull();
  });
  it('returns null when there is no git history', () => {
    expect(detectCommit(new FakeReader({}, []))).toBeNull();
  });
});

describe('detectReq', () => {
  it('flags spec-first repos with a .kiro/specs artifact', () => {
    const reader = new FakeReader({ '.kiro/specs/foo/requirements.md': '# reqs' });
    expect(detectReq(reader)?.tag).toBe('REQ');
  });
  it('returns null when no spec/requirements files exist', () => {
    expect(detectReq(new FakeReader({ 'src/x.ts': 'x' }))).toBeNull();
  });
});

describe('inferRepoRules', () => {
  it('is deterministic across repeated runs on the same repo', () => {
    const reader = new FakeReader(
      { 'README.md': 'Seamless unlock.', 'src/App.tsx': 'style={{}}' },
      ['wip'],
    );
    expect(inferRepoRules(reader)).toEqual(inferRepoRules(reader));
  });
  it('never contains PERF and never more than one draft per tag', () => {
    const reader = new FakeReader({ 'README.md': 'unlock' }, ['wip']);
    const drafts = inferRepoRules(reader);
    expect(drafts.has('PERF' as Tag)).toBe(false);
    for (const [tag, draft] of drafts) {
      expect(draft.tag).toBe(tag);
    }
  });
});

describe('mergeWithStarter', () => {
  it('always yields exactly six rules, one per non-PERF tag', () => {
    const merged = mergeWithStarter(new Map());
    expect(merged).toHaveLength(6);
    expect(merged.map((r) => r.tag).sort()).toEqual([...INFER_TAGS].sort());
    expect(merged.some((r) => r.tag === 'PERF')).toBe(false);
  });
  it('uses the inferred rule where present and starter fallback otherwise', () => {
    const drafts = new Map<Tag, TasteRuleDraft>([
      ['UI', { tag: 'UI', antiPattern: 'inline styles', fix: 'use tokens' }],
    ]);
    const merged = mergeWithStarter(drafts);
    const ui = merged.find((r) => r.tag === 'UI');
    const copy = merged.find((r) => r.tag === 'COPY');
    expect(ui?.id).toBe('inferred-ui');
    expect(ui?.fix).toBe('use tokens');
    expect(copy?.id).toBe('starter-copy-slop');
  });
  it('is deterministic (fixed ids + createdAt) for the same drafts', () => {
    const drafts = new Map<Tag, TasteRuleDraft>([['SEC', { tag: 'SEC', antiPattern: 'a', fix: 'b' }]]);
    expect(mergeWithStarter(drafts)).toEqual(mergeWithStarter(drafts));
  });
});

describe('polishRules', () => {
  const inferred: RichMemory = {
    id: 'inferred-ui',
    tag: 'UI',
    antiPattern: 'inline styles',
    fix: 'use design tokens',
    burns: 1,
    createdAt: '2024-01-01T00:00:00.000Z',
  };
  const starter: RichMemory = {
    id: 'starter-copy-slop',
    tag: 'COPY',
    antiPattern: '"unlock" slop',
    fix: 'plain verbs',
    burns: 2,
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  it('returns rules unchanged when polisher is null', async () => {
    const rules = [{ ...inferred }];
    expect(await polishRules(rules, null)).toEqual(rules);
  });

  it('rewords inferred rules but never starter rules', async () => {
    const polisher: Compressor = {
      async compress(_m, tag) {
        return { tag: tag as Tag, antiPattern: 'reworded', fix: 'reworded fix' };
      },
    };
    const out = await polishRules([{ ...inferred }, { ...starter }], polisher);
    expect(out[0].antiPattern).toBe('reworded');
    expect(out[1].antiPattern).toBe('"unlock" slop'); // starter untouched
  });

  it('keeps deterministic text when the polisher changes the tag', async () => {
    const polisher: Compressor = {
      async compress() {
        return { tag: 'SEC', antiPattern: 'wrong', fix: 'wrong' };
      },
    };
    const out = await polishRules([{ ...inferred }], polisher);
    expect(out[0].tag).toBe('UI');
    expect(out[0].antiPattern).toBe('inline styles');
  });

  it('keeps deterministic text when the polisher throws', async () => {
    const polisher: Compressor = {
      async compress() {
        throw new Error('network down');
      },
    };
    const out = await polishRules([{ ...inferred }], polisher);
    expect(out[0].fix).toBe('use design tokens');
  });
});
