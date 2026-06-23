/**
 * Tests for the web API router. The engine functions are mocked so the test
 * verifies routing + MCP-result unwrapping, not the engine itself (which has
 * its own tests). This proves the web API calls the SAME handlers as MCP.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildDailyDigest: vi.fn(),
  actionHandler: vi.fn(),
  draftHandler: vi.fn(),
  sendHandler: vi.fn(),
  contextsHandler: vi.fn(),
  listAccounts: vi.fn(),
}));

vi.mock('../../ai/daily-digest.js', () => ({ buildDailyDigest: mocks.buildDailyDigest }));
vi.mock('../../mcp/tools/mail-action.js', () => ({ mailActionTool: { handler: mocks.actionHandler } }));
vi.mock('../../mcp/tools/mail-draft.js', () => ({ mailDraftTool: { handler: mocks.draftHandler } }));
vi.mock('../../mcp/tools/mail-send.js', () => ({ mailSendTool: { handler: mocks.sendHandler } }));
vi.mock('../../mcp/tools/mail-list-contexts.js', () => ({ mailListContextsTool: { handler: mocks.contextsHandler } }));
vi.mock('../../storage/services/account-storage.js', () => ({ listAccounts: mocks.listAccounts }));

import { route } from './router.js';

/** Wrap a payload as an MCP tool result. */
const tool = (obj: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

beforeEach(() => vi.clearAllMocks());

describe('web API router', () => {
  it('GET /api/health', async () => {
    const r = await route({ method: 'GET', path: '/api/health', query: {} });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true });
  });

  it('GET /api/accounts -> listAccounts', async () => {
    mocks.listAccounts.mockReturnValue([{ id: 1, email: 'a@b.com' }]);
    const r = await route({ method: 'GET', path: '/api/accounts', query: {} });
    expect(r.body).toEqual({ accounts: [{ id: 1, email: 'a@b.com' }] });
  });

  it('GET /api/digest -> buildDailyDigest with parsed query', async () => {
    mocks.buildDailyDigest.mockResolvedValue({ stats: { total: 3 }, groups: [] });
    const r = await route({
      method: 'GET',
      path: '/api/digest',
      query: { accountId: '2', limit: '10', unreadOnly: 'true', useCache: 'false' },
    });
    expect(mocks.buildDailyDigest).toHaveBeenCalledWith({
      accountId: 2,
      limit: 10,
      unreadOnly: true,
      sinceHours: undefined,
      useCache: false,
    });
    expect(r.body).toMatchObject({ stats: { total: 3 } });
  });

  it('POST /api/action -> mail_action handler, unwrapped', async () => {
    mocks.actionHandler.mockResolvedValue(tool({ success: true, op: 'archive' }));
    const r = await route({ method: 'POST', path: '/api/action', query: {}, body: { emailId: 1, op: 'archive' } });
    expect(mocks.actionHandler).toHaveBeenCalledWith({ emailId: 1, op: 'archive' });
    expect(r.body).toEqual({ success: true, op: 'archive' });
  });

  it('POST /api/draft -> mail_draft handler, unwrapped', async () => {
    mocks.draftHandler.mockResolvedValue(tool({ draft: 'hello' }));
    const r = await route({ method: 'POST', path: '/api/draft', query: {}, body: { mode: 'generate' } });
    expect(mocks.draftHandler).toHaveBeenCalled();
    expect(r.body).toEqual({ draft: 'hello' });
  });

  it('POST /api/send -> mail_send handler', async () => {
    mocks.sendHandler.mockResolvedValue(tool({ success: true }));
    const r = await route({ method: 'POST', path: '/api/send', query: {}, body: {} });
    expect(mocks.sendHandler).toHaveBeenCalled();
    expect(r.body).toEqual({ success: true });
  });

  it('unknown route -> 404', async () => {
    const r = await route({ method: 'GET', path: '/api/nope', query: {} });
    expect(r.status).toBe(404);
  });
});
