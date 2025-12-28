/**
 * IMAP Email Connector
 *
 * Uses imapflow directly for Gmail IMAP access with app password.
 */

import 'dotenv/config';
import { ImapFlow } from 'imapflow';
import { createTransport, Transporter } from 'nodemailer';
import type {
  EmailConnector,
  Email,
  EmailThread,
  EmailDraft,
  EmailAddress,
  EmailSearchOptions,
  EmailSearchResult,
} from './email-connector.js';

/**
 * IMAP Email Connector using imapflow
 */
export class ImapEmailConnector implements EmailConnector {
  readonly provider = 'imap';
  private client: ImapFlow | null = null;
  private smtp: Transporter | null = null;
  private userEmail: string = '';

  async isConnected(): Promise<boolean> {
    return this.client !== null && this.client.usable;
  }

  async connect(): Promise<void> {
    const email = process.env.GMAIL_USER_EMAIL;
    const password = process.env.GMAIL_APP_PASSWORD;

    if (!email || !password) {
      throw new Error(
        'GMAIL_USER_EMAIL and GMAIL_APP_PASSWORD environment variables are required.'
      );
    }

    this.userEmail = email;

    // Create IMAP connection
    this.client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: email, pass: password },
      logger: false, // Disable verbose logging
    });

    await this.client.connect();

    // Create SMTP transport
    this.smtp = createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: email, pass: password },
    });

    console.error(`[imap] Connected as ${email}`);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.logout();
    }
    if (this.smtp) {
      this.smtp.close();
    }
    this.client = null;
    this.smtp = null;
  }

  // ---- Email Operations ----

  async search(options: EmailSearchOptions): Promise<EmailSearchResult[]> {
    if (!this.client) throw new Error('Not connected');

    const folder = options.folder === 'inbox' ? 'INBOX' : (options.folder || 'INBOX');
    const lock = await this.client.getMailboxLock(folder);

    try {
      // Build IMAP search criteria
      const criteria: any = {};
      if (options.query) criteria.text = options.query;
      if (options.from) criteria.from = options.from;
      if (options.to) criteria.to = options.to;
      if (options.subject) criteria.subject = options.subject;
      if (options.after) criteria.since = options.after;
      if (options.before) criteria.before = options.before;
      if (options.isRead === false) criteria.unseen = true;
      if (options.isRead === true) criteria.seen = true;

      // Search messages
      const searchResult = await this.client.search(criteria, { uid: true });
      const uids = Array.isArray(searchResult) ? searchResult : [];
      const limitedUids = uids.slice(-(options.limit || 20));

      const results: EmailSearchResult[] = [];

      for await (const msg of this.client.fetch(limitedUids, {
        envelope: true,
        flags: true,
        bodyStructure: true,
        source: { start: 0, maxLength: 500 }, // Get snippet
      }, { uid: true })) {
        const email = this.convertMessage(msg);
        results.push({
          email,
          score: 1,
          snippet: email.snippet,
          matchedFields: ['query'],
        });
      }

      return results.reverse(); // Most recent first
    } finally {
      lock.release();
    }
  }

  async getEmail(emailId: string): Promise<Email | null> {
    if (!this.client) throw new Error('Not connected');

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      for await (const msg of this.client.fetch(emailId, {
        envelope: true,
        flags: true,
        bodyStructure: true,
        source: true,
      }, { uid: true })) {
        return this.convertMessage(msg);
      }
      return null;
    } finally {
      lock.release();
    }
  }

  async getThread(threadId: string): Promise<EmailThread | null> {
    // IMAP doesn't have native thread support
    const email = await this.getEmail(threadId);
    if (!email) return null;

    return {
      id: threadId,
      subject: email.subject,
      messages: [email],
      participants: [email.from, ...email.to],
      lastMessageDate: email.date,
      labels: email.labels,
      isRead: email.isRead,
    };
  }

  async getEmails(folder: string, limit = 50, _offset = 0): Promise<Email[]> {
    if (!this.client) throw new Error('Not connected');

    const mailboxFolder = folder.toLowerCase() === 'inbox' ? 'INBOX' : folder;
    const lock = await this.client.getMailboxLock(mailboxFolder);

    try {
      const status = await this.client.status(mailboxFolder, { messages: true });
      const total = status.messages || 0;
      const start = Math.max(1, total - limit + 1);

      const emails: Email[] = [];

      for await (const msg of this.client.fetch(`${start}:*`, {
        envelope: true,
        flags: true,
        bodyStructure: true,
      })) {
        emails.push(this.convertMessage(msg));
      }

      return emails.reverse(); // Most recent first
    } finally {
      lock.release();
    }
  }

  async getFolders(): Promise<string[]> {
    if (!this.client) throw new Error('Not connected');

    const mailboxes = await this.client.list();
    return mailboxes.map(m => m.path);
  }

  // ---- Label Operations ----

  async applyLabel(emailIds: string[], label: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      for (const uid of emailIds) {
        await this.client.messageCopy(uid, label, { uid: true });
      }
    } finally {
      lock.release();
    }
  }

  async removeLabel(emailIds: string[], _label: string): Promise<void> {
    // IMAP: cannot remove labels, only flags
    console.error(`[imap] removeLabel not fully supported, ${emailIds.length} messages`);
  }

  async createLabel(label: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.mailboxCreate(label);
  }

  async deleteLabel(label: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.mailboxDelete(label);
  }

  // ---- Draft & Send Operations ----

  async createDraft(draft: EmailDraft): Promise<string> {
    if (!this.client) throw new Error('Not connected');

    const raw = this.buildRawEmail(draft);
    const result = await this.client.append('[Gmail]/Drafts', raw, ['\\Draft']);

    if (result && typeof result === 'object' && 'uid' in result) {
      return result.uid?.toString() || `draft-${Date.now()}`;
    }
    return `draft-${Date.now()}`;
  }

  async updateDraft(draftId: string, draft: EmailDraft): Promise<void> {
    await this.deleteDraft(draftId);
    await this.createDraft(draft);
  }

  async deleteDraft(draftId: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const lock = await this.client.getMailboxLock('[Gmail]/Drafts');
    try {
      await this.client.messageDelete(draftId, { uid: true });
    } finally {
      lock.release();
    }
  }

  async send(draft: EmailDraft): Promise<string> {
    if (!this.smtp) throw new Error('SMTP not connected');

    const info = await this.smtp.sendMail({
      from: this.userEmail,
      to: draft.to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', '),
      cc: draft.cc?.map(a => a.email).join(', '),
      bcc: draft.bcc?.map(a => a.email).join(', '),
      subject: draft.subject,
      text: draft.body,
      html: draft.bodyHtml,
    });

    console.error(`[imap] Email sent: ${info.messageId}`);
    return info.messageId || '';
  }

  // ---- Modification Operations ----

  async markAsRead(emailIds: string[]): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      for (const uid of emailIds) {
        await this.client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  }

  async markAsUnread(emailIds: string[]): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      for (const uid of emailIds) {
        await this.client.messageFlagsRemove(uid, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  }

  async star(emailIds: string[]): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      for (const uid of emailIds) {
        await this.client.messageFlagsAdd(uid, ['\\Flagged'], { uid: true });
      }
    } finally {
      lock.release();
    }
  }

  async unstar(emailIds: string[]): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      for (const uid of emailIds) {
        await this.client.messageFlagsRemove(uid, ['\\Flagged'], { uid: true });
      }
    } finally {
      lock.release();
    }
  }

  async trash(emailIds: string[]): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      for (const uid of emailIds) {
        await this.client.messageMove(uid, '[Gmail]/Trash', { uid: true });
      }
    } finally {
      lock.release();
    }
  }

  async archive(emailIds: string[]): Promise<void> {
    if (!this.client) throw new Error('Not connected');

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      for (const uid of emailIds) {
        await this.client.messageMove(uid, '[Gmail]/All Mail', { uid: true });
      }
    } finally {
      lock.release();
    }
  }

  // ---- Helper Methods ----

  private convertMessage(msg: any): Email {
    const envelope = msg.envelope || {};
    const flags = msg.flags || new Set();

    return {
      id: msg.uid?.toString() || msg.seq?.toString() || '',
      threadId: msg.uid?.toString() || '',
      from: this.parseAddress(envelope.from?.[0]),
      to: (envelope.to || []).map((a: any) => this.parseAddress(a)),
      cc: (envelope.cc || []).map((a: any) => this.parseAddress(a)),
      subject: envelope.subject || '(no subject)',
      body: msg.source?.toString()?.slice(0, 1000) || '',
      bodyHtml: undefined,
      date: envelope.date || new Date(),
      labels: Array.from(flags),
      isRead: flags.has('\\Seen'),
      isStarred: flags.has('\\Flagged'),
      attachments: [],
      snippet: envelope.subject?.slice(0, 100) || '',
    };
  }

  private parseAddress(addr: any): EmailAddress {
    if (!addr) return { email: '' };
    return {
      name: addr.name || undefined,
      email: addr.address || `${addr.mailbox || ''}@${addr.host || ''}`,
    };
  }

  private buildRawEmail(draft: EmailDraft): string {
    const to = draft.to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ');
    const cc = draft.cc?.map(a => a.email).join(', ');

    let email = '';
    email += `From: ${this.userEmail}\r\n`;
    email += `To: ${to}\r\n`;
    if (cc) email += `Cc: ${cc}\r\n`;
    email += `Subject: ${draft.subject}\r\n`;
    email += `Content-Type: text/plain; charset=utf-8\r\n`;
    email += `\r\n`;
    email += draft.body;

    return email;
  }
}

/**
 * Create IMAP connector instance
 */
export function createImapConnector(): ImapEmailConnector {
  return new ImapEmailConnector();
}
