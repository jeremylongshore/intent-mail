/**
 * Local HTTP API server for the web dashboard.
 *
 * A thin Node `http` adapter over the pure `route()` dispatcher. Binds to
 * loopback by default (the data is the user's mailbox; it must not be exposed).
 * Zero framework dependencies.
 */

import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { route, ApiRequest } from './router.js';

export interface ApiServerOptions {
  /** Port to listen on (default 4787). */
  port?: number;
  /** Host to bind (default 127.0.0.1 — loopback only). */
  host?: string;
  /** Allowed CORS origin for the dev front-end (default http://localhost:3000). */
  corsOrigin?: string;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 5_000_000) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Build the API HTTP server. Call `.listen()` yourself, or use `startApiServer`.
 */
export function createApiServer(options: ApiServerOptions = {}): Server {
  const corsOrigin = options.corsOrigin ?? 'http://localhost:3000';

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });

    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const body =
        req.method === 'POST' || req.method === 'PUT' ? await readBody(req) : undefined;
      const apiReq: ApiRequest = {
        method: req.method ?? 'GET',
        path: url.pathname,
        query,
        body,
      };
      const result = await route(apiReq);
      res.writeHead(result.status);
      res.end(JSON.stringify(result.body));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Client errors (bad JSON / validation) vs server errors.
      const status = /invalid json|required|too large|not found/i.test(message) ? 400 : 500;
      res.writeHead(status);
      res.end(JSON.stringify({ error: message }));
    }
  });
}

/**
 * Start the API server (initializing the DB first). Returns the listening
 * Server. Used by the `serve-web` CLI subcommand.
 */
export async function startApiServer(options: ApiServerOptions = {}): Promise<Server> {
  const { initDatabase } = await import('../../storage/database.js');
  const { runMigrations } = await import('../../storage/migrations.js');
  await initDatabase();
  runMigrations();

  const port = options.port ?? (Number(process.env.INTENTMAIL_WEB_PORT) || 4787);
  const host = options.host ?? '127.0.0.1';
  const server = createApiServer(options);

  await new Promise<void>((resolve) => server.listen(port, host, resolve));
  // eslint-disable-next-line no-console
  console.error(`IntentMail web API listening on http://${host}:${port}`);
  return server;
}
