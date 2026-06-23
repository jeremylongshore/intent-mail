/**
 * Tests for buildDailyDigest composition: thread collapse, grouping by
 * category, priority ordering, and stats. AI + storage are mocked so the test
 * exercises the orchestration logic only (useCache:false skips the DB cache).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailFlag } from '../types/email.js';

// --- storage mock --------------------------------------------------------
const emails = [
  // Thread T1: two messages (collapsed). e1 is newest -> representative.
  mkEmail({ id: 1, threadId: 'T1', subject: 'Acme contract', date: '2026-06-23T09:00:00Z', read: false }),
  mkEmail({ id: 2, threadId: 'T1', subject: 'Acme contract (earlier)', date: '2026-06-22T09:00:00Z', read: true }),
  // Singleton newsletter.
  mkEmail({ id: 3, threadId: 'T3', subject: 'Weekly digest', date: '2026-06-23T06:00:00Z', read: false }),
];

function mkEmail(o: { id: number; threadId: string; subject: string; date: string; read: boolean }) {
  return {
    id: o.id,
    accountId: 1,
    providerMessageId: `PM-${o.id}`,
    threadId: o.threadId,
    from: { address: `s${o.id}@x.com`, name: `S${o.id}` },
    to: [],
    subject: o.subject,
    date: o.date,
    flags: o.read ? [EmailFlag.SEEN] : [],
    labels: ['INBOX'],
    hasAttachments: false,
    createdAt: o.date,
    updatedAt: o.date,
  };
}

vi.mock('../storage/services/email-storage.js', () => ({
  searchEmails: vi.fn(() => ({ items: emails, total: emails.length, hasMore: false })),
  getThreadSize: vi.fn((threadId: string) => (threadId === 'T1' ? 2 : 1)),
  getEmailsByThreadId: vi.fn((threadId: string) => emails.filter((e) => e.threadId === threadId)),
}));

// --- AI mocks ------------------------------------------------------------
const triageById: Record<number, { priority: string; actionType: string }> = {
  1: { priority: 'P1', actionType: 'reply-needed' },
  3: { priority: 'P4', actionType: 'unsubscribe' },
};

vi.mock('./inbox-triage.js', () => ({
  batchTriage: vi.fn(async (arr: Array<{ id: number }>) => ({
    results: arr.map((e) => ({
      emailId: e.id,
      providerMessageId: `PM-${e.id}`,
      priority: triageById[e.id].priority,
      actionType: triageById[e.id].actionType,
      urgencySignals: [],
      reason: `because ${e.id}`,
      confidence: 0.9,
    })),
    summary: { totalEmails: arr.length },
  })),
}));

vi.mock('./summarizer.js', () => ({
  summarizeEmail: vi.fn(async (e: { id: number }) => ({
    oneLiner: `summary ${e.id}`,
    keyPoints: [`kp ${e.id}`],
    actionItems: [],
    sentiment: 'neutral',
    category: e.id === 3 ? 'newsletter' : 'action-required',
  })),
  summarizeThread: vi.fn(async () => ({
    oneLiner: 'thread summary',
    keyPoints: ['kp-thread'],
    actionItems: [],
    sentiment: 'urgent',
    category: 'action-required',
  })),
}));

import { buildDailyDigest } from './daily-digest.js';
import { summarizeThread, summarizeEmail } from './summarizer.js';

beforeEach(() => vi.clearAllMocks());

describe('buildDailyDigest', () => {
  it('collapses threads, groups by category, ranks by priority, and computes stats', async () => {
    const digest = await buildDailyDigest({ useCache: false });

    // Two representatives: collapsed T1 + singleton newsletter.
    const allEmails = digest.groups.flatMap((g) => g.emails);
    expect(allEmails).toHaveLength(2);

    const acme = allEmails.find((e) => e.emailId === 1)!;
    expect(acme.collapsed).toBe(true);
    expect(acme.threadSize).toBe(2);
    expect(acme.summary).toBe('thread summary'); // used summarizeThread
    expect(acme.priority).toBe('P1');
    expect(acme.priorityRank).toBe(1);
    expect(acme.needsResponse).toBe(true);
    expect(acme.why).toBe('because 1');

    const news = allEmails.find((e) => e.emailId === 3)!;
    expect(news.collapsed).toBe(false);
    expect(news.category).toBe('newsletter');
    expect(news.actions).toContain('unsubscribe');

    // Highest-priority group comes first.
    expect(digest.groups[0].emails[0].priorityRank).toBe(1);

    // Stats.
    expect(digest.stats.total).toBe(2);
    expect(digest.stats.highPriority).toBe(1); // P1
    expect(digest.stats.needResponse).toBe(1);
    expect(digest.stats.new).toBe(2); // both representatives are unread

    // The right summarizers were used.
    expect(summarizeThread).toHaveBeenCalledTimes(1);
    expect(summarizeEmail).toHaveBeenCalledTimes(1);
  });

  it('respects unreadOnly', async () => {
    const digest = await buildDailyDigest({ useCache: false, unreadOnly: true });
    // e2 is read but it is not a representative anyway; both reps are unread.
    expect(digest.stats.total).toBe(2);
  });
});
