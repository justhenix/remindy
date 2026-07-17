/**
 * `remind init` — register remind MCP server in detected clients + drop project rule.
 *
 * Detects MCP-capable editors by their config directories, writes/merges
 * the remind server entry into each client's mcp.json, and appends a
 * one-line project rule telling agents to call remind_recall.
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
];

// All supported clients use { "mcpServers": { ... } } format.
const SERVERS_KEY = 'mcpServers';

// ---------------------------------------------------------------------------
// Project rule
// ---------------------------------------------------------------------------

const RULE_MARKER = '<!-- remind -->';
const RULE_SECTION = [
  '',
  `${RULE_MARKER}`,
  '## remind',
  'Always call the `remind_recall` MCP tool before writing or editing code.',
].join('\n');

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
 * Write (or merge) the remind entry into a client's MCP config.
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
  servers['remind'] = {
    command: 'node',
    args: [serverPath],
  };
  existing[SERVERS_KEY] = servers;

  mkdirSync(dirname(configFile), { recursive: true });
  writeFileSync(configFile, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  return true;
}

/**
 * Append the one-line remind rule to the project's agent rules file.
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
    if (content.includes(RULE_MARKER)) {
      return `already in ${relName}`;
    }
    writeFileSync(ruleFile, content.trimEnd() + '\n' + RULE_SECTION + '\n', 'utf8');
  } else {
    writeFileSync(ruleFile, RULE_SECTION.trimStart() + '\n', 'utf8');
  }

  return relName;
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export function runInit(projectDir: string): void {
  const serverPath = resolveServerPath();

  console.log('remind init');
  console.log('');

  // 1. MCP registration
  console.log('MCP server registration:');
  let registered = 0;
  for (const client of CLIENTS) {
    if (writeMcpConfig(projectDir, client, serverPath)) {
      console.log(`  ✓ ${client.name} → ${client.configPath}`);
      registered++;
    } else {
      console.log(`  · ${client.name} — not detected, skipped`);
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
  if (ruleResult.startsWith('already')) {
    console.log(`  · ${ruleResult}`);
  } else {
    console.log(`  ✓ appended to ${ruleResult}`);
  }
  console.log('');

  // 3. Supermemory guidance
  console.log('Supermemory Local (required for persistent memory):');
  console.log('  Start in WSL2:');
  console.log('    curl -fsSL https://supermemory.ai/install | bash');
  console.log('  Seed the starter taste pack:');
  console.log('    npx remind seed');
  console.log('');
  console.log('Verify everything:');
  console.log('  npx remind doctor');
  console.log('');
  console.log(`Server: ${serverPath}`);
}
