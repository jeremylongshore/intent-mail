/**
 * Gmail Email Connector
 *
 * Implements EmailConnector interface using the existing Gmail API client.
 * Bridges the agent system to real Gmail functionality.
 *
 * Supports two authentication methods:
 * 1. OAuth 2.0 with PKCE (user-based, interactive)
 * 2. Service Account with domain-wide delegation (server-based)
 */

import { google, gmail_v1 } from 'googleapis';
import { JWT } from 'google-auth-library';
import { GmailMessage, GmailMessagePart, GmailSystemLabel } from '../connectors/gmail/types.js';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type {
  EmailConnector,
  Email,
  EmailThread,
  EmailDraft,
  EmailAddress,
  EmailAttachment,
  EmailSearchOptions,
  EmailSearchResult,
} from './email-connector.js';

/**
 * Parse email address from header format "Name <email@example.com>"
 */
function parseEmailAddress(header: string): EmailAddress {
  const match = header.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      email: match[2].trim(),
    };
  }
  return { email: header.trim() };
}

/**
 * Parse multiple email addresses from header
 */
function parseEmailAddresses(header: string | undefined): EmailAddress[] {
  if (!header) return [];
  return header.split(',').map(parseEmailAddress);
}

/**
 * Get header value from Gmail message
 */
function getHeader(message: GmailMessage, name: string): string | undefined {
  return message.payload?.headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  )?.value;
}

/**
 * Extract body text from Gmail message parts
 */
function extractBody(message: GmailMessage): { text: string; html?: string } {
  const payload = message.payload;
  if (!payload) return { text: '' };

  // Simple message (no parts)
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, 'base64url').toString('utf-8');
    if (payload.mimeType === 'text/html') {
      return { text: decoded.replace(/<[^>]*>/g, ''), html: decoded };
    }
    return { text: decoded };
  }

  // Multipart message
  let text = '';
  let html: string | undefined;

  function extractFromParts(parts: GmailMessagePart[]): void {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        text = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      } else if (part.mimeType === 'text/html' && part.body?.data) {
        html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      } else if (part.parts) {
        extractFromParts(part.parts);
      }
    }
  }

  if (payload.parts) {
    extractFromParts(payload.parts);
  }

  // If no plain text, strip HTML
  if (!text && html) {
    text = html.replace(/<[^>]*>/g, '');
  }

  return { text, html };
}

/**
 * Extract attachments from Gmail message
 */
function extractAttachments(message: GmailMessage): EmailAttachment[] {
  const attachments: EmailAttachment[] = [];
  const payload = message.payload;
  if (!payload) return attachments;

  function extractFromParts(parts: GmailMessagePart[]): void {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body.size,
        });
      }
      if (part.parts) {
        extractFromParts(part.parts);
      }
    }
  }

  if (payload.parts) {
    extractFromParts(payload.parts);
  }
  return attachments;
}

/**
 * Convert Gmail message to Email type
 */
function gmailToEmail(message: GmailMessage): Email {
  const body = extractBody(message);
  const labels = message.labelIds || [];

  return {
    id: message.id,
    threadId: message.threadId,
    from: parseEmailAddress(getHeader(message, 'From') || ''),
    to: parseEmailAddresses(getHeader(message, 'To')),
    cc: parseEmailAddresses(getHeader(message, 'Cc')),
    subject: getHeader(message, 'Subject') || '(no subject)',
    body: body.text,
    bodyHtml: body.html,
    date: new Date(parseInt(message.internalDate, 10)),
    labels: labels,
    isRead: !labels.includes(GmailSystemLabel.UNREAD),
    isStarred: labels.includes(GmailSystemLabel.STARRED),
    attachments: extractAttachments(message),
    snippet: message.snippet,
  };
}

/**
 * Encode email for Gmail API (RFC 2822 format, base64url)
 */
function encodeEmail(draft: EmailDraft, fromEmail: string): string {
  const to = draft.to.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ');
  const cc = draft.cc?.map(a => a.name ? `"${a.name}" <${a.email}>` : a.email).join(', ');

  let email = '';
  email += `From: ${fromEmail}\r\n`;
  email += `To: ${to}\r\n`;
  if (cc) email += `Cc: ${cc}\r\n`;
  email += `Subject: ${draft.subject}\r\n`;
  email += `Content-Type: text/plain; charset=utf-8\r\n`;
  email += `\r\n`;
  email += draft.body;

  return Buffer.from(email).toString('base64url');
}

/**
 * Gmail scopes required for email operations
 */
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.labels',
];

/**
 * Service account configuration
 */
interface ServiceAccountConfig {
  client_email: string;
  private_key: string;
  project_id: string;
}

/**
 * Gmail Email Connector
 *
 * Uses service account with domain-wide delegation for authentication.
 * Falls back to checking common paths for credentials.
 */
export class GmailEmailConnector implements EmailConnector {
  readonly provider = 'gmail';
  private gmail: gmail_v1.Gmail | null = null;
  private userEmail: string = '';
  private labelCache: Map<string, string> = new Map(); // name -> id

  async isConnected(): Promise<boolean> {
    return this.gmail !== null;
  }

  async connect(): Promise<void> {
    // Get service account credentials
    const serviceAccountPath = this.findServiceAccountPath();
    if (!serviceAccountPath) {
      throw new Error(
        'Gmail service account not found. Place workspace-service-account.json in secrets/ directory.'
      );
    }

    const serviceAccount: ServiceAccountConfig = JSON.parse(
      readFileSync(serviceAccountPath, 'utf-8')
    );

    // Get user email to impersonate from environment
    this.userEmail = process.env.GMAIL_USER_EMAIL || '';
    if (!this.userEmail) {
      throw new Error(
        'GMAIL_USER_EMAIL environment variable is required for service account authentication.'
      );
    }

    // Create JWT client with domain-wide delegation
    const jwtClient = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: GMAIL_SCOPES,
      subject: this.userEmail, // Impersonate this user
    });

    // Authorize and create Gmail client
    await jwtClient.authorize();
    this.gmail = google.gmail({ version: 'v1', auth: jwtClient });

    // Cache labels
    await this.refreshLabelCache();

    console.error(`[gmail] Connected as ${this.userEmail} (service account)`);
  }

  /**
   * Find service account JSON file
   */
  private findServiceAccountPath(): string | null {
    const paths = [
      join(process.cwd(), 'secrets', 'workspace-service-account.json'),
      join(process.cwd(), 'secrets', 'service-account.json'),
      process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    ];

    for (const p of paths) {
      if (p && existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  async disconnect(): Promise<void> {
    this.gmail = null;
    this.userEmail = '';
    this.labelCache.clear();
  }

  private async refreshLabelCache(): Promise<void> {
    if (!this.gmail) return;
    const response = await this.gmail.users.labels.list({ userId: 'me' });
    const labels = response.data.labels || [];
    this.labelCache.clear();
    for (const label of labels) {
      if (label.id && label.name) {
        this.labelCache.set(label.name.toLowerCase(), label.id);
      }
    }
  }

  private getLabelId(labelName: string): string | undefined {
    return this.labelCache.get(labelName.toLowerCase());
  }

  // ---- Email Operations ----

  async search(options: EmailSearchOptions): Promise<EmailSearchResult[]> {
    if (!this.gmail) throw new Error('Not connected');

    // Build Gmail search query
    const parts: string[] = [];
    if (options.query) parts.push(options.query);
    if (options.from) parts.push(`from:${options.from}`);
    if (options.to) parts.push(`to:${options.to}`);
    if (options.subject) parts.push(`subject:${options.subject}`);
    if (options.hasAttachment) parts.push('has:attachment');
    if (options.isRead === false) parts.push('is:unread');
    if (options.isRead === true) parts.push('is:read');
    if (options.isStarred) parts.push('is:starred');
    if (options.after) parts.push(`after:${options.after.toISOString().split('T')[0]}`);
    if (options.before) parts.push(`before:${options.before.toISOString().split('T')[0]}`);

    const query = parts.join(' ');

    // Get label IDs for folder filter
    let labelIds: string[] | undefined;
    if (options.folder) {
      const labelId = this.getLabelId(options.folder);
      if (labelId) labelIds = [labelId];
    }

    const response = await this.gmail.users.messages.list({
      userId: 'me',
      q: query || undefined,
      labelIds,
      maxResults: options.limit || 20,
    });

    const messages = response.data.messages || [];
    if (messages.length === 0) return [];

    // Fetch full messages
    const fullMessages = await this.batchGetMessages(messages.map(m => m.id!));

    return fullMessages.map((msg) => ({
      email: gmailToEmail(msg),
      score: 1,
      snippet: msg.snippet,
      matchedFields: ['query'],
    }));
  }

  /**
   * Batch get multiple messages
   */
  private async batchGetMessages(messageIds: string[]): Promise<GmailMessage[]> {
    if (!this.gmail) throw new Error('Not connected');
    const messages: GmailMessage[] = [];

    for (const id of messageIds) {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id,
        format: 'full',
      });
      messages.push(response.data as GmailMessage);
    }

    return messages;
  }

  async getEmail(emailId: string): Promise<Email | null> {
    if (!this.gmail) throw new Error('Not connected');
    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: emailId,
        format: 'full',
      });
      return gmailToEmail(response.data as GmailMessage);
    } catch (_error) {
      return null;
    }
  }

  async getThread(threadId: string): Promise<EmailThread | null> {
    if (!this.gmail) throw new Error('Not connected');

    // Get thread directly
    const response = await this.gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    });

    const threadMessages = response.data.messages || [];
    if (threadMessages.length === 0) return null;

    const emails = threadMessages.map((m) => gmailToEmail(m as GmailMessage));

    // Get unique participants
    const participantMap = new Map<string, EmailAddress>();
    for (const email of emails) {
      participantMap.set(email.from.email, email.from);
      for (const to of email.to) {
        participantMap.set(to.email, to);
      }
    }

    // Get all labels
    const allLabels = new Set<string>();
    for (const email of emails) {
      for (const label of email.labels) {
        allLabels.add(label);
      }
    }

    return {
      id: threadId,
      subject: emails[0]?.subject || '(no subject)',
      messages: emails,
      participants: Array.from(participantMap.values()),
      lastMessageDate: emails[emails.length - 1]?.date || new Date(),
      labels: Array.from(allLabels),
      isRead: emails.every((e) => e.isRead),
    };
  }

  async getEmails(folder: string, limit = 50, _offset = 0): Promise<Email[]> {
    if (!this.gmail) throw new Error('Not connected');

    const labelId = this.getLabelId(folder);
    const response = await this.gmail.users.messages.list({
      userId: 'me',
      labelIds: labelId ? [labelId] : undefined,
      maxResults: limit,
    });

    const messages = response.data.messages || [];
    if (messages.length === 0) return [];

    const fullMessages = await this.batchGetMessages(messages.map(m => m.id!));

    return fullMessages.map(gmailToEmail);
  }

  async getFolders(): Promise<string[]> {
    if (!this.gmail) throw new Error('Not connected');
    const response = await this.gmail.users.labels.list({ userId: 'me' });
    const labels = response.data.labels || [];
    return labels.map((l) => l.name || '').filter(Boolean);
  }

  // ---- Label Operations ----

  async applyLabel(emailIds: string[], label: string): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');

    let labelId = this.getLabelId(label);
    if (!labelId) {
      await this.createLabel(label);
      await this.refreshLabelCache();
      labelId = this.getLabelId(label);
    }

    if (!labelId) throw new Error(`Failed to create label: ${label}`);

    for (const emailId of emailIds) {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: { addLabelIds: [labelId] },
      });
    }
  }

  async removeLabel(emailIds: string[], label: string): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');

    const labelId = this.getLabelId(label);
    if (!labelId) return;

    for (const emailId of emailIds) {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: { removeLabelIds: [labelId] },
      });
    }
  }

  async createLabel(label: string): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');
    await this.gmail.users.labels.create({
      userId: 'me',
      requestBody: { name: label },
    });
  }

  async deleteLabel(label: string): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');
    const labelId = this.getLabelId(label);
    if (!labelId) return;
    await this.gmail.users.labels.delete({
      userId: 'me',
      id: labelId,
    });
  }

  // ---- Draft & Send Operations ----

  async createDraft(draft: EmailDraft): Promise<string> {
    if (!this.gmail) throw new Error('Not connected');
    const rawMessage = encodeEmail(draft, this.userEmail);
    const response = await this.gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw: rawMessage } },
    });
    return response.data.id || '';
  }

  async updateDraft(draftId: string, draft: EmailDraft): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');
    const rawMessage = encodeEmail(draft, this.userEmail);
    await this.gmail.users.drafts.update({
      userId: 'me',
      id: draftId,
      requestBody: { message: { raw: rawMessage } },
    });
  }

  async deleteDraft(draftId: string): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');
    await this.gmail.users.drafts.delete({
      userId: 'me',
      id: draftId,
    });
  }

  async send(draft: EmailDraft): Promise<string> {
    if (!this.gmail) throw new Error('Not connected');

    const rawMessage = encodeEmail(draft, this.userEmail);
    const response = await this.gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage },
    });

    console.error(`[gmail] Email sent: ${response.data.id}`);
    return response.data.id || '';
  }

  // ---- Modification Operations ----

  async markAsRead(emailIds: string[]): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');
    for (const emailId of emailIds) {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: { removeLabelIds: [GmailSystemLabel.UNREAD] },
      });
    }
  }

  async markAsUnread(emailIds: string[]): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');
    for (const emailId of emailIds) {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: { addLabelIds: [GmailSystemLabel.UNREAD] },
      });
    }
  }

  async star(emailIds: string[]): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');
    for (const emailId of emailIds) {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: { addLabelIds: [GmailSystemLabel.STARRED] },
      });
    }
  }

  async unstar(emailIds: string[]): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');
    for (const emailId of emailIds) {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: { removeLabelIds: [GmailSystemLabel.STARRED] },
      });
    }
  }

  async trash(emailIds: string[]): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');
    for (const emailId of emailIds) {
      await this.gmail.users.messages.trash({
        userId: 'me',
        id: emailId,
      });
    }
  }

  async archive(emailIds: string[]): Promise<void> {
    if (!this.gmail) throw new Error('Not connected');
    for (const emailId of emailIds) {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: emailId,
        requestBody: { removeLabelIds: [GmailSystemLabel.INBOX] },
      });
    }
  }
}

/**
 * Create Gmail connector instance
 */
export function createGmailConnector(): GmailEmailConnector {
  return new GmailEmailConnector();
}
