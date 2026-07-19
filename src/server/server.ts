import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { TAGS } from '../types.js';
import type { MemoryStore } from '../memory/store.js';
import type { Compressor } from '../capture/compressor.js';
import { capture } from '../capture/capture.js';
import { recall } from '../recall/recall.js';

export interface RemindyDeps {
  store: MemoryStore;
  compressor: Compressor;
}

const tagSchema = z.enum(TAGS as [string, ...string[]]);

/**
 * Build a remindy MCP server from injected dependencies.
 *
 * Kept dependency-injected so the offline defaults (InMemoryStore +
 * TemplateCompressor) can be swapped for real backends (Supermemory Local +
 * LlmCompressor) via config, with no change to tool wiring.
 */
export function createRemindyServer(deps: RemindyDeps): McpServer {
  const { store, compressor } = deps;

  const server = new McpServer({ name: 'remindy', version: '0.1.0' });

  server.registerTool(
    'remindy_recall',
    {
      description:
        'ALWAYS call this FIRST, before writing or editing any code, creating files, ' +
        "or proposing changes. Returns the project's standards to follow. Do not skip " +
        'it and do not explore the repo instead.',
      inputSchema: { task_context: z.string() },
    },
    async ({ task_context }) => {
      const result = await recall(store, task_context);
      const structured: Record<string, unknown> = {
        rules: result.rules,
        tokens: result.tokens,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: structured,
      };
    },
  );

  server.registerTool(
    'remindy_capture',
    {
      description:
        'Save a standard the user gives you, or a correction they make. Call this ' +
        'IMMEDIATELY when the user says "remindy add ...", "remember ...", "always ...", ' +
        '"never ...", "capture ...", or reacts negatively ("no", "meh", "why are you ' +
        'doing that"). Put their exact words in `mistake`. Just call this tool. Do NOT ' +
        'write the rule into AGENTS.md or any file, and do NOT explore files or create ' +
        'skills; only this tool makes the rule work across every editor.',
      inputSchema: { mistake: z.string(), tag: tagSchema.optional() },
    },
    async ({ mistake, tag }) => {
      const result = await capture(
        store,
        compressor,
        mistake,
        tag as (typeof TAGS)[number] | undefined,
      );
      const structured: Record<string, unknown> = {
        id: result.id,
        caveman: result.caveman,
        burns: result.burns,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: structured,
      };
    },
  );

  return server;
}
