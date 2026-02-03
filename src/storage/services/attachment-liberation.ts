/**
 * Attachment Liberation Service
 *
 * Extracts attachments from emails to filesystem with content-based deduplication.
 * Files are stored in a content-addressed manner using SHA-256 hashes.
 *
 * Storage structure:
 *   data/attachments/
 *     by-hash/ab/cd/abcd1234...     # Content-addressed (deduplicated)
 *     by-email/account/2025/01/     # Symlinks organized by email
 */

import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { getDatabase } from '../database.js';
import { StorageError } from '../../types/storage.js';
import { AttachmentRow } from '../../types/email.js';

/**
 * Configuration for attachment storage
 */
export interface AttachmentStorageConfig {
  basePath: string;
  createSymlinks: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AttachmentStorageConfig = {
  basePath: './data/attachments',
  createSymlinks: true,
};

/**
 * Result of extracting a single attachment
 */
export interface AttachmentExtractionResult {
  attachmentId: number;
  emailId: number;
  filename: string;
  contentHash: string;
  localPath: string;
  sizeBytes: number;
  deduplicated: boolean;
  existingPath?: string;
}

/**
 * Result of batch extraction
 */
export interface BatchExtractionResult {
  extracted: AttachmentExtractionResult[];
  skipped: number;
  errors: Array<{ attachmentId: number; error: string }>;
  totalBytes: number;
  savedBytes: number; // Bytes saved through deduplication
}

/**
 * Attachment statistics
 */
export interface AttachmentStats {
  totalAttachments: number;
  extractedAttachments: number;
  pendingExtraction: number;
  uniqueFiles: number;
  duplicateFiles: number;
  totalStorageBytes: number;
  deduplicationSavings: number;
  deduplicationRatio: number; // 0.0 to 1.0
  byMimeType: Record<string, { count: number; bytes: number }>;
}

/**
 * Duplicate attachment info
 */
export interface DuplicateGroup {
  contentHash: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  attachments: Array<{
    id: number;
    emailId: number;
    accountId: number;
    filename: string;
  }>;
}

/**
 * Calculate SHA-256 hash of content
 */
export function calculateContentHash(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Get content-addressed storage path for a hash
 */
export function getHashBasedPath(basePath: string, hash: string): string {
  // Use first 4 chars for 2-level directory structure: ab/cd/full-hash
  const dir1 = hash.substring(0, 2);
  const dir2 = hash.substring(2, 4);
  return path.join(basePath, 'by-hash', dir1, dir2, hash);
}

/**
 * Get email-organized path for symlinks
 */
export function getEmailBasedPath(
  basePath: string,
  accountId: number,
  emailDate: string,
  filename: string
): string {
  const date = new Date(emailDate);
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return path.join(basePath, 'by-email', accountId.toString(), year, month, filename);
}

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Extract a single attachment to filesystem
 */
export async function extractAttachment(
  attachmentId: number,
  content: Buffer,
  config: AttachmentStorageConfig = DEFAULT_CONFIG
): Promise<AttachmentExtractionResult> {
  const db = getDatabase();

  // Get attachment info
  const row = db.prepare(`
    SELECT a.*, e.account_id, e.date as email_date
    FROM attachments a
    JOIN emails e ON a.email_id = e.id
    WHERE a.id = ?
  `).get(attachmentId) as (AttachmentRow & { account_id: number; email_date: string }) | undefined;

  if (!row) {
    throw new StorageError(`Attachment ${attachmentId} not found`, 'ATTACHMENT_NOT_FOUND');
  }

  // Calculate content hash
  const contentHash = calculateContentHash(content);

  // Get hash-based storage path
  const hashPath = getHashBasedPath(config.basePath, contentHash);
  const hashDir = path.dirname(hashPath);

  let deduplicated = false;
  let existingPath: string | undefined;

  // Check if content already exists
  if (fs.existsSync(hashPath)) {
    deduplicated = true;
    existingPath = hashPath;
  } else {
    // Write to content-addressed storage
    ensureDir(hashDir);
    fs.writeFileSync(hashPath, content);
  }

  // Create symlink if enabled
  if (config.createSymlinks) {
    const symlinkPath = getEmailBasedPath(
      config.basePath,
      row.account_id,
      row.email_date,
      row.filename
    );
    const symlinkDir = path.dirname(symlinkPath);

    ensureDir(symlinkDir);

    // Remove existing symlink if any
    if (fs.existsSync(symlinkPath)) {
      fs.unlinkSync(symlinkPath);
    }

    // Create relative symlink
    const relativePath = path.relative(symlinkDir, hashPath);
    fs.symlinkSync(relativePath, symlinkPath);
  }

  // Update database
  db.prepare(`
    UPDATE attachments
    SET content_hash = ?,
        local_path = ?,
        extracted_at = datetime('now')
    WHERE id = ?
  `).run(contentHash, hashPath, attachmentId);

  return {
    attachmentId,
    emailId: row.email_id,
    filename: row.filename,
    contentHash,
    localPath: hashPath,
    sizeBytes: content.length,
    deduplicated,
    existingPath,
  };
}

/**
 * Get attachments pending extraction
 */
export function getPendingAttachments(
  accountId?: number,
  limit: number = 100
): Array<{ id: number; emailId: number; filename: string; sizeBytes: number }> {
  const db = getDatabase();

  let query = `
    SELECT a.id, a.email_id, a.filename, a.size_bytes
    FROM attachments a
    JOIN emails e ON a.email_id = e.id
    WHERE a.extracted_at IS NULL
  `;

  const params: unknown[] = [];
  if (accountId !== undefined) {
    query += ' AND e.account_id = ?';
    params.push(accountId);
  }

  query += ' ORDER BY e.date DESC LIMIT ?';
  params.push(limit);

  return db.prepare(query).all(...params) as Array<{
    id: number;
    emailId: number;
    filename: string;
    sizeBytes: number;
  }>;
}

/**
 * Get attachment statistics
 */
export function getAttachmentStats(accountId?: number): AttachmentStats {
  const db = getDatabase();

  let whereClause = '';
  const params: unknown[] = [];
  if (accountId !== undefined) {
    whereClause = 'WHERE e.account_id = ?';
    params.push(accountId);
  }

  // Total attachments
  const totalRow = db.prepare(`
    SELECT COUNT(*) as count, COALESCE(SUM(a.size_bytes), 0) as bytes
    FROM attachments a
    JOIN emails e ON a.email_id = e.id
    ${whereClause}
  `).get(...params) as { count: number; bytes: number };

  // Extracted attachments
  const extractedRow = db.prepare(`
    SELECT COUNT(*) as count
    FROM attachments a
    JOIN emails e ON a.email_id = e.id
    ${whereClause ? whereClause + ' AND' : 'WHERE'} a.extracted_at IS NOT NULL
  `).get(...params) as { count: number };

  // Unique files (by content hash)
  const uniqueRow = db.prepare(`
    SELECT COUNT(DISTINCT a.content_hash) as count
    FROM attachments a
    JOIN emails e ON a.email_id = e.id
    ${whereClause ? whereClause + ' AND' : 'WHERE'} a.content_hash IS NOT NULL
  `).get(...params) as { count: number };

  // Stats by MIME type
  const mimeStats = db.prepare(`
    SELECT a.mime_type, COUNT(*) as count, COALESCE(SUM(a.size_bytes), 0) as bytes
    FROM attachments a
    JOIN emails e ON a.email_id = e.id
    ${whereClause}
    GROUP BY a.mime_type
    ORDER BY bytes DESC
  `).all(...params) as Array<{ mime_type: string; count: number; bytes: number }>;

  const byMimeType: Record<string, { count: number; bytes: number }> = {};
  for (const stat of mimeStats) {
    byMimeType[stat.mime_type] = { count: stat.count, bytes: stat.bytes };
  }

  // Calculate deduplication savings
  const duplicateFiles = extractedRow.count - uniqueRow.count;
  const deduplicationSavings = duplicateFiles > 0
    ? Math.floor(totalRow.bytes * (duplicateFiles / extractedRow.count))
    : 0;
  const deduplicationRatio = extractedRow.count > 0
    ? duplicateFiles / extractedRow.count
    : 0;

  return {
    totalAttachments: totalRow.count,
    extractedAttachments: extractedRow.count,
    pendingExtraction: totalRow.count - extractedRow.count,
    uniqueFiles: uniqueRow.count,
    duplicateFiles,
    totalStorageBytes: totalRow.bytes,
    deduplicationSavings,
    deduplicationRatio,
    byMimeType,
  };
}

/**
 * Find duplicate attachments
 */
export function findDuplicates(
  accountId?: number,
  minDuplicates: number = 2
): DuplicateGroup[] {
  const db = getDatabase();

  let whereClause = 'WHERE a.content_hash IS NOT NULL';
  const params: unknown[] = [];
  if (accountId !== undefined) {
    whereClause += ' AND e.account_id = ?';
    params.push(accountId);
  }

  // Find content hashes with duplicates
  const duplicateHashes = db.prepare(`
    SELECT a.content_hash, COUNT(*) as count, MIN(a.filename) as filename,
           MIN(a.size_bytes) as size_bytes, MIN(a.mime_type) as mime_type
    FROM attachments a
    JOIN emails e ON a.email_id = e.id
    ${whereClause}
    GROUP BY a.content_hash
    HAVING COUNT(*) >= ?
    ORDER BY size_bytes * (COUNT(*) - 1) DESC
  `).all(...params, minDuplicates) as Array<{
    content_hash: string;
    count: number;
    filename: string;
    size_bytes: number;
    mime_type: string;
  }>;

  const groups: DuplicateGroup[] = [];

  for (const hash of duplicateHashes) {
    // Get all attachments with this hash
    const attachments = db.prepare(`
      SELECT a.id, a.email_id, a.filename, e.account_id
      FROM attachments a
      JOIN emails e ON a.email_id = e.id
      WHERE a.content_hash = ?
    `).all(hash.content_hash) as Array<{
      id: number;
      email_id: number;
      filename: string;
      account_id: number;
    }>;

    groups.push({
      contentHash: hash.content_hash,
      filename: hash.filename,
      sizeBytes: hash.size_bytes,
      mimeType: hash.mime_type,
      attachments: attachments.map((a) => ({
        id: a.id,
        emailId: a.email_id,
        accountId: a.account_id,
        filename: a.filename,
      })),
    });
  }

  return groups;
}

/**
 * Get attachment content from storage
 */
export function getAttachmentContent(
  attachmentId: number,
  _config: AttachmentStorageConfig = DEFAULT_CONFIG
): Buffer | null {
  const db = getDatabase();

  const row = db.prepare('SELECT local_path FROM attachments WHERE id = ?')
    .get(attachmentId) as { local_path: string | null } | undefined;

  if (!row || !row.local_path) {
    return null;
  }

  if (!fs.existsSync(row.local_path)) {
    return null;
  }

  return fs.readFileSync(row.local_path);
}

/**
 * Verify integrity of extracted attachments
 */
export function verifyAttachmentIntegrity(
  attachmentId: number,
  _config: AttachmentStorageConfig = DEFAULT_CONFIG
): { valid: boolean; error?: string } {
  const db = getDatabase();

  const row = db.prepare('SELECT content_hash, local_path FROM attachments WHERE id = ?')
    .get(attachmentId) as { content_hash: string | null; local_path: string | null } | undefined;

  if (!row) {
    return { valid: false, error: 'Attachment not found' };
  }

  if (!row.local_path || !row.content_hash) {
    return { valid: false, error: 'Attachment not extracted' };
  }

  if (!fs.existsSync(row.local_path)) {
    return { valid: false, error: 'File not found on disk' };
  }

  const content = fs.readFileSync(row.local_path);
  const actualHash = calculateContentHash(content);

  if (actualHash !== row.content_hash) {
    return { valid: false, error: 'Hash mismatch - file may be corrupted' };
  }

  return { valid: true };
}
