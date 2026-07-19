/**
 * `remindy init`, register the remindy MCP server in detected clients + drop project rule.
 *
 * Detects MCP-capable editors by their config directories, writes/merges
 * the remindy server entry into each client's mcp.json, and appends a
 * one-line project rule telling agents to call remindy_recall.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

/** User's home directory, resolved once. */
const HOME = homedir();

/**
 * VS Code's per-user config directory, where the user-profile `mcp.json` lives.
 * Windows: %APPDATA%\Code\User ; macOS: ~/Library/Application Support/Code/User ;
 * Linux: ~/.config/Code/User.
 */
function vscodeUserDir(): string {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA ?? resolve(HOME, 'AppData/Roaming');
    return resolve(appData, 'Code/User');
  }
  if (process.platform === 'darwin') {
    return resolve(HOME, 'Library/Application Support/Code/User');
  }
  return resolve(HOME, '.config/Code/User');
}

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
  /**
   * Absolute path whose existence signals the client is installed for this user.
   * Used to decide whether to register remindy at the user/global level so that
   * EVERY workspace (including brand-new empty folders) picks it up.
   */
  globalDetect: string;
  /** Absolute path to the client's user-level MCP config file. */
  globalConfig: string;
}

const CLIENTS: McpClient[] = [
  {
    name: 'Kiro',
    detectDir: '.kiro',
    configPath: '.kiro/settings/mcp.json',
    format: 'mcpServers',
    globalDetect: resolve(HOME, '.kiro'),
    globalConfig: resolve(HOME, '.kiro/settings/mcp.json'),
  },
  {
    name: 'Cursor',
    detectDir: '.cursor',
    configPath: '.cursor/mcp.json',
    format: 'mcpServers',
    globalDetect: resolve(HOME, '.cursor'),
    globalConfig: resolve(HOME, '.cursor/mcp.json'),
  },
  {
    name: 'Windsurf',
    detectDir: '.windsurf',
    configPath: '.windsurf/mcp.json',
    format: 'mcpServers',
    globalDetect: resolve(HOME, '.codeium/windsurf'),
    globalConfig: resolve(HOME, '.codeium/windsurf/mcp_config.json'),
  },
  {
    // Antigravity reads workspace `.agents/mcp_config.json` AND global
    // `~/.gemini/config/mcp_config.json`. The global one is what makes a fresh
    // folder work without running init inside it.
    name: 'Antigravity',
    detectDir: '.agents',
    configPath: '.agents/mcp_config.json',
    format: 'mcpServers',
    globalDetect: resolve(HOME, '.gemini'),
    globalConfig: resolve(HOME, '.gemini/config/mcp_config.json'),
  },
  {
    // VS Code Copilot reads workspace `.vscode/mcp.json` AND the user-profile
    // `mcp.json` (Windows: %APPDATA%\Code\User\mcp.json).
    name: 'GitHub Copilot',
    detectDir: '.vscode',
    configPath: '.vscode/mcp.json',
    format: 'vscode',
    globalDetect: vscodeUserDir(),
    globalConfig: resolve(vscodeUserDir(), 'mcp.json'),
  },
  {
    // Claude Code stores user-scope servers in ~/.claude.json (mcpServers).
    name: 'Claude Code',
    detectDir: '.claude',
    configPath: '.mcp.json',
    format: 'mcpServers',
    globalDetect: resolve(HOME, '.claude.json'),
    globalConfig: resolve(HOME, '.claude.json'),
  },
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
  '## remindy (MCP tools, always use them)',
  'These are MCP tools, not files. Call the tool directly; do NOT explore the repo or create skills.',
  '',
  '1. Before writing or editing ANY code, first call the `remindy_recall` tool and follow what it returns.',
  '2. Call the `remindy_capture` tool with the user\'s exact words when they:',
  '   - say "remindy add ...", "remember ...", "capture ...", "always ...", or "never ...", or',
  '   - correct or dislike your output ("no", "meh", "why are you doing that", reword, or revert).',
  '',
  'Never save a standard by editing AGENTS.md, config, or any rule file yourself. That only',
  'works in one tool. `remindy_capture` is the only thing that shares it across every editor.',
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
 * Write (or merge) the remindy entry into a client's USER-LEVEL MCP config.
 * This is what makes remindy available in every workspace, including fresh
 * empty folders, with no per-folder init. Only runs for clients that are
 * actually installed (detected via `globalDetect`).
 * Returns true if written, false if the client is not installed.
 */
function writeGlobalMcpConfig(client: McpClient, serverPath: string): boolean {
  if (!existsSync(client.globalDetect)) {
    return false;
  }

  const configFile = client.globalConfig;
  let existing: Record<string, unknown> = {};

  if (existsSync(configFile)) {
    try {
      const raw = readFileSync(configFile, 'utf8').trim();
      // Empty files are common (e.g. Antigravity ships an empty global config).
      if (raw) existing = JSON.parse(raw);
    } catch {
      // Corrupt JSON: preserve nothing, overwrite with a valid config.
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

  // 1. Global (user-level) registration. This is the important one: it makes
  //    remindy available in EVERY workspace, including brand-new empty folders,
  //    with no per-folder init. Only installed clients are touched.
  console.log('MCP server registration (user-level, applies to every folder):');
  let globalRegistered = 0;
  for (const client of CLIENTS) {
    if (writeGlobalMcpConfig(client, serverPath)) {
      console.log(`  ✓ ${client.name} -> ${client.globalConfig}`);
      globalRegistered++;
    } else {
      console.log(`  · ${client.name}: not installed, skipped`);
    }
  }
  if (globalRegistered === 0) {
    console.log('  ⚠ No supported clients detected on this machine.');
    console.log('    Manually add to your client\'s MCP config:');
    console.log(`    { "command": "node", "args": ["${serverPath}"] }`);
  } else {
    console.log('  Restart your editor so it loads the server; new folders inherit it.');
  }
  console.log('');

  // 2. Workspace registration for THIS repo (a booster; not required now that
  //    the server is registered globally, but harmless and explicit).
  console.log('MCP server registration (this workspace):');
  let registered = 0;
  for (const client of CLIENTS) {
    if (writeMcpConfig(projectDir, client, serverPath)) {
      console.log(`  ✓ ${client.name} -> ${client.configPath}`);
      registered++;
    } else {
      console.log(`  · ${client.name}: not used here, skipped`);
    }
  }
  if (registered === 0) {
    console.log('  · no client folders in this workspace (that is fine, global covers it)');
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

/** Remove the remindy entry from one client's USER-LEVEL MCP config. */
function removeGlobalMcpConfig(client: McpClient): RemoveStatus {
  const configFile = client.globalConfig;
  if (!existsSync(configFile)) return 'not-configured';

  let existing: Record<string, unknown>;
  try {
    const raw = readFileSync(configFile, 'utf8').trim();
    if (!raw) return 'not-configured';
    existing = JSON.parse(raw);
  } catch {
    return 'not-configured';
  }

  const key = serversKeyFor(client);
  const servers = existing[key] as Record<string, unknown> | undefined;
  if (!servers || !('remindy' in servers)) return 'absent';

  delete servers['remindy'];
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

  console.log('MCP server (user-level):');
  let removed = 0;
  for (const client of CLIENTS) {
    const status = removeGlobalMcpConfig(client);
    if (status === 'removed') {
      console.log(`  ✓ ${client.name}: removed from ${client.globalConfig}`);
      removed++;
    } else if (status === 'absent') {
      console.log(`  · ${client.name}: no remindy entry`);
    } else {
      console.log(`  · ${client.name}: not configured`);
    }
  }
  console.log('');

  console.log('MCP server (this workspace):');
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
