import type { Tag } from '../types.js';
import type { RepoReader } from './reader.js';
import type { Detector, TasteRuleDraft } from './types.js';

/**
 * One deterministic detector per non-PERF tag. Each is pure over the RepoReader:
 * it returns a draft when its repo signal is present, else null (which merge
 * resolves to the curated starter rule for that tag).
 *
 * Detection text is intentionally terse and mirrors the starter pack wording, so
 * an inferred rule reads consistently with the taste pack. The b.ai polish step
 * may later reword it; the detection outcome (which tag, which slot) is fixed here.
 */

/** Only look at files with these extensions when scanning source text. */
const TEXT_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.html', '.md', '.astro'];

function hasExt(path: string, exts: string[]): boolean {
  return exts.some((ext) => path.toLowerCase().endsWith(ext));
}

/** UI: inline styles present without design tokens. */
export const detectUi: Detector = (reader) => {
  const styleFiles = reader.listFiles().filter((f) => hasExt(f, ['.tsx', '.jsx', '.html', '.css', '.scss', '.astro']));
  let inlineHits = 0;
  let tokenHits = 0;
  for (const file of styleFiles) {
    const text = reader.readTextFile(file);
    if (text === null) {
      continue;
    }
    // JSX inline style prop, or HTML style="" attribute.
    if (/style=\{\{/.test(text) || /style\s*=\s*["']/.test(text)) {
      inlineHits++;
    }
    // Design-token signals: CSS custom properties or a var() reference.
    if (/--[a-z][\w-]*\s*:/.test(text) || /var\(--/.test(text)) {
      tokenHits++;
    }
  }
  // Signal only when inline styling dominates and tokens are not established.
  if (inlineHits > 0 && inlineHits > tokenHits) {
    return {
      tag: 'UI',
      antiPattern: 'bespoke UI instead of the design system',
      fix: 'reuse tokens + components',
      context: 'ui styling react components css design system tokens reuse consistency accessibility',
    };
  }
  return null;
};

/** COPY: AI-slop marketing words in README or user-facing strings. */
const SLOP_WORDS = [
  'unlock',
  'seamless',
  'seamlessly',
  'elevate',
  'revolutionize',
  'revolutionary',
  'supercharge',
  'game-changer',
  'game changer',
  'cutting-edge',
  'effortless',
  'unleash',
  'delve',
  'robust',
  'leverage',
  'tapestry',
  'testament',
  'boasts',
  'ever-evolving',
];

export const detectCopy: Detector = (reader) => {
  const copyFiles = reader
    .listFiles()
    .filter((f) => /readme/i.test(f) || hasExt(f, ['.md', '.html', '.tsx', '.jsx', '.astro']));
  const found = new Set<string>();
  for (const file of copyFiles) {
    const text = reader.readTextFile(file);
    if (text === null) {
      continue;
    }
    const lower = text.toLowerCase();
    for (const word of SLOP_WORDS) {
      if (new RegExp(`\\b${word.replace(/[-\s]/g, '[-\\s]')}\\b`).test(lower)) {
        found.add(word.split(/[-\s]/)[0]);
      }
    }
  }
  if (found.size > 0) {
    return {
      tag: 'COPY',
      antiPattern: '"delve/seamless/robust" LLM slop',
      fix: 'plain, concrete language',
      context: 'copywriting marketing llm ai slop words tone voice headline microcopy',
    };
  }
  return null;
};

/** CODE: a loose tsconfig (strict off) is the one statically-detectable signal. */
export const detectCode: Detector = (reader) => {
  const tsconfig = reader.readTextFile('tsconfig.json');
  if (tsconfig !== null) {
    // Strict off (or absent) in a TS project → recommend enabling it.
    const strictOn = /"strict"\s*:\s*true/.test(tsconfig);
    if (!strictOn) {
      return {
        tag: 'CODE',
        antiPattern: 'loose tsconfig',
        fix: 'enable strict',
        context: 'typescript compiler strict type safety',
      };
    }
  }
  return null;
};

/** SEC: secret-like literals in source, or a .env not covered by .gitignore. */
const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9]{16,}\b/, // OpenAI-style keys
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key id
  /\bghp_[A-Za-z0-9]{20,}\b/, // GitHub personal token
  /(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9\-_]{16,}["']/i,
];

export const detectSec: Detector = (reader) => {
  const files = reader.listFiles();

  // .env present but not ignored is a real leak risk.
  const hasEnv = files.some((f) => f === '.env' || f.endsWith('/.env'));
  if (hasEnv) {
    const gitignore = reader.readTextFile('.gitignore') ?? '';
    const envIgnored = /(^|\n)\s*\.env\b/.test(gitignore) || /(^|\n)\s*\*\.env\b/.test(gitignore);
    if (!envIgnored) {
      return {
        tag: 'SEC',
        antiPattern: 'secrets in code',
        fix: 'env vars + gitignore',
        context: 'security api key password token credentials env',
      };
    }
  }

  // Scan source for hardcoded secret-like literals.
  const sourceFiles = files.filter((f) => hasExt(f, ['.ts', '.tsx', '.js', '.jsx']) && !f.includes('.env'));
  for (const file of sourceFiles) {
    const text = reader.readTextFile(file);
    if (text === null) {
      continue;
    }
    if (SECRET_PATTERNS.some((re) => re.test(text))) {
      return {
        tag: 'SEC',
        antiPattern: 'secrets in code',
        fix: 'env vars + gitignore',
        context: 'security api key password token credentials env',
      };
    }
  }
  return null;
};

/** Conventional-commit prefix, e.g. `feat(scope): ...` or `fix!: ...`. */
const CONVENTIONAL = /^(feat|fix|chore|docs|refactor|test|style|perf|build|ci|revert)(\(.+\))?!?:\s/;

/** COMMIT: majority of recent commits are not conventional. */
export const detectCommit: Detector = (reader) => {
  const log = reader.gitLog(50);
  if (log.length === 0) {
    return null;
  }
  const conventional = log.filter((subject) => CONVENTIONAL.test(subject)).length;
  // Signal when fewer than half the commits follow the convention.
  if (conventional * 2 < log.length) {
    return {
      tag: 'COMMIT',
      antiPattern: 'one giant, vague commit',
      fix: 'small, conventional: type(scope): msg',
      context: 'git commit message convention atomic scope',
    };
  }
  return null;
};

/** REQ: spec/requirements artifacts present → the team works spec-first. */
export const detectReq: Detector = (reader) => {
  const files = reader.listFiles();
  const hasSpecs = files.some(
    (f) =>
      f.startsWith('.kiro/specs/') ||
      /(^|\/)requirements[^/]*\.md$/i.test(f) ||
      /(^|\/)(design|spec|specs)\.md$/i.test(f) ||
      f.startsWith('docs/'),
  );
  if (hasSpecs) {
    return {
      tag: 'REQ',
      antiPattern: 'gold-plating beyond the ask',
      fix: "build only what's specced; ask first",
      context: 'yagni scope requirements speculative over-engineering unrequested spec',
    };
  }
  return null;
};

/** All detectors, keyed by their tag. Iterated in INFER_TAGS order by the inferrer. */
export const DETECTORS: ReadonlyMap<Tag, Detector> = new Map<Tag, Detector>([
  ['UI', detectUi],
  ['COPY', detectCopy],
  ['CODE', detectCode],
  ['SEC', detectSec],
  ['COMMIT', detectCommit],
  ['REQ', detectReq],
]);

export type { TasteRuleDraft };
