/**
 * Typed client for the local IntentMail web API (src/web/server).
 *
 * The browser talks to the API only — never to better-sqlite3 / connectors /
 * AI providers directly. The API base defaults to same-origin `/api` (the
 * vite dev server proxies it) or VITE_API_BASE.
 */

import type { Digest, ActionResult, DigestAction } from '../types.js';

const API_BASE =
  (typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE) ||
  '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `API ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export interface DigestParams {
  accountId?: number;
  limit?: number;
  unreadOnly?: boolean;
  sinceHours?: number;
  useCache?: boolean;
}

export const api = {
  health(): Promise<{ ok: boolean }> {
    return request('/health');
  },

  accounts(): Promise<{ accounts: Array<{ id: number; email: string; provider: string }> }> {
    return request('/accounts');
  },

  digest(params: DigestParams = {}): Promise<Digest> {
    const q = new URLSearchParams();
    if (params.accountId != null) q.set('accountId', String(params.accountId));
    if (params.limit != null) q.set('limit', String(params.limit));
    if (params.unreadOnly) q.set('unreadOnly', 'true');
    if (params.sinceHours != null) q.set('sinceHours', String(params.sinceHours));
    if (params.useCache === false) q.set('useCache', 'false');
    const qs = q.toString();
    return request(`/digest${qs ? `?${qs}` : ''}`);
  },

  action(emailId: number, op: DigestAction, extra: Record<string, unknown> = {}): Promise<ActionResult> {
    return request('/action', {
      method: 'POST',
      body: JSON.stringify({ emailId, op, ...extra }),
    });
  },

  draft(body: Record<string, unknown>): Promise<unknown> {
    return request('/draft', { method: 'POST', body: JSON.stringify(body) });
  },
};
