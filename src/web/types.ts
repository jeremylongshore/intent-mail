/**
 * Web-local view types for the daily-review surface.
 *
 * These mirror the server's DailyDigest payload (src/ai/daily-digest.ts) but
 * are declared here so the browser bundle NEVER imports server modules
 * (better-sqlite3 / keytar are native and cannot run in the browser). The
 * shapes are validated at the /api boundary, not by importing server types.
 */

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export type DigestAction =
  | 'mark_read'
  | 'archive'
  | 'flag'
  | 'move'
  | 'stage_delete'
  | 'unsubscribe';

export interface DigestEmail {
  emailId: number;
  providerMessageId: string;
  threadId?: string;
  subject: string;
  from: { address: string; name?: string };
  date: string;
  isRead: boolean;
  priority: Priority;
  priorityRank: number;
  actionType: string;
  needsResponse: boolean;
  urgencySignals: string[];
  deadline?: { date: string; confidence: number };
  why: string;
  summary: string;
  category: string;
  threadSize: number;
  collapsed: boolean;
  suggestedAction?: string;
  citations: string[];
  meeting?: { detected: boolean };
  actions: DigestAction[];
}

export interface DigestGroup {
  category: string;
  label: string;
  priorityRank: number;
  emails: DigestEmail[];
}

export interface DigestStats {
  total: number;
  new: number;
  needResponse: number;
  highPriority: number;
  canArchive: number;
}

export interface Digest {
  generatedAt: string;
  accountId?: number;
  stats: DigestStats;
  groups: DigestGroup[];
  suggestions: string[];
}

export interface ActionResult {
  success: boolean;
  emailId: number;
  op: string;
  newState: {
    emailId: number;
    provider: string;
    isRead: boolean;
    flagged: boolean;
    labels: string[];
    flags: string[];
    staged: boolean;
  };
}
