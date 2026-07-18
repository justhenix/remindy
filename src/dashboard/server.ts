import { createServer } from 'node:http';
import { createDeps, describeBackend } from '../server/index.js';
import { viewLlmConfig } from '../config/index.js';
import { writeEnvVars } from '../config/env-file.js';
import { getHtml } from './ui.js';
import { FAVICON_PNG_BUFFER } from './favicon.js';
import { capture } from '../capture/capture.js';
import { recall, estimateTokens } from '../recall/recall.js';
import { seedFromRepo } from '../starter/seed-store.js';
import type { RichMemory, Tag } from '../types.js';

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

function sendJson(res: any, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export async function startDashboard(): Promise<void> {
  const { store, compressor } = await createDeps();
  const port = Number(process.env.REMINDY_DASHBOARD_PORT || 3456);

  const server = createServer(async (req, res) => {
    const url = req.url || '/';
    const method = req.method || 'GET';

    try {
      // 1. Serve SPA html
      if (url === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getHtml());
        return;
      }

      // 1a. GET /favicon.ico — browsers request this directly (bookmarks, pinned
      // tabs, history) regardless of the inline <link> icon in the HTML head.
      if (url === '/favicon.ico' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
        res.end(FAVICON_PNG_BUFFER);
        return;
      }

      // 1b. GET /api/health — which backend is live (so the demo can't hide isolated memory)
      if (url === '/api/health' && method === 'GET') {
        sendJson(res, 200, describeBackend());
        return;
      }

      // 1c. GET /api/config — BYOK view (masked; never returns the key value)
      if (url === '/api/config' && method === 'GET') {
        sendJson(res, 200, viewLlmConfig());
        return;
      }

      // 1d. POST /api/config — BYOK write to the gitignored .env (localhost only)
      if (url === '/api/config' && method === 'POST') {
        const body = await parseJsonBody(req);
        const provider = body.provider as string | undefined;
        const updates: Record<string, string | undefined> = { LLM_PROVIDER: provider };
        if (provider === 'bai') {
          updates.BAI_API_KEY = body.key;
          updates.BAI_MODEL = body.model;
          updates.BAI_API_URL = body.url;
        } else if (provider === 'openai') {
          updates.OPENAI_API_KEY = body.key;
          updates.OPENAI_MODEL = body.model;
          updates.OPENAI_API_URL = body.url;
        } else if (provider === 'anthropic') {
          updates.ANTHROPIC_API_KEY = body.key;
          updates.ANTHROPIC_MODEL = body.model;
          updates.ANTHROPIC_API_URL = body.url;
        } else if (provider === 'ollama') {
          updates.OLLAMA_MODEL = body.model;
          updates.OLLAMA_URL = body.url;
        } else {
          sendJson(res, 400, { error: 'provider must be openai, anthropic, bai, or ollama' });
          return;
        }
        const written = writeEnvVars(updates);
        // Note: the running process keeps its old env; a restart applies the change.
        sendJson(res, 200, { written, note: 'restart the MCP server/editor to apply' });
        return;
      }

      // 2. GET /api/rules
      if (url === '/api/rules' && method === 'GET') {
        const rules = await store.all();
        sendJson(res, 200, rules);
        return;
      }

      // 3. GET /api/stats
      if (url === '/api/stats' && method === 'GET') {
        const rules = await store.all();
        const totalRules = rules.length;
        const totalBurns = rules.reduce((acc, r) => acc + r.burns, 0);

        // calculate top tag
        const tagCounts: Record<string, number> = {};
        rules.forEach(r => {
          tagCounts[r.tag] = (tagCounts[r.tag] || 0) + 1;
        });
        let topTag = '-';
        let maxCount = 0;
        Object.entries(tagCounts).forEach(([tag, count]) => {
          if (count > maxCount) {
            maxCount = count;
            topTag = tag;
          }
        });

        // calculate avg tokens per recall
        let avgTokens = 0;
        if (totalRules > 0) {
          // Dry run a general recall context to estimate average tokens returned
          const rec = await recall(store, 'general programming, UI styling, code, git commits');
          avgTokens = rec.tokens;
        }

        sendJson(res, 200, {
          totalRules,
          totalBurns,
          avgTokensPerRecall: avgTokens,
          topTag
        });
        return;
      }

      // 4. POST /api/rules (Quick Capture)
      if (url === '/api/rules' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.mistake) {
          sendJson(res, 400, { error: 'Missing mistake field' });
          return;
        }
        const result = await capture(store, compressor, body.mistake, body.tag as Tag | undefined);
        sendJson(res, 200, result);
        return;
      }

      // 4a. POST /api/seed — one-click: load the repo-inferred starter pack.
      // Idempotent (existing ids are skipped), so it is safe to click repeatedly.
      if (url === '/api/seed' && method === 'POST') {
        const result = await seedFromRepo(store, process.cwd());
        sendJson(res, 200, result);
        return;
      }

      // 5. POST /api/recall (Recall Sandbox)
      if (url === '/api/recall' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body.task_context) {
          sendJson(res, 400, { error: 'Missing task_context field' });
          return;
        }
        const result = await recall(store, body.task_context);
        sendJson(res, 200, result);
        return;
      }

      // 6. PUT /api/rules/:id (Inline Edit)
      const putMatch = url.match(/^\/api\/rules\/([a-zA-Z0-9-]+)$/);
      if (putMatch && method === 'PUT') {
        const id = putMatch[1];
        const body = await parseJsonBody(req);
        const rules = await store.all();
        const existing = rules.find(r => r.id === id);

        if (!existing) {
          sendJson(res, 404, { error: 'Rule not found' });
          return;
        }

        const updated: RichMemory = {
          ...existing,
          tag: body.tag ?? existing.tag,
          antiPattern: body.antiPattern ?? existing.antiPattern,
          fix: body.fix ?? existing.fix,
          context: body.context ?? existing.context
        };

        await store.update(updated);
        sendJson(res, 200, updated);
        return;
      }

      // 7. DELETE /api/rules/:id
      const delMatch = url.match(/^\/api\/rules\/([a-zA-Z0-9-]+)$/);
      if (delMatch && method === 'DELETE') {
        const id = delMatch[1];
        await store.delete(id);
        sendJson(res, 200, { success: true });
        return;
      }

      // 404 Not Found
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');

    } catch (err) {
      console.error('[dashboard] server error:', err);
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[remindy] port ${port} is already in use. The dashboard may already be ` +
          `running at http://localhost:${port}. Open it, or pick another port with ` +
          `REMINDY_DASHBOARD_PORT=<port> npx remindy dashboard`,
      );
    } else {
      console.error(`[remindy] dashboard failed to start: ${err.message}`);
    }
    process.exit(1);
  });

  server.listen(port, () => {
    console.error(`[remindy] dashboard started: http://localhost:${port}`);
  });
}
