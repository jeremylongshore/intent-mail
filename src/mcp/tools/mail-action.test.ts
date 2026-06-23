/**
 * Routing tests for mail_action: each op delegates to the matching
 * email-actions service function and returns newState.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
  flagAction: vi.fn(),
  moveAction: vi.fn(),
  markReadAction: vi.fn(),
  archiveAction: vi.fn(),
  stageDeleteAction: vi.fn(),
  unsubscribeAction: vi.fn(),
}));

vi.mock('../../connectors/email-actions.js', () => svc);

import { mailActionTool } from './mail-action.js';

const STATE = {
  emailId: 7,
  provider: 'outlook',
  isRead: true,
  flagged: false,
  labels: ['INBOX'],
  flags: ['SEEN'],
  staged: false,
};

function parse(res: { content: Array<{ text: string }> }) {
  return JSON.parse(res.content[0].text);
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(svc).forEach((fn) => fn.mockResolvedValue(STATE));
  svc.stageDeleteAction.mockReturnValue({ ...STATE, staged: true });
});

describe('mail_action routing', () => {
  it('mark_read -> markReadAction(emailId, true by default)', async () => {
    await mailActionTool.handler({ emailId: 7, op: 'mark_read' });
    expect(svc.markReadAction).toHaveBeenCalledWith(7, true);
  });

  it('mark_read with isRead:false -> markReadAction(emailId, false)', async () => {
    await mailActionTool.handler({ emailId: 7, op: 'mark_read', isRead: false });
    expect(svc.markReadAction).toHaveBeenCalledWith(7, false);
  });

  it('archive -> archiveAction', async () => {
    const out = parse(await mailActionTool.handler({ emailId: 7, op: 'archive' }));
    expect(svc.archiveAction).toHaveBeenCalledWith(7);
    expect(out.newState).toMatchObject({ emailId: 7 });
    expect(out.success).toBe(true);
  });

  it('flag -> flagAction(emailId, true by default)', async () => {
    await mailActionTool.handler({ emailId: 7, op: 'flag' });
    expect(svc.flagAction).toHaveBeenCalledWith(7, true);
  });

  it('move requires a destination', async () => {
    await expect(mailActionTool.handler({ emailId: 7, op: 'move' })).rejects.toThrow(/destination/);
  });

  it('move -> moveAction(emailId, destination)', async () => {
    await mailActionTool.handler({ emailId: 7, op: 'move', destination: 'archive' });
    expect(svc.moveAction).toHaveBeenCalledWith(7, 'archive');
  });

  it('stage_delete -> stageDeleteAction and returns staged=true', async () => {
    const out = parse(await mailActionTool.handler({ emailId: 7, op: 'stage_delete' }));
    expect(svc.stageDeleteAction).toHaveBeenCalledWith(7);
    expect(out.newState.staged).toBe(true);
  });

  it('unsubscribe -> unsubscribeAction', async () => {
    await mailActionTool.handler({ emailId: 7, op: 'unsubscribe' });
    expect(svc.unsubscribeAction).toHaveBeenCalledWith(7);
  });

  it('rejects an unknown op via schema', async () => {
    await expect(mailActionTool.handler({ emailId: 7, op: 'nuke' })).rejects.toThrow();
  });
});
