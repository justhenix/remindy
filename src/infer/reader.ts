import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * The I/O boundary for repo inference. Detectors depend on this interface only,
 * so they stay pure and fully unit-testable with an in-memory fake reader.
 *
 * Two implementations exist (NodeRepoReader + the test fake), which justifies the
 * interface: it hides the unstable fs / git boundary behind stable, typed data.
 */
export interface RepoReader {
  /** Repo-relative file paths, excluding heavy/vendored dirs, sorted for determinism. */
  listFiles(): string[];
  /** UTF-8 text of a repo-relative file, or null if it is missing or unreadable. */
  readTextFile(relPath: string): string | null;
  /** Recent commit subject lines (newest first), or [] when git is unavailable. */
  gitLog(limit: number): string[];
}

/** Directories we never walk — vendored, generated, or VCS internals. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.astro', '.supermemory']);

/** Cap the walk so a huge repo can't make seed pathologically slow. */
const MAX_FILES = 5000;

/**
 * Real reader over the local filesystem + git. Every operation is best-effort:
 * unreadable files resolve to null and an unavailable git resolves to [], so a
 * detector never throws just because the repo is missing something.
 */
export class NodeRepoReader implements RepoReader {
  constructor(private readonly root: string) {}

  private cachedFiles: string[] | null = null;

  listFiles(): string[] {
    if (this.cachedFiles) {
      return this.cachedFiles;
    }
    const out: string[] = [];
    this.walk(this.root, out);
    // Normalize separators to '/' and sort so repeated runs are identical.
    this.cachedFiles = out.map((p) => relative(this.root, p).split(sep).join('/')).sort();
    return this.cachedFiles;
  }

  private walk(dir: string, out: string[]): void {
    if (out.length >= MAX_FILES) {
      return;
    }
    let entries: import('node:fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= MAX_FILES) {
        return;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          this.walk(full, out);
        }
      } else if (entry.isFile()) {
        out.push(full);
      }
    }
  }

  readTextFile(relPath: string): string | null {
    try {
      const full = join(this.root, relPath);
      // Guard against reading a large binary as text.
      if (statSync(full).size > 512 * 1024) {
        return null;
      }
      return readFileSync(full, 'utf8');
    } catch {
      return null;
    }
  }

  gitLog(limit: number): string[] {
    try {
      const out = execFileSync('git', ['log', '--pretty=%s', '-n', String(limit)], {
        cwd: this.root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return out
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    } catch {
      return [];
    }
  }
}
