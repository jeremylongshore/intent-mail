/**
 * Email Connector Interface
 *
 * Abstract interface for email providers (Gmail, Outlook, IMAP)
 * Implementations will handle provider-specific APIs
 */

// Type declarations for Node.js globals
declare const process: {
  env: Record<string, string | undefined>;
};
declare const console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

// ============================================================
// Core Email Types
// ============================================================

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  /** Base64 encoded content (only if fetched) */
  content?: string;
}

export interface Email {
  id: string;
  threadId: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyHtml?: string;
  date: Date;
  labels: string[];
  isRead: boolean;
  isStarred: boolean;
  attachments: EmailAttachment[];
  snippet: string;
}

export interface EmailThread {
  id: string;
  subject: string;
  messages: Email[];
  participants: EmailAddress[];
  lastMessageDate: Date;
  labels: string[];
  isRead: boolean;
}

export interface EmailDraft {
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  body: string;
  bodyHtml?: string;
  attachments?: EmailAttachment[];
  replyToMessageId?: string;
  threadId?: string;
}

// ============================================================
// Search & Filter Types
// ============================================================

export interface EmailSearchOptions {
  query: string;
  folder?: string;
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  isRead?: boolean;
  isStarred?: boolean;
  after?: Date;
  before?: Date;
  labels?: string[];
  limit?: number;
  offset?: number;
}

export interface EmailSearchResult {
  email: Email;
  score: number;
  snippet: string;
  matchedFields: string[];
}

// ============================================================
// Connector Interface
// ============================================================

export interface EmailConnector {
  /** Provider name (gmail, outlook, imap) */
  readonly provider: string;

  /** Check if connector is authenticated and ready */
  isConnected(): Promise<boolean>;

  /** Authenticate with the provider */
  connect(): Promise<void>;

  /** Disconnect from the provider */
  disconnect(): Promise<void>;

  // ---- Email Operations ----

  /** Search emails */
  search(options: EmailSearchOptions): Promise<EmailSearchResult[]>;

  /** Get a single email by ID */
  getEmail(emailId: string): Promise<Email | null>;

  /** Get a thread by ID */
  getThread(threadId: string): Promise<EmailThread | null>;

  /** Get emails in a folder */
  getEmails(folder: string, limit?: number, offset?: number): Promise<Email[]>;

  /** Get available folders/labels */
  getFolders(): Promise<string[]>;

  // ---- Label Operations ----

  /** Apply label to emails */
  applyLabel(emailIds: string[], label: string): Promise<void>;

  /** Remove label from emails */
  removeLabel(emailIds: string[], label: string): Promise<void>;

  /** Create a new label */
  createLabel(label: string): Promise<void>;

  /** Delete a label */
  deleteLabel(label: string): Promise<void>;

  // ---- Draft & Send Operations ----

  /** Create a draft */
  createDraft(draft: EmailDraft): Promise<string>;

  /** Update a draft */
  updateDraft(draftId: string, draft: EmailDraft): Promise<void>;

  /** Delete a draft */
  deleteDraft(draftId: string): Promise<void>;

  /** Send an email */
  send(draft: EmailDraft): Promise<string>;

  // ---- Modification Operations ----

  /** Mark emails as read */
  markAsRead(emailIds: string[]): Promise<void>;

  /** Mark emails as unread */
  markAsUnread(emailIds: string[]): Promise<void>;

  /** Star emails */
  star(emailIds: string[]): Promise<void>;

  /** Unstar emails */
  unstar(emailIds: string[]): Promise<void>;

  /** Move emails to trash */
  trash(emailIds: string[]): Promise<void>;

  /** Archive emails */
  archive(emailIds: string[]): Promise<void>;
}

// ============================================================
// In-Memory Mock Connector (for development/testing)
// ============================================================

export class MockEmailConnector implements EmailConnector {
  readonly provider = 'mock';
  private connected = false;
  private emails: Map<string, Email> = new Map();
  private threads: Map<string, EmailThread> = new Map();
  private labels: Set<string> = new Set(['inbox', 'sent', 'drafts', 'trash', 'spam']);

  constructor() {
    // Seed with sample data
    this.seedSampleData();
  }

  private seedSampleData(): void {
    const now = new Date();
    const sampleEmails: Email[] = [
      {
        id: 'email-1',
        threadId: 'thread-1',
        from: { email: 'boss@company.com', name: 'Your Boss' },
        to: [{ email: 'you@company.com', name: 'You' }],
        subject: 'Q4 Planning Meeting',
        body: 'Hi,\n\nPlease review the Q4 planning document and come prepared for tomorrow\'s meeting at 2pm.\n\nBest,\nBoss',
        date: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        labels: ['inbox', 'important'],
        isRead: false,
        isStarred: true,
        attachments: [],
        snippet: 'Please review the Q4 planning document...',
      },
      {
        id: 'email-2',
        threadId: 'thread-2',
        from: { email: 'newsletter@techsite.com', name: 'Tech Newsletter' },
        to: [{ email: 'you@company.com', name: 'You' }],
        subject: 'Weekly Tech Digest',
        body: 'This week in tech: AI advances, new product launches, and more...',
        date: new Date(now.getTime() - 24 * 60 * 60 * 1000),
        labels: ['inbox', 'newsletters'],
        isRead: true,
        isStarred: false,
        attachments: [],
        snippet: 'This week in tech: AI advances...',
      },
      {
        id: 'email-3',
        threadId: 'thread-1',
        from: { email: 'you@company.com', name: 'You' },
        to: [{ email: 'boss@company.com', name: 'Your Boss' }],
        subject: 'Re: Q4 Planning Meeting',
        body: 'Hi Boss,\n\nI\'ve reviewed the document. I have a few questions about the budget allocations.\n\nBest,\nYou',
        date: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        labels: ['sent'],
        isRead: true,
        isStarred: false,
        attachments: [],
        snippet: 'I\'ve reviewed the document...',
      },
    ];

    for (const email of sampleEmails) {
      this.emails.set(email.id, email);
    }

    // Build threads
    this.threads.set('thread-1', {
      id: 'thread-1',
      subject: 'Q4 Planning Meeting',
      messages: [sampleEmails[0], sampleEmails[2]],
      participants: [
        { email: 'boss@company.com', name: 'Your Boss' },
        { email: 'you@company.com', name: 'You' },
      ],
      lastMessageDate: sampleEmails[2].date,
      labels: ['inbox', 'important', 'sent'],
      isRead: false,
    });

    this.threads.set('thread-2', {
      id: 'thread-2',
      subject: 'Weekly Tech Digest',
      messages: [sampleEmails[1]],
      participants: [{ email: 'newsletter@techsite.com', name: 'Tech Newsletter' }],
      lastMessageDate: sampleEmails[1].date,
      labels: ['inbox', 'newsletters'],
      isRead: true,
    });
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async search(options: EmailSearchOptions): Promise<EmailSearchResult[]> {
    const results: EmailSearchResult[] = [];
    const query = options.query.toLowerCase();

    for (const email of this.emails.values()) {
      const matchedFields: string[] = [];
      let score = 0;

      // Check subject
      if (email.subject.toLowerCase().includes(query)) {
        matchedFields.push('subject');
        score += 2;
      }

      // Check body
      if (email.body.toLowerCase().includes(query)) {
        matchedFields.push('body');
        score += 1;
      }

      // Check from
      if (email.from.email.toLowerCase().includes(query) ||
          (email.from.name?.toLowerCase().includes(query))) {
        matchedFields.push('from');
        score += 1.5;
      }

      // Apply filters
      if (options.folder && !email.labels.includes(options.folder)) continue;
      if (options.isRead !== undefined && email.isRead !== options.isRead) continue;
      if (options.isStarred !== undefined && email.isStarred !== options.isStarred) continue;
      if (options.after && email.date < options.after) continue;
      if (options.before && email.date > options.before) continue;

      if (score > 0) {
        results.push({
          email,
          score,
          snippet: email.snippet,
          matchedFields,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limit = options.limit ?? 10;
    return results.slice(0, limit);
  }

  async getEmail(emailId: string): Promise<Email | null> {
    return this.emails.get(emailId) ?? null;
  }

  async getThread(threadId: string): Promise<EmailThread | null> {
    return this.threads.get(threadId) ?? null;
  }

  async getEmails(folder: string, limit = 50, _offset = 0): Promise<Email[]> {
    const results: Email[] = [];
    for (const email of this.emails.values()) {
      if (email.labels.includes(folder)) {
        results.push(email);
      }
    }
    return results.slice(0, limit);
  }

  async getFolders(): Promise<string[]> {
    return Array.from(this.labels);
  }

  async applyLabel(emailIds: string[], label: string): Promise<void> {
    this.labels.add(label);
    for (const id of emailIds) {
      const email = this.emails.get(id);
      if (email && !email.labels.includes(label)) {
        email.labels.push(label);
      }
    }
  }

  async removeLabel(emailIds: string[], label: string): Promise<void> {
    for (const id of emailIds) {
      const email = this.emails.get(id);
      if (email) {
        email.labels = email.labels.filter(l => l !== label);
      }
    }
  }

  async createLabel(label: string): Promise<void> {
    this.labels.add(label);
  }

  async deleteLabel(label: string): Promise<void> {
    this.labels.delete(label);
  }

  async createDraft(draft: EmailDraft): Promise<string> {
    const id = `draft-${Date.now()}`;
    const email: Email = {
      id,
      threadId: draft.threadId ?? `thread-${Date.now()}`,
      from: { email: 'you@company.com', name: 'You' },
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      bodyHtml: draft.bodyHtml,
      date: new Date(),
      labels: ['drafts'],
      isRead: true,
      isStarred: false,
      attachments: [],
      snippet: draft.body.slice(0, 100),
    };
    this.emails.set(id, email);
    return id;
  }

  async updateDraft(draftId: string, draft: EmailDraft): Promise<void> {
    const email = this.emails.get(draftId);
    if (email) {
      email.to = draft.to;
      email.cc = draft.cc;
      email.bcc = draft.bcc;
      email.subject = draft.subject;
      email.body = draft.body;
      email.bodyHtml = draft.bodyHtml;
    }
  }

  async deleteDraft(draftId: string): Promise<void> {
    this.emails.delete(draftId);
  }

  async send(draft: EmailDraft): Promise<string> {
    const id = `sent-${Date.now()}`;
    const email: Email = {
      id,
      threadId: draft.threadId ?? `thread-${Date.now()}`,
      from: { email: 'you@company.com', name: 'You' },
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      bodyHtml: draft.bodyHtml,
      date: new Date(),
      labels: ['sent'],
      isRead: true,
      isStarred: false,
      attachments: [],
      snippet: draft.body.slice(0, 100),
    };
    this.emails.set(id, email);
    return id;
  }

  async markAsRead(emailIds: string[]): Promise<void> {
    for (const id of emailIds) {
      const email = this.emails.get(id);
      if (email) email.isRead = true;
    }
  }

  async markAsUnread(emailIds: string[]): Promise<void> {
    for (const id of emailIds) {
      const email = this.emails.get(id);
      if (email) email.isRead = false;
    }
  }

  async star(emailIds: string[]): Promise<void> {
    for (const id of emailIds) {
      const email = this.emails.get(id);
      if (email) email.isStarred = true;
    }
  }

  async unstar(emailIds: string[]): Promise<void> {
    for (const id of emailIds) {
      const email = this.emails.get(id);
      if (email) email.isStarred = false;
    }
  }

  async trash(emailIds: string[]): Promise<void> {
    for (const id of emailIds) {
      const email = this.emails.get(id);
      if (email) {
        email.labels = email.labels.filter(l => l !== 'inbox');
        if (!email.labels.includes('trash')) {
          email.labels.push('trash');
        }
      }
    }
  }

  async archive(emailIds: string[]): Promise<void> {
    for (const id of emailIds) {
      const email = this.emails.get(id);
      if (email) {
        email.labels = email.labels.filter(l => l !== 'inbox');
      }
    }
  }
}

// ============================================================
// Singleton Connector Manager
// ============================================================

let activeConnector: EmailConnector | null = null;

/**
 * Get the active email connector
 * Uses Gmail if authenticated, otherwise falls back to Mock
 */
export function getEmailConnector(): EmailConnector {
  if (!activeConnector) {
    // Default to mock connector - use initEmailConnector() to set Gmail
    activeConnector = new MockEmailConnector();
  }
  return activeConnector;
}

/**
 * Set the active email connector
 */
export function setEmailConnector(connector: EmailConnector): void {
  activeConnector = connector;
}

/**
 * Initialize email connector - tries IMAP first, then Gmail API, falls back to Mock
 */
export async function initEmailConnector(): Promise<EmailConnector> {
  // Try IMAP first (app password based)
  if (process.env.GMAIL_APP_PASSWORD) {
    try {
      const { ImapEmailConnector } = await import('./imap-connector.js');
      const imap = new ImapEmailConnector();
      await imap.connect();
      activeConnector = imap;
      console.error('[email] Using IMAP connector');
      return activeConnector;
    } catch (error) {
      console.error('[email] IMAP not available:', (error as Error).message);
    }
  }

  // Try Gmail API (service account)
  try {
    const { GmailEmailConnector } = await import('./gmail-connector.js');
    const gmail = new GmailEmailConnector();
    await gmail.connect();
    activeConnector = gmail;
    console.error('[email] Using Gmail API connector');
    return activeConnector;
  } catch (error) {
    console.error('[email] Gmail API not available:', (error as Error).message);
  }

  // Fall back to mock
  console.error('[email] Using mock connector');
  activeConnector = new MockEmailConnector();
  await activeConnector.connect();
  return activeConnector;
}
