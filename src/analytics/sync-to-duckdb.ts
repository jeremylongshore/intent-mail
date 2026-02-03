/**
 * SQLite to DuckDB Sync Service
 *
 * Syncs email data from SQLite (operational store) to DuckDB (analytics store).
 * DuckDB provides 100x faster analytics queries than SQLite.
 */

import { getDatabase } from '../storage/database.js';
import { runDuckDB, queryDuckDB } from './duckdb.js';
import { EmailRow } from '../types/email.js';

/**
 * Extract domain from email address
 * Handles both simple (user@example.com) and formatted ("Name" <user@example.com>) addresses
 */
function extractDomain(email: string): string {
  // Match @ followed by domain characters (letters, digits, dots, hyphens)
  // Stop at whitespace, >, or end of string
  const match = email.match(/@([a-zA-Z0-9.-]+)/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Parse flags string to booleans
 */
function parseFlags(flags: string): {
  isRead: boolean;
  isFlagged: boolean;
  isDraft: boolean;
  isAnswered: boolean;
} {
  const flagList = flags ? flags.split(',').map((f) => f.trim()) : [];
  return {
    isRead: flagList.includes('SEEN'),
    isFlagged: flagList.includes('FLAGGED'),
    isDraft: flagList.includes('DRAFT'),
    isAnswered: flagList.includes('ANSWERED'),
  };
}

/**
 * Parse labels JSON to array
 */
function parseLabels(labels: string): string[] {
  try {
    return JSON.parse(labels || '[]');
  } catch {
    return [];
  }
}

/**
 * Sync result
 */
export interface SyncResult {
  emailsSynced: number;
  attachmentsSynced: number;
  duration: number;
  errors: string[];
}

/**
 * Sync all emails from SQLite to DuckDB
 */
export async function syncAllEmails(accountId?: number): Promise<SyncResult> {
  const startTime = Date.now();
  const sqliteDb = getDatabase();
  const errors: string[] = [];

  let emailsSynced = 0;
  let attachmentsSynced = 0;

  try {
    // Get emails from SQLite
    let query = 'SELECT * FROM emails';
    const params: unknown[] = [];

    if (accountId !== undefined) {
      query += ' WHERE account_id = ?';
      params.push(accountId);
    }

    const emails = sqliteDb.prepare(query).all(...params) as EmailRow[];

    // Clear existing data in DuckDB for this account
    if (accountId !== undefined) {
      await runDuckDB('DELETE FROM attachments_analytics WHERE account_id = ?', [accountId]);
      await runDuckDB('DELETE FROM emails_analytics WHERE account_id = ?', [accountId]);
    } else {
      await runDuckDB('DELETE FROM attachments_analytics');
      await runDuckDB('DELETE FROM emails_analytics');
    }

    // Insert emails in batches using multi-value INSERT for better performance
    const batchSize = 500;
    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      try {
        // Build batch insert with multiple value tuples
        const placeholders: string[] = [];
        const batchParams: unknown[] = [];

        for (const email of batch) {
          const flags = parseFlags(email.flags);
          const labels = parseLabels(email.labels);
          const domain = extractDomain(email.from_address);

          placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          batchParams.push(
            email.id,
            email.account_id,
            email.provider_message_id,
            email.thread_id,
            email.from_address,
            email.from_name,
            domain,
            email.subject,
            email.snippet,
            email.date,
            email.received_at,
            flags.isRead,
            flags.isFlagged,
            flags.isDraft,
            flags.isAnswered,
            email.size_bytes,
            email.has_attachments === 1,
            labels
          );
        }

        await runDuckDB(`
          INSERT INTO emails_analytics (
            id, account_id, provider_message_id, thread_id,
            from_address, from_name, from_domain, subject, snippet,
            date, received_at,
            is_read, is_flagged, is_draft, is_answered,
            size_bytes, has_attachments, labels
          ) VALUES ${placeholders.join(', ')}
        `, batchParams);

        emailsSynced += batch.length;
      } catch (error) {
        // On batch failure, fall back to individual inserts to identify problematic rows
        for (const email of batch) {
          try {
            const flags = parseFlags(email.flags);
            const labels = parseLabels(email.labels);
            const domain = extractDomain(email.from_address);

            await runDuckDB(`
              INSERT INTO emails_analytics (
                id, account_id, provider_message_id, thread_id,
                from_address, from_name, from_domain, subject, snippet,
                date, received_at,
                is_read, is_flagged, is_draft, is_answered,
                size_bytes, has_attachments, labels
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              email.id,
              email.account_id,
              email.provider_message_id,
              email.thread_id,
              email.from_address,
              email.from_name,
              domain,
              email.subject,
              email.snippet,
              email.date,
              email.received_at,
              flags.isRead,
              flags.isFlagged,
              flags.isDraft,
              flags.isAnswered,
              email.size_bytes,
              email.has_attachments === 1,
              labels,
            ]);

            emailsSynced++;
          } catch (rowError) {
            errors.push(`Email ${email.id}: ${rowError instanceof Error ? rowError.message : String(rowError)}`);
          }
        }
      }
    }

    // Sync attachments
    const attachments = sqliteDb.prepare(`
      SELECT a.*, e.account_id
      FROM attachments a
      JOIN emails e ON a.email_id = e.id
      ${accountId !== undefined ? 'WHERE e.account_id = ?' : ''}
    `).all(...(accountId !== undefined ? [accountId] : [])) as Array<{
      id: number;
      email_id: number;
      account_id: number;
      filename: string;
      mime_type: string;
      size_bytes: number;
      content_hash: string | null;
      extracted_at: string | null;
    }>;

    // Batch insert attachments
    for (let i = 0; i < attachments.length; i += batchSize) {
      const batch = attachments.slice(i, i + batchSize);

      try {
        const placeholders: string[] = [];
        const batchParams: unknown[] = [];

        for (const attachment of batch) {
          placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
          batchParams.push(
            attachment.id,
            attachment.email_id,
            attachment.account_id,
            attachment.filename,
            attachment.mime_type,
            attachment.size_bytes,
            attachment.content_hash,
            attachment.extracted_at
          );
        }

        await runDuckDB(`
          INSERT INTO attachments_analytics (
            id, email_id, account_id, filename, mime_type, size_bytes, content_hash, extracted_at
          ) VALUES ${placeholders.join(', ')}
        `, batchParams);

        attachmentsSynced += batch.length;
      } catch (error) {
        // Fall back to individual inserts on batch failure
        for (const attachment of batch) {
          try {
            await runDuckDB(`
              INSERT INTO attachments_analytics (
                id, email_id, account_id, filename, mime_type, size_bytes, content_hash, extracted_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              attachment.id,
              attachment.email_id,
              attachment.account_id,
              attachment.filename,
              attachment.mime_type,
              attachment.size_bytes,
              attachment.content_hash,
              attachment.extracted_at,
            ]);

            attachmentsSynced++;
          } catch (rowError) {
            errors.push(`Attachment ${attachment.id}: ${rowError instanceof Error ? rowError.message : String(rowError)}`);
          }
        }
      }
    }

  } catch (error) {
    errors.push(`Sync failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return {
    emailsSynced,
    attachmentsSynced,
    duration: Date.now() - startTime,
    errors,
  };
}

/**
 * Get sync status
 */
export async function getSyncStatus(): Promise<{
  duckdbEmails: number;
  duckdbAttachments: number;
  sqliteEmails: number;
  sqliteAttachments: number;
  inSync: boolean;
}> {
  const sqliteDb = getDatabase();

  // DuckDB counts
  const duckdbEmailCount = await queryDuckDB<{ count: number }>(
    'SELECT COUNT(*) as count FROM emails_analytics'
  );
  const duckdbAttachmentCount = await queryDuckDB<{ count: number }>(
    'SELECT COUNT(*) as count FROM attachments_analytics'
  );

  // SQLite counts
  const sqliteEmailCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM emails')
    .get() as { count: number };
  const sqliteAttachmentCount = sqliteDb.prepare('SELECT COUNT(*) as count FROM attachments')
    .get() as { count: number };

  const duckdbEmails = duckdbEmailCount[0]?.count || 0;
  const duckdbAttachments = duckdbAttachmentCount[0]?.count || 0;
  const sqliteEmails = sqliteEmailCount.count;
  const sqliteAttachments = sqliteAttachmentCount.count;

  return {
    duckdbEmails,
    duckdbAttachments,
    sqliteEmails,
    sqliteAttachments,
    inSync: duckdbEmails === sqliteEmails && duckdbAttachments === sqliteAttachments,
  };
}

/**
 * Incremental sync (only new/updated emails)
 * TODO: Implement based on updated_at tracking
 */
export async function incrementalSync(_since: Date): Promise<SyncResult> {
  // For now, just do a full sync
  // In production, we'd track updated_at and only sync changed records
  return syncAllEmails();
}
