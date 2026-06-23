/**
 * Provider-routing tests for mail_flag and mail_move.
 *
 * The provider client factory and the local store are mocked so the tests
 * assert routing (which client method gets called for which provider) without
 * touching SQLite or the network.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailFlag } from '../../types/email.js';

// --- Mocks ---------------------------------------------------------------

const outlook = {
  setFlag: vi.fn(),
  clearFlag: vi.fn(),
  moveMessage: vi.fn(),
};
const gmail = {
  modifyMessageLabels: vi.fn(),
};

let currentProvider: 'gmail' | 'outlook' = 'outlook';

vi.mock('../../connectors/provider-client.js', () => ({
  getProviderClientForAccount: vi.fn(async () => ({
    provider: currentProvider,
    accountId: 1,
    email: 'u@example.com',
    outlook: currentProvider === 'outlook' ? outlook : undefined,
    gmail: currentProvider === 'gmail' ? gmail : undefined,
  })),
}));

const fakeEmail = {
  id: 42,
  accountId: 1,
  providerMessageId: 'PMID-1',
  flags: [EmailFlag.SEEN],
  labels: ['INBOX', 'Work'],
};

vi.mock('../../storage/services/email-storage.js', () => ({
  getEmailById: vi.fn(() => ({ ...fakeEmail })),
  updateEmailFlags: vi.fn(),
  addLabels: vi.fn(),
  removeLabels: vi.fn(),
}));

import { mailFlagTool } from './mail-flag.js';
import { mailMoveTool } from './mail-move.js';
import { updateEmailFlags, addLabels, removeLabels } from '../../storage/services/email-storage.js';

function parseResult(res: { content: Array<{ text: string }> }) {
  return JSON.parse(res.content[0].text);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('mail_flag routing', () => {
  it('Outlook: flag -> setFlag, mirrors FLAGGED locally', async () => {
    currentProvider = 'outlook';
    const out = parseResult(await mailFlagTool.handler({ emailId: 42, flagged: true }));
    expect(outlook.setFlag).toHaveBeenCalledWith('PMID-1');
    expect(outlook.clearFlag).not.toHaveBeenCalled();
    expect(out.flagged).toBe(true);
    expect(out.flags).toContain(EmailFlag.FLAGGED);
    expect(updateEmailFlags).toHaveBeenCalledWith(42, expect.arrayContaining([EmailFlag.FLAGGED]));
  });

  it('Outlook: unflag -> clearFlag, drops FLAGGED locally', async () => {
    currentProvider = 'outlook';
    const out = parseResult(await mailFlagTool.handler({ emailId: 42, flagged: false }));
    expect(outlook.clearFlag).toHaveBeenCalledWith('PMID-1');
    expect(out.flags).not.toContain(EmailFlag.FLAGGED);
  });

  it('Gmail: flag -> add STARRED label', async () => {
    currentProvider = 'gmail';
    await mailFlagTool.handler({ emailId: 42, flagged: true });
    expect(gmail.modifyMessageLabels).toHaveBeenCalledWith('PMID-1', ['STARRED'], undefined);
  });

  it('Gmail: unflag -> remove STARRED label', async () => {
    currentProvider = 'gmail';
    await mailFlagTool.handler({ emailId: 42, flagged: false });
    expect(gmail.modifyMessageLabels).toHaveBeenCalledWith('PMID-1', undefined, ['STARRED']);
  });
});

describe('mail_move routing', () => {
  it('Outlook: delegates to moveMessage with the destination', async () => {
    currentProvider = 'outlook';
    await mailMoveTool.handler({ emailId: 42, destination: 'archive' });
    expect(outlook.moveMessage).toHaveBeenCalledWith('PMID-1', 'archive');
  });

  it('Gmail archive: removes INBOX label', async () => {
    currentProvider = 'gmail';
    await mailMoveTool.handler({ emailId: 42, destination: 'archive' });
    expect(gmail.modifyMessageLabels).toHaveBeenCalledWith('PMID-1', undefined, ['INBOX']);
    expect(removeLabels).toHaveBeenCalledWith(42, ['INBOX']);
  });

  it('Gmail label move: adds the destination label', async () => {
    currentProvider = 'gmail';
    await mailMoveTool.handler({ emailId: 42, destination: 'Receipts' });
    expect(gmail.modifyMessageLabels).toHaveBeenCalledWith('PMID-1', ['Receipts'], undefined);
    expect(addLabels).toHaveBeenCalledWith(42, ['Receipts']);
  });
});
