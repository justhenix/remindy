/**
 * `remindy init` — register the remindy MCP server in detected clients + drop project rule.
 *
 * Detects MCP-capable editors by their config directories, writes/merges
 * the remindy server entry into each client's mcp.json, and appends a
 * one-line project rule telling agents to call remindy_recall.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ---------------------------------------------------------------------------
// MCP client definitions
// ---------------------------------------------------------------------------

interface McpClient {
  name: string;
  /** Directory whose existence signals the client is in use. */
  detectDir: string;
  /** Path to the MCP config file, relative to project root. */
  configPath: string;
}

const CLIENTS: McpClient[] = [
  { name: 'Kiro', detectDir: '.kiro', configPath: '.kiro/settings/mcp.json' },
  { name: 'Cursor', detectDir: '.cursor', configPath: '.cursor/mcp.json' },
  { name: 'Windsurf', detectDir: '.windsurf', configPath: '.windsurf/mcp.json' },
  { name: 'Antigravity', detectDir: '.agents', configPath: '.agents/mcp_config.json' },
];

// All supported clients use { "mcpServers": { ... } } format.
const SERVERS_KEY = 'mcpServers';

// ---------------------------------------------------------------------------
// Project rule
// ---------------------------------------------------------------------------

const RULE_MARKER = '<!-- remindy -->';
const RULE_END_MARKER = '<!-- /remindy -->';
const RULE_SECTION = [
  '',
  `${RULE_MARKER}`,
  '## remindy',
  'Before writing or editing code, call the `remindy_recall` MCP tool.',
  'When the user shows any dissatisfaction with your output — "meh", "i hate it",',
  '"why are you doing that", rewording your text, or reverting your work — call',
  '`remindy_capture` with the anti-pattern and the fix. Catch the taste yourself;',
  "don't wait to be told to remember it.",
  `${RULE_END_MARKER}`,
].join('\n');

/** Remove an existing remindy block so a fresh one can replace it. */
function stripRuleBlock(content: string): string {
  const start = content.indexOf(RULE_MARKER);
  if (start === -1) return content;
  const endIdx = content.indexOf(RULE_END_MARKER, start);
  // Old installs have no end marker; the block was appended last, so drop to EOF.
  const end = endIdx === -1 ? content.length : endIdx + RULE_END_MARKER.length;
  return (content.slice(0, start) + content.slice(end)).trimEnd();
}

/** Rule files checked in preference order. First found wins. */
const RULE_FILES = ['AGENTS.md', 'CLAUDE.md', '.cursorrules'];

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/** Absolute path to the compiled MCP server entry point. */
function resolveServerPath(): string {
  // This file: dist/src/install/init.js → server: dist/src/server/index.js
  return resolve(import.meta.dirname, '../server/index.js').replace(/\\/g, '/');
}

/**
 * Write (or merge) the remindy entry into a client's MCP config.
 * Returns true if the config was written, false if client not detected.
 */
function writeMcpConfig(
  projectDir: string,
  client: McpClient,
  serverPath: string,
): boolean {
  if (!existsSync(resolve(projectDir, client.detectDir))) {
    return false;
  }

  const configFile = resolve(projectDir, client.configPath);
  let existing: Record<string, unknown> = {};

  if (existsSync(configFile)) {
    try {
      existing = JSON.parse(readFileSync(configFile, 'utf8'));
    } catch {
      // Corrupt JSON — preserve nothing, overwrite.
    }
  }

  const servers = (existing[SERVERS_KEY] as Record<string, unknown>) ?? {};
  servers['remindy'] = {
    command: 'node',
    args: [serverPath],
  };
  existing[SERVERS_KEY] = servers;

  mkdirSync(dirname(configFile), { recursive: true });
  writeFileSync(configFile, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  return true;
}

/**
 * Append the one-line remindy rule to the project's agent rules file.
 * Returns a human-readable status string.
 */
function dropProjectRule(projectDir: string): string {
  // Find first existing rule file.
  let ruleFile: string | undefined;
  for (const name of RULE_FILES) {
    const candidate = resolve(projectDir, name);
    if (existsSync(candidate)) {
      ruleFile = candidate;
      break;
    }
  }

  // Default to AGENTS.md if none found.
  if (!ruleFile) {
    ruleFile = resolve(projectDir, 'AGENTS.md');
  }

  const relName = ruleFile.replace(projectDir, '').replace(/^[\\/]/, '');

  if (existsSync(ruleFile)) {
    const content = readFileSync(ruleFile, 'utf8');
    const hadRule = content.includes(RULE_MARKER);
    const cleaned = stripRuleBlock(content);
    writeFileSync(ruleFile, cleaned.trimEnd() + '\n' + RULE_SECTION + '\n', 'utf8');
    return hadRule ? `refreshed ${relName}` : `added ${relName}`;
  }

  writeFileSync(ruleFile, RULE_SECTION.trimStart() + '\n', 'utf8');
  return `added ${relName}`;
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export interface InitOptions {
  /** When true, `remindy seed` runs right after init, so callers can adjust guidance. */
  willSeed?: boolean;
}

export function runInit(projectDir: string, opts: InitOptions = {}): void {
  const serverPath = resolveServerPath();

  console.log('remindy init');
  console.log('');

  // 1. MCP registration
  console.log('MCP server registration:');
  let registered = 0;
  for (const client of CLIENTS) {
    if (writeMcpConfig(projectDir, client, serverPath)) {
      console.log(`  ✓ ${client.name} → ${client.configPath}`);
      registered++;
    } else {
      console.log(`  · ${client.name}: not detected, skipped`);
    }
  }
  if (registered === 0) {
    console.log('  ⚠ No supported clients detected.');
    console.log('    Manually add to your client\'s MCP config:');
    console.log(`    { "command": "node", "args": ["${serverPath}"] }`);
  }
  console.log('');

  // 2. Project rule
  console.log('Project rule:');
  const ruleResult = dropProjectRule(projectDir);
  console.log(`  ✓ ${ruleResult}`);
  console.log('');

  // 3. Supermemory guidance. The shared store makes cross-tool persistence real.
  console.log('Supermemory Local (the shared store, required for cross-tool persistence):');
  console.log('  Without it, memory is per-editor and forgotten on restart.');
  console.log('  Start it (Unix binary; use WSL2 on Windows):');
  console.log('    curl -fsSL https://supermemory.ai/install | bash');
  if (!opts.willSeed) {
    console.log('  Then seed rules inferred from THIS repo:');
    console.log('    npx remindy seed');
  }
  console.log('');

  // 4. How you actually use it. remindy is invisible infra, not a CLI you keep running.
  console.log('How you use it:');
  console.log('  remindy is not a CLI you run. Your editor spawns its MCP server for you.');
  console.log('  1. Restart / reload your editor so it picks up the new MCP server.');
  console.log('  2. Just code with your AI agent. It now calls remindy_recall before');
  console.log('     writing, and remindy_capture when you correct it.');
  console.log('  3. See and edit your rules any time:  npx remindy dashboard');
  console.log('');
  console.log('Verify the backend (proves you are on Supermemory, not isolated memory):');
  console.log('  npx remindy doctor');
  console.log('');
  console.log(`Server: ${serverPath}`);
}
