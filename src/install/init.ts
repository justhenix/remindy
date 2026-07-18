/**
 * `remindy init`, register the remindy MCP server in detected clients + drop project rule.
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
  /**
   * Config shape. Most clients use `{ "mcpServers": { name: { command, args } } }`.
   * VS Code / Copilot uses `{ "servers": { name: { type, command, args } } }`.
   */
  format: 'mcpServers' | 'vscode';
}

const CLIENTS: McpClient[] = [
  { name: 'Kiro', detectDir: '.kiro', configPath: '.kiro/settings/mcp.json', format: 'mcpServers' },
  { name: 'Cursor', detectDir: '.cursor', configPath: '.cursor/mcp.json', format: 'mcpServers' },
  { name: 'Windsurf', detectDir: '.windsurf', configPath: '.windsurf/mcp.json', format: 'mcpServers' },
  { name: 'Antigravity', detectDir: '.agents', configPath: '.agents/mcp_config.json', format: 'mcpServers' },
  { name: 'GitHub Copilot', detectDir: '.vscode', configPath: '.vscode/mcp.json', format: 'vscode' },
  { name: 'Claude Code', detectDir: '.claude', configPath: '.mcp.json', format: 'mcpServers' },
];

/** Top-level key holding servers, and the entry shape, per client format. */
function serversKeyFor(client: McpClient): string {
  return client.format === 'vscode' ? 'servers' : 'mcpServers';
}
function serverEntryFor(client: McpClient, serverPath: string): Record<string, unknown> {
  return client.format === 'vscode'
    ? { type: 'stdio', command: 'node', args: [serverPath] }
    : { command: 'node', args: [serverPath] };
}

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
  'When the user shows any dissatisfaction with your output ("meh", "i hate it",',
  '"why are you doing that", rewording, or reverting your work), call',
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
  // This file: dist/src/install/init.js -> server: dist/src/server/index.js
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
      // Corrupt JSON, preserve nothing, overwrite.
    }
  }

  const key = serversKeyFor(client);
  const servers = (existing[key] as Record<string, unknown>) ?? {};
  servers['remindy'] = serverEntryFor(client, serverPath);
  existing[key] = servers;

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
      console.log(`  ✓ ${client.name} -> ${client.configPath}`);
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
  console.log('  Other tools (one line, config is global for these):');
  console.log(`    Codex / ChatGPT:  codex mcp add remindy -- node ${serverPath}`);
  console.log(`    Trae:  MCP settings > Add > Raw Config:  "remindy": { "command": "node", "args": ["${serverPath}"] }`);
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

// ---------------------------------------------------------------------------
// Uninstall (reverses init: strips the MCP entry and the project rule)
// ---------------------------------------------------------------------------

type RemoveStatus = 'removed' | 'absent' | 'not-configured';

/** Remove the remindy entry from one client's MCP config. */
function removeMcpConfig(projectDir: string, client: McpClient): RemoveStatus {
  const configFile = resolve(projectDir, client.configPath);
  if (!existsSync(configFile)) return 'not-configured';

  let existing: Record<string, unknown>;
  try {
    existing = JSON.parse(readFileSync(configFile, 'utf8'));
  } catch {
    return 'not-configured';
  }

  const key = serversKeyFor(client);
  const servers = existing[key] as Record<string, unknown> | undefined;
  if (!servers || !('remindy' in servers)) return 'absent';

  delete servers['remindy'];
  // Drop the servers key entirely if remindy was the only entry.
  if (Object.keys(servers).length === 0) delete existing[key];
  else existing[key] = servers;

  writeFileSync(configFile, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  return 'removed';
}

/** Strip the remindy rule block from the project's rules file, if present. */
function removeProjectRule(projectDir: string): string | null {
  for (const name of RULE_FILES) {
    const candidate = resolve(projectDir, name);
    if (!existsSync(candidate)) continue;
    const content = readFileSync(candidate, 'utf8');
    if (!content.includes(RULE_MARKER)) continue;
    writeFileSync(candidate, stripRuleBlock(content).trimEnd() + '\n', 'utf8');
    return `cleaned ${name}`;
  }
  return null;
}

/** `remindy uninstall`, removes the MCP entry and rule block. Leaves stored rules. */
export function runUninstall(projectDir: string): void {
  console.log('remindy uninstall');
  console.log('');

  console.log('MCP server:');
  let removed = 0;
  for (const client of CLIENTS) {
    const status = removeMcpConfig(projectDir, client);
    if (status === 'removed') {
      console.log(`  ✓ ${client.name}: removed from ${client.configPath}`);
      removed++;
    } else if (status === 'absent') {
      console.log(`  · ${client.name}: no remindy entry`);
    } else {
      console.log(`  · ${client.name}: not configured`);
    }
  }
  if (removed === 0) console.log('  · nothing to remove');
  console.log('');

  console.log('Project rule:');
  const ruleResult = removeProjectRule(projectDir);
  console.log(ruleResult ? `  ✓ ${ruleResult}` : '  · no remindy rule block found');
  console.log('');

  console.log('Your stored standards still live in Supermemory Local.');
  console.log('  Clear them from the dashboard for a clean slate:  npx remindy dashboard');
  console.log('  Remove the package if installed globally:         npm rm -g remindy');
  console.log('');
  console.log('Reload your editor so it drops the MCP server.');
}
