/**
 * Tests for the Outlook Graph client: URL building (no double-prefix on
 * absolute @odata links), empty-body tolerance, flag/importance/folder
 * methods, and the 401 -> refresh -> retry path.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OutlookClient, resolveWellKnownFolder } from './client.js';
import { OutlookOAuth } from './oauth.js';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

function makeOAuth(): OutlookOAuth {
  const oauth = new OutlookOAuth({
    clientId: 'cid',
    clientSecret: 'secret',
    redirectUri: 'http://localhost/cb',
    tenantId: 'common',
  });
  oauth.setCredentials({
    accessToken: 'access-1',
    refreshToken: 'refresh-1',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
  return oauth;
}

/** Build a fetch-Response stub. */
function resp(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  const h = new Headers(headers);
  const text = body === undefined ? '' : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: h,
    text: async () => text,
  } as unknown as Response;
}

describe('resolveWellKnownFolder', () => {
  it('maps friendly aliases to Graph well-known names', () => {
    expect(resolveWellKnownFolder('archive')).toBe('archive');
    expect(resolveWellKnownFolder('Trash')).toBe('deleteditems');
    expect(resolveWellKnownFolder('spam')).toBe('junkemail');
    expect(resolveWellKnownFolder('Sent')).toBe('sentitems');
  });

  it('passes through concrete folder ids unchanged', () => {
    const id = 'AAMkAGI2THE-LONG-FOLDER-ID==';
    expect(resolveWellKnownFolder(id)).toBe(id);
  });
});

describe('OutlookClient request URL building', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes relative endpoints with the Graph base', async () => {
    fetchMock.mockResolvedValueOnce(resp(200, { value: [] }));
    const client = new OutlookClient(makeOAuth());
    await client.listMessages({ maxResults: 10 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url.startsWith(`${GRAPH_BASE}/me/messages?`)).toBe(true);
  });

  it('does NOT double-prefix an absolute @odata.nextLink page token', async () => {
    const nextLink = `${GRAPH_BASE}/me/messages?$skiptoken=ABC123`;
    fetchMock.mockResolvedValueOnce(resp(200, { value: [] }));
    const client = new OutlookClient(makeOAuth());
    await client.listMessages({ pageToken: nextLink });
    expect(fetchMock.mock.calls[0][0]).toBe(nextLink);
  });

  it('does NOT double-prefix an absolute @odata.deltaLink', async () => {
    const deltaLink = `${GRAPH_BASE}/me/messages/delta?$deltatoken=XYZ`;
    fetchMock.mockResolvedValueOnce(resp(200, { value: [] }));
    const client = new OutlookClient(makeOAuth());
    await client.getDelta(deltaLink);
    expect(fetchMock.mock.calls[0][0]).toBe(deltaLink);
  });
});

describe('OutlookClient empty-body tolerance', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('deleteMessage tolerates a 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(resp(204, undefined));
    const client = new OutlookClient(makeOAuth());
    await expect(client.deleteMessage('msg-1')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });

  it('sendMessage tolerates a 202 Accepted', async () => {
    fetchMock.mockResolvedValueOnce(resp(202, undefined));
    const client = new OutlookClient(makeOAuth());
    await expect(
      client.sendMessage({
        subject: 'hi',
        body: { contentType: 'Text', content: 'x' },
        toRecipients: [{ emailAddress: { address: 'a@b.com' } }],
      })
    ).resolves.toBeUndefined();
  });
});

describe('OutlookClient flag / importance / folders', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('setFlag PATCHes flagStatus=flagged', async () => {
    fetchMock.mockResolvedValueOnce(resp(200, { id: 'm1', flag: { flagStatus: 'flagged' } }));
    const client = new OutlookClient(makeOAuth());
    await client.setFlag('m1');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ flag: { flagStatus: 'flagged' } });
  });

  it('clearFlag PATCHes flagStatus=notFlagged', async () => {
    fetchMock.mockResolvedValueOnce(resp(200, { id: 'm1' }));
    const client = new OutlookClient(makeOAuth());
    await client.clearFlag('m1');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      flag: { flagStatus: 'notFlagged' },
    });
  });

  it('setImportance PATCHes importance', async () => {
    fetchMock.mockResolvedValueOnce(resp(200, { id: 'm1', importance: 'high' }));
    const client = new OutlookClient(makeOAuth());
    await client.setImportance('m1', 'high');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ importance: 'high' });
  });

  it('archiveMessage POSTs a move to the archive folder', async () => {
    fetchMock.mockResolvedValueOnce(resp(201, { id: 'm1' }));
    const client = new OutlookClient(makeOAuth());
    await client.archiveMessage('m1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${GRAPH_BASE}/me/messages/m1/move`);
    expect(JSON.parse(init.body)).toEqual({ destinationId: 'archive' });
  });

  it('listFolders returns the value array', async () => {
    fetchMock.mockResolvedValueOnce(
      resp(200, { value: [{ id: 'f1', displayName: 'Inbox' }] })
    );
    const client = new OutlookClient(makeOAuth());
    const folders = await client.listFolders();
    expect(folders).toEqual([{ id: 'f1', displayName: 'Inbox' }]);
  });
});

describe('OutlookClient 401 -> refresh -> retry', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('refreshes the token on 401 and retries once, persisting new tokens', async () => {
    const oauth = makeOAuth();
    const refreshed = {
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    };
    const refreshSpy = vi
      .spyOn(oauth, 'refreshAccessToken')
      .mockResolvedValue(refreshed);

    // First call 401, second call (after refresh) 200.
    fetchMock
      .mockResolvedValueOnce(resp(401, { error: 'unauth' }))
      .mockResolvedValueOnce(resp(200, { id: 'm1' }));

    const onTokensRefreshed = vi.fn();
    const client = new OutlookClient(oauth, { onTokensRefreshed });

    const msg = await client.getMessage('m1');

    expect(refreshSpy).toHaveBeenCalledWith('refresh-1');
    expect(onTokensRefreshed).toHaveBeenCalledWith(refreshed);
    expect(msg).toMatchObject({ id: 'm1' });
    // Second fetch must carry the refreshed access token.
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer access-2');
  });
});
