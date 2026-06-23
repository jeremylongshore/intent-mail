/**
 * Pure API router for the local web dashboard.
 *
 * Every route calls the SAME functions as the MCP tools (buildDailyDigest, the
 * mail_action / mail_draft / mail_send handlers, listAccounts), so the web app
 * and the MCP surface can never diverge. A local HTTP API is REQUIRED because
 * better-sqlite3 is native (cannot run in the browser) and AI provider
 * credentials must never ship to the client.
 *
 * `route()` is pure-ish (no socket handling) so it is unit-testable; the http
 * wrapper in api-server.ts just adapts Node's req/res to it.
 */

import { buildDailyDigest } from '../../ai/daily-digest.js';
import { mailActionTool } from '../../mcp/tools/mail-action.js';
import { mailDraftTool } from '../../mcp/tools/mail-draft.js';
import { mailSendTool } from '../../mcp/tools/mail-send.js';
import { mailListContextsTool } from '../../mcp/tools/mail-list-contexts.js';
import { listAccounts } from '../../storage/services/account-storage.js';

export interface ApiRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

/** Unwrap an MCP tool result ({content:[{text}]}) into its JSON payload. */
function unwrapTool(result: { content: Array<{ text: string }> }): unknown {
  return JSON.parse(result.content[0].text);
}

function num(v: string | undefined): number | undefined {
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Dispatch a request to the matching engine function. Throwing handlers are
 * translated to 400/500 by the caller.
 */
export async function route(req: ApiRequest): Promise<ApiResponse> {
  const { method, path } = req;

  // Health
  if (method === 'GET' && path === '/api/health') {
    return { status: 200, body: { ok: true, service: 'intentmail-web-api' } };
  }

  // Accounts
  if (method === 'GET' && path === '/api/accounts') {
    return { status: 200, body: { accounts: listAccounts() } };
  }

  // Daily digest — the read surface for the daily-review.
  if (method === 'GET' && path === '/api/digest') {
    const digest = await buildDailyDigest({
      accountId: num(req.query.accountId),
      limit: num(req.query.limit),
      unreadOnly: req.query.unreadOnly === 'true',
      sinceHours: num(req.query.sinceHours),
      useCache: req.query.useCache !== 'false',
    });
    return { status: 200, body: digest };
  }

  // Available context handles (for @-mention autocomplete).
  if (method === 'GET' && path === '/api/contexts') {
    return { status: 200, body: unwrapTool(await mailListContextsTool.handler({})) };
  }

  // Write action — same handler as mail_action.
  if (method === 'POST' && path === '/api/action') {
    return { status: 200, body: unwrapTool(await mailActionTool.handler(req.body)) };
  }

  // Draft (never auto-sends) — same handler as mail_draft.
  if (method === 'POST' && path === '/api/draft') {
    return { status: 200, body: unwrapTool(await mailDraftTool.handler(req.body)) };
  }

  // Send — same handler as mail_send.
  if (method === 'POST' && path === '/api/send') {
    return { status: 200, body: unwrapTool(await mailSendTool.handler(req.body)) };
  }

  return { status: 404, body: { error: `No route for ${method} ${path}` } };
}
