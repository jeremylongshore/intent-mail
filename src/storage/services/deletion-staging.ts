/**
 * Deletion Staging Service
 *
 * Provides a safe deletion workflow:
 * 1. Stage emails for deletion (mark, don't delete)
 * 2. Review staged emails during retention period
 * 3. Unstage to restore emails to normal state
 * 4. Commit to permanently delete from provider
 *
 * All deletions are logged for audit trail.
 */

import * as fs from 'fs';
import * as path from 'path';
import { getDatabase } from '../database.js';
import { StorageError } from '../../types/storage.js';
import { EmailRow } from '../../types/email.js';

/**
 * Default retention period in days
 */
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Base path for MIME backups
 */
const BACKUP_BASE_PATH = './data/deletion-backups';

/**
 * Staged email info
 */
export interface StagedEmail {
  id: number;
  accountId: number;
  providerMessageId: string;
  subject: string;
  from: string;
  date: string;
  stagedAt: string;
  backupPath: string | null;
  expiresAt: string;
  daysUntilExpiry: number;
}

/**
 * Deletion log entry
 */
export interface DeletionLogEntry {
  id: number;
  emailId: number;
  accountId: number;
  providerMessageId: string;
  emailSubject: string;
  emailFrom: string;
  emailDate: string;
  stagedAt: string;
  backupPath: string | null;
  committedAt: string | null;
  committedBy: string | null;
  retentionDays: number;
  expiresAt: string;
  createdAt: string;
}

/**
 * Stage emails for deletion
 */
export function stageForDeletion(
  emailIds: number[],
  options: {
    retentionDays?: number;
    backupMime?: boolean;
    reason?: string;
  } = {}
): { staged: number; errors: Array<{ emailId: number; error: string }> } {
  const db = getDatabase();
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  const staged: number[] = [];
  const errors: Array<{ emailId: number; error: string }> = [];

  for (const emailId of emailIds) {
    try {
      // Get email
      const email = db.prepare('SELECT * FROM emails WHERE id = ?')
        .get(emailId) as EmailRow | undefined;

      if (!email) {
        errors.push({ emailId, error: 'Email not found' });
        continue;
      }

      if (email.deletion_staged_at) {
        errors.push({ emailId, error: 'Email already staged for deletion' });
        continue;
      }

      // Create backup if requested
      let backupPath: string | null = null;
      if (options.backupMime) {
        backupPath = createMimeBackup(email);
      }

      // Stage the email
      const stagedAt = now.toISOString();
      db.prepare(`
        UPDATE emails
        SET deletion_staged_at = ?,
            deletion_backup_path = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(stagedAt, backupPath, emailId);

      // Log the staging
      db.prepare(`
        INSERT INTO deletion_log (
          email_id, account_id, provider_message_id,
          email_subject, email_from, email_date,
          staged_at, backup_path, retention_days, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        emailId,
        email.account_id,
        email.provider_message_id,
        email.subject,
        email.from_address,
        email.date,
        stagedAt,
        backupPath,
        retentionDays,
        expiresAt.toISOString()
      );

      staged.push(emailId);
    } catch (error) {
      errors.push({
        emailId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { staged: staged.length, errors };
}

/**
 * Create MIME backup of an email
 */
function createMimeBackup(email: EmailRow): string {
  // Ensure backup directory exists
  const accountDir = path.join(BACKUP_BASE_PATH, email.account_id.toString());
  if (!fs.existsSync(accountDir)) {
    fs.mkdirSync(accountDir, { recursive: true });
  }

  // Create backup filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${email.id}_${timestamp}.json`;
  const backupPath = path.join(accountDir, filename);

  // Save email data as JSON (simplified MIME backup)
  const backupData = {
    id: email.id,
    accountId: email.account_id,
    providerMessageId: email.provider_message_id,
    threadId: email.thread_id,
    fromAddress: email.from_address,
    fromName: email.from_name,
    toAddresses: email.to_addresses,
    ccAddresses: email.cc_addresses,
    bccAddresses: email.bcc_addresses,
    subject: email.subject,
    bodyText: email.body_text,
    bodyHtml: email.body_html,
    snippet: email.snippet,
    date: email.date,
    receivedAt: email.received_at,
    flags: email.flags,
    labels: email.labels,
    inReplyTo: email.in_reply_to,
    referenceHeaders: email.reference_headers,
    rawHeaders: email.raw_headers,
    sizeBytes: email.size_bytes,
    hasAttachments: email.has_attachments,
    createdAt: email.created_at,
    updatedAt: email.updated_at,
    backedUpAt: new Date().toISOString(),
  };

  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

  return backupPath;
}

/**
 * List emails staged for deletion
 */
export function listStagedEmails(
  accountId?: number,
  limit: number = 50,
  offset: number = 0
): { emails: StagedEmail[]; total: number } {
  const db = getDatabase();

  let whereClause = 'WHERE e.deletion_staged_at IS NOT NULL';
  const params: unknown[] = [];

  if (accountId !== undefined) {
    whereClause += ' AND e.account_id = ?';
    params.push(accountId);
  }

  // Count total
  const countRow = db.prepare(`
    SELECT COUNT(*) as count FROM emails e ${whereClause}
  `).get(...params) as { count: number };

  // Get staged emails with expiry info
  const emails = db.prepare(`
    SELECT
      e.id,
      e.account_id,
      e.provider_message_id,
      e.subject,
      e.from_address,
      e.date,
      e.deletion_staged_at,
      e.deletion_backup_path,
      dl.expires_at
    FROM emails e
    LEFT JOIN deletion_log dl ON dl.email_id = e.id AND dl.committed_at IS NULL
    ${whereClause}
    ORDER BY e.deletion_staged_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Array<{
    id: number;
    account_id: number;
    provider_message_id: string;
    subject: string;
    from_address: string;
    date: string;
    deletion_staged_at: string;
    deletion_backup_path: string | null;
    expires_at: string | null;
  }>;

  const now = new Date();

  return {
    emails: emails.map((e) => {
      const expiresAt = e.expires_at || new Date(now.getTime() + DEFAULT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const expiryDate = new Date(expiresAt);
      const daysUntilExpiry = Math.max(0, Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));

      return {
        id: e.id,
        accountId: e.account_id,
        providerMessageId: e.provider_message_id,
        subject: e.subject,
        from: e.from_address,
        date: e.date,
        stagedAt: e.deletion_staged_at,
        backupPath: e.deletion_backup_path,
        expiresAt,
        daysUntilExpiry,
      };
    }),
    total: countRow.count,
  };
}

/**
 * Unstage emails (restore to normal state)
 */
export function unstageEmails(
  emailIds: number[]
): { unstaged: number; errors: Array<{ emailId: number; error: string }> } {
  const db = getDatabase();
  const unstaged: number[] = [];
  const errors: Array<{ emailId: number; error: string }> = [];

  for (const emailId of emailIds) {
    try {
      // Check if email is staged
      const email = db.prepare('SELECT deletion_staged_at FROM emails WHERE id = ?')
        .get(emailId) as { deletion_staged_at: string | null } | undefined;

      if (!email) {
        errors.push({ emailId, error: 'Email not found' });
        continue;
      }

      if (!email.deletion_staged_at) {
        errors.push({ emailId, error: 'Email not staged for deletion' });
        continue;
      }

      // Unstage
      db.prepare(`
        UPDATE emails
        SET deletion_staged_at = NULL,
            deletion_backup_path = NULL,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(emailId);

      // Remove from deletion log (uncommitted entry)
      db.prepare(`
        DELETE FROM deletion_log
        WHERE email_id = ? AND committed_at IS NULL
      `).run(emailId);

      unstaged.push(emailId);
    } catch (error) {
      errors.push({
        emailId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { unstaged: unstaged.length, errors };
}

/**
 * Commit staged deletions (permanent delete)
 */
export function commitDeletions(
  emailIds: number[],
  committedBy: string = 'system'
): { deleted: number; errors: Array<{ emailId: number; error: string }> } {
  const db = getDatabase();
  const deleted: number[] = [];
  const errors: Array<{ emailId: number; error: string }> = [];
  const committedAt = new Date().toISOString();

  for (const emailId of emailIds) {
    try {
      // Check if email is staged
      const email = db.prepare('SELECT deletion_staged_at FROM emails WHERE id = ?')
        .get(emailId) as { deletion_staged_at: string | null } | undefined;

      if (!email) {
        errors.push({ emailId, error: 'Email not found' });
        continue;
      }

      if (!email.deletion_staged_at) {
        errors.push({ emailId, error: 'Email not staged for deletion' });
        continue;
      }

      // Update deletion log
      db.prepare(`
        UPDATE deletion_log
        SET committed_at = ?,
            committed_by = ?
        WHERE email_id = ? AND committed_at IS NULL
      `).run(committedAt, committedBy, emailId);

      // Delete the email from database
      // Note: This does NOT delete from provider - that should be done separately
      db.prepare('DELETE FROM emails WHERE id = ?').run(emailId);

      deleted.push(emailId);
    } catch (error) {
      errors.push({
        emailId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { deleted: deleted.length, errors };
}

/**
 * Get deletion log
 */
export function getDeletionLog(
  accountId?: number,
  includeUncommitted: boolean = true,
  limit: number = 50,
  offset: number = 0
): { entries: DeletionLogEntry[]; total: number } {
  const db = getDatabase();

  let whereClause = '';
  const params: unknown[] = [];

  const conditions: string[] = [];
  if (accountId !== undefined) {
    conditions.push('account_id = ?');
    params.push(accountId);
  }
  if (!includeUncommitted) {
    conditions.push('committed_at IS NOT NULL');
  }

  if (conditions.length > 0) {
    whereClause = 'WHERE ' + conditions.join(' AND ');
  }

  // Count total
  const countRow = db.prepare(`
    SELECT COUNT(*) as count FROM deletion_log ${whereClause}
  `).get(...params) as { count: number };

  // Get entries
  const entries = db.prepare(`
    SELECT * FROM deletion_log
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Array<{
    id: number;
    email_id: number;
    account_id: number;
    provider_message_id: string;
    email_subject: string;
    email_from: string;
    email_date: string;
    staged_at: string;
    backup_path: string | null;
    committed_at: string | null;
    committed_by: string | null;
    retention_days: number;
    expires_at: string;
    created_at: string;
  }>;

  return {
    entries: entries.map((e) => ({
      id: e.id,
      emailId: e.email_id,
      accountId: e.account_id,
      providerMessageId: e.provider_message_id,
      emailSubject: e.email_subject,
      emailFrom: e.email_from,
      emailDate: e.email_date,
      stagedAt: e.staged_at,
      backupPath: e.backup_path,
      committedAt: e.committed_at,
      committedBy: e.committed_by,
      retentionDays: e.retention_days,
      expiresAt: e.expires_at,
      createdAt: e.created_at,
    })),
    total: countRow.count,
  };
}

/**
 * Get expired staged emails (past retention period)
 */
export function getExpiredStagedEmails(): number[] {
  const db = getDatabase();
  const now = new Date().toISOString();

  const rows = db.prepare(`
    SELECT email_id FROM deletion_log
    WHERE committed_at IS NULL AND expires_at < ?
  `).all(now) as Array<{ email_id: number }>;

  return rows.map((r) => r.email_id);
}

/**
 * Restore email from backup
 */
export function restoreFromBackup(backupPath: string): boolean {
  if (!fs.existsSync(backupPath)) {
    throw new StorageError('Backup file not found', 'BACKUP_NOT_FOUND');
  }

  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  const db = getDatabase();

  // Re-insert email
  db.prepare(`
    INSERT INTO emails (
      account_id, provider_message_id, thread_id,
      from_address, from_name,
      to_addresses, cc_addresses, bcc_addresses,
      subject, body_text, body_html, snippet,
      date, received_at,
      flags, labels,
      in_reply_to, reference_headers,
      raw_headers, size_bytes, has_attachments
    ) VALUES (
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?
    )
  `).run(
    backupData.accountId,
    backupData.providerMessageId,
    backupData.threadId || null,
    backupData.fromAddress,
    backupData.fromName || null,
    backupData.toAddresses,
    backupData.ccAddresses || null,
    backupData.bccAddresses || null,
    backupData.subject,
    backupData.bodyText || null,
    backupData.bodyHtml || null,
    backupData.snippet || null,
    backupData.date,
    backupData.receivedAt || null,
    backupData.flags || '',
    backupData.labels || '[]',
    backupData.inReplyTo || null,
    backupData.referenceHeaders || null,
    backupData.rawHeaders || null,
    backupData.sizeBytes || null,
    backupData.hasAttachments ? 1 : 0
  );

  return true;
}
