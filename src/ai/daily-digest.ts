/**
 * Daily Digest — the one shared engine behind the live artifact AND the web
 * dashboard, so the two surfaces can never drift apart.
 *
 * It composes the existing AI building blocks into one structured payload:
 *   searchEmails (window) -> collapse threads -> batchTriage (priority + why +
 *   action + deadline) -> summarize (thread summary for collapsed threads,
 *   single summary otherwise) -> group by category, ranked by priority.
 *
 * Each per-email AI result is cached in `digest_cache` keyed by
 * (email_id, updated_at), so re-opening the digest only recomputes emails that
 * actually changed since last time.
 */

import { getDatabase } from '../storage/database.js';
import {
  searchEmails,
  getThreadSize,
  getEmailsByThreadId,
} from '../storage/services/email-storage.js';
import {
  batchTriage,
  TriageResult,
  Priority,
  ActionType,
  UrgencySignal,
} from './inbox-triage.js';
import { summarizeEmail, summarizeThread, EmailCategory } from './summarizer.js';
import { Email, EmailFlag } from '../types/email.js';

/** Options controlling the digest window. */
export interface DailyDigestOptions {
  accountId?: number;
  /** Max emails (representatives) to include. Default 50. */
  limit?: number;
  /** Only include unread mail. Default false. */
  unreadOnly?: boolean;
  /** Restrict to mail received in the last N hours. */
  sinceHours?: number;
  /** Use the digest_cache for unchanged emails. Default true. */
  useCache?: boolean;
}

/** The available write operations for an email row in the digest. */
export type DigestAction =
  | 'mark_read'
  | 'archive'
  | 'flag'
  | 'move'
  | 'stage_delete'
  | 'unsubscribe';

/** One email (or collapsed thread) in the digest. */
export interface DigestEmailEntry {
  emailId: number;
  providerMessageId: string;
  threadId?: string;
  subject: string;
  from: { address: string; name?: string };
  date: string;
  isRead: boolean;
  priority: Priority;
  /** 1 (P1) .. 4 (P4) for ordering. */
  priorityRank: number;
  actionType: ActionType;
  needsResponse: boolean;
  urgencySignals: UrgencySignal[];
  deadline?: { date: string; confidence: number };
  /** One line on WHY this was prioritized (Superhuman-style). */
  why: string;
  /** One-line summary (thread summary when collapsed). */
  summary: string;
  category: EmailCategory;
  threadSize: number;
  collapsed: boolean;
  suggestedAction?: string;
  /** Evidence the summary/priority rests on (key points). */
  citations: string[];
  meeting?: { detected: boolean };
  /** Write ops offered for this row, wired to mail_action. */
  actions: DigestAction[];
}

/** A category section of the digest. */
export interface DigestGroup {
  category: string;
  label: string;
  /** Group order = best (lowest) priority rank among members. */
  priorityRank: number;
  emails: DigestEmailEntry[];
}

/** The full digest payload. */
export interface DailyDigest {
  generatedAt: string;
  accountId?: number;
  stats: {
    total: number;
    new: number;
    needResponse: number;
    highPriority: number;
    canArchive: number;
  };
  groups: DigestGroup[];
  suggestions: string[];
}

/** Numeric rank for a priority (lower = more urgent). */
function rankOf(priority: Priority): number {
  return { P1: 1, P2: 2, P3: 3, P4: 4 }[priority];
}

const ACTION_TYPES_NEEDING_RESPONSE: ReadonlySet<ActionType> = new Set([
  'reply-needed',
  'review',
  'follow-up',
]);

const CATEGORY_LABELS: Record<EmailCategory, string> = {
  meeting: 'Meetings',
  newsletter: 'Newsletters',
  'action-required': 'Action required',
  fyi: 'FYI',
  personal: 'Personal',
  commercial: 'Commercial',
  notification: 'Notifications',
  support: 'Support',
  other: 'Other',
};

/** The per-email unit we cache (the AI-derived bits). */
interface CachedEntry {
  triage: Pick<
    TriageResult,
    | 'priority'
    | 'actionType'
    | 'urgencySignals'
    | 'deadline'
    | 'reason'
    | 'suggestedNextStep'
  >;
  summary: { oneLiner: string; category: EmailCategory; keyPoints: string[] };
}

function readCache(emailId: number, updatedAt: string): CachedEntry | null {
  const row = getDatabase()
    .prepare('SELECT payload FROM digest_cache WHERE email_id = ? AND updated_at = ?')
    .get(emailId, updatedAt) as { payload: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as CachedEntry;
  } catch {
    return null;
  }
}

function writeCache(emailId: number, updatedAt: string, entry: CachedEntry): void {
  // Drop any stale rows for this email (different updated_at) to bound growth.
  const db = getDatabase();
  db.prepare('DELETE FROM digest_cache WHERE email_id = ?').run(emailId);
  db.prepare(
    'INSERT INTO digest_cache (email_id, updated_at, payload) VALUES (?, ?, ?)'
  ).run(emailId, updatedAt, JSON.stringify(entry));
}

/** Representative email of a thread within the window. */
interface Representative {
  email: Email;
  threadSize: number;
  collapsed: boolean;
}

/**
 * Collapse the window into thread representatives: one entry per threadId
 * (the most recent message), with the full thread size attached.
 */
function collapseThreads(emails: Email[]): Representative[] {
  const byThread = new Map<string, Email[]>();
  const singletons: Email[] = [];

  for (const email of emails) {
    if (email.threadId) {
      const arr = byThread.get(email.threadId) ?? [];
      arr.push(email);
      byThread.set(email.threadId, arr);
    } else {
      singletons.push(email);
    }
  }

  const reps: Representative[] = [];

  for (const [threadId, members] of byThread) {
    const latest = members.reduce((a, b) => (a.date >= b.date ? a : b));
    const threadSize = getThreadSize(threadId);
    reps.push({ email: latest, threadSize, collapsed: threadSize > 1 });
  }

  for (const email of singletons) {
    reps.push({ email, threadSize: 1, collapsed: false });
  }

  // Most recent first.
  reps.sort((a, b) => (a.email.date < b.email.date ? 1 : -1));
  return reps;
}

/** Compute the AI-derived entry for a representative (no cache). */
async function computeEntry(rep: Representative): Promise<CachedEntry> {
  const [triageResults, summary] = await Promise.all([
    batchTriage([rep.email]),
    rep.collapsed && rep.email.threadId
      ? summarizeThread(getEmailsByThreadId(rep.email.threadId))
      : summarizeEmail(rep.email),
  ]);

  const triage = triageResults.results[0];
  return {
    triage: {
      priority: triage.priority,
      actionType: triage.actionType,
      urgencySignals: triage.urgencySignals,
      deadline: triage.deadline,
      reason: triage.reason,
      suggestedNextStep: triage.suggestedNextStep,
    },
    summary: {
      oneLiner: summary.oneLiner,
      category: summary.category,
      keyPoints: summary.keyPoints,
    },
  };
}

/** Available write ops for an email given its triage. */
function actionsFor(actionType: ActionType): DigestAction[] {
  const base: DigestAction[] = ['mark_read', 'archive', 'flag', 'move', 'stage_delete'];
  if (actionType === 'unsubscribe') {
    base.push('unsubscribe');
  }
  return base;
}

/** Build the full per-email entry from the cached/computed AI unit. */
function toEntry(rep: Representative, cached: CachedEntry): DigestEmailEntry {
  const { triage, summary } = cached;
  return {
    emailId: rep.email.id,
    providerMessageId: rep.email.providerMessageId,
    threadId: rep.email.threadId,
    subject: rep.email.subject,
    from: { address: rep.email.from.address, name: rep.email.from.name },
    date: rep.email.date,
    isRead: rep.email.flags.includes(EmailFlag.SEEN),
    priority: triage.priority,
    priorityRank: rankOf(triage.priority),
    actionType: triage.actionType,
    needsResponse: ACTION_TYPES_NEEDING_RESPONSE.has(triage.actionType),
    urgencySignals: triage.urgencySignals,
    deadline: triage.deadline,
    why: triage.reason,
    summary: summary.oneLiner,
    category: summary.category,
    threadSize: rep.threadSize,
    collapsed: rep.collapsed,
    suggestedAction: triage.suggestedNextStep,
    citations: summary.keyPoints,
    meeting: { detected: summary.category === 'meeting' || triage.actionType === 'schedule' },
    actions: actionsFor(triage.actionType),
  };
}

/**
 * Build the daily digest payload. Pure composition over the existing engines;
 * the MCP tool, the artifact, and the web API all call exactly this.
 */
export async function buildDailyDigest(options: DailyDigestOptions = {}): Promise<DailyDigest> {
  const limit = options.limit ?? 50;
  const useCache = options.useCache ?? true;

  const dateFrom = options.sinceHours
    ? new Date(Date.now() - options.sinceHours * 3_600_000).toISOString()
    : undefined;

  const { items } = searchEmails({
    accountId: options.accountId,
    limit,
    offset: 0,
    dateFrom,
  });

  const windowEmails = options.unreadOnly
    ? items.filter((e) => !e.flags.includes(EmailFlag.SEEN))
    : items;

  const reps = collapseThreads(windowEmails);

  // Resolve each representative from cache or compute it.
  const entries: DigestEmailEntry[] = [];
  await Promise.all(
    reps.map(async (rep) => {
      const cached = useCache ? readCache(rep.email.id, rep.email.updatedAt) : null;
      const unit = cached ?? (await computeEntry(rep));
      if (!cached && useCache) {
        writeCache(rep.email.id, rep.email.updatedAt, unit);
      }
      entries.push(toEntry(rep, unit));
    })
  );

  // Group by category, order groups by best priority then size.
  const groupMap = new Map<EmailCategory, DigestEmailEntry[]>();
  for (const entry of entries) {
    const arr = groupMap.get(entry.category) ?? [];
    arr.push(entry);
    groupMap.set(entry.category, arr);
  }

  const groups: DigestGroup[] = [...groupMap.entries()]
    .map(([category, groupEmails]) => {
      groupEmails.sort((a, b) => a.priorityRank - b.priorityRank || (a.date < b.date ? 1 : -1));
      return {
        category,
        label: CATEGORY_LABELS[category] ?? category,
        priorityRank: Math.min(...groupEmails.map((e) => e.priorityRank)),
        emails: groupEmails,
      };
    })
    .sort((a, b) => a.priorityRank - b.priorityRank || b.emails.length - a.emails.length);

  // Stats.
  const needResponse = entries.filter((e) => e.needsResponse).length;
  const highPriority = entries.filter((e) => e.priorityRank <= 2).length;
  const canArchive = entries.filter(
    (e) => e.actionType === 'archive' || e.actionType === 'info-only'
  ).length;
  const newCount = entries.filter((e) => !e.isRead).length;

  const suggestions: string[] = [];
  if (highPriority > 0) suggestions.push(`${highPriority} high-priority item(s) need attention`);
  if (needResponse > 3) suggestions.push(`${needResponse} emails are awaiting a response`);
  if (canArchive > 5) suggestions.push(`${canArchive} emails can be archived to declutter`);

  return {
    generatedAt: new Date().toISOString(),
    accountId: options.accountId,
    stats: {
      total: entries.length,
      new: newCount,
      needResponse,
      highPriority,
      canArchive,
    },
    groups,
    suggestions,
  };
}
