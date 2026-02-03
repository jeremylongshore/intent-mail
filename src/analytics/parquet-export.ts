/**
 * Parquet Export Service
 *
 * Export email data to Parquet format for interoperability
 * with data science tools (pandas, Spark, BigQuery, etc.)
 */

import * as path from 'path';
import * as fs from 'fs';
import { runDuckDB, queryDuckDB } from './duckdb.js';

/**
 * Default export directory
 */
const DEFAULT_EXPORT_DIR = './data/exports';

/**
 * Export result
 */
export interface ExportResult {
  success: boolean;
  filePath: string;
  rowCount: number;
  sizeBytes: number;
  duration: number;
  error?: string;
}

/**
 * Export emails to Parquet file
 */
export async function exportEmailsToParquet(
  outputPath?: string,
  accountId?: number
): Promise<ExportResult> {
  const startTime = Date.now();

  // Ensure export directory exists
  const exportDir = outputPath ? path.dirname(outputPath) : DEFAULT_EXPORT_DIR;
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = outputPath || path.join(
    DEFAULT_EXPORT_DIR,
    `emails_${accountId || 'all'}_${timestamp}.parquet`
  );

  try {
    // Build query
    let whereClause = '';
    const params: unknown[] = [];

    if (accountId !== undefined) {
      whereClause = 'WHERE account_id = ?';
      params.push(accountId);
    }

    // Count rows first
    const countResult = await queryDuckDB<{ count: number }>(
      `SELECT COUNT(*) as count FROM emails_analytics ${whereClause}`,
      params
    );
    const rowCount = countResult[0]?.count || 0;

    if (rowCount === 0) {
      return {
        success: false,
        filePath: filename,
        rowCount: 0,
        sizeBytes: 0,
        duration: Date.now() - startTime,
        error: 'No emails to export',
      };
    }

    // Export to Parquet using DuckDB's COPY command
    await runDuckDB(`
      COPY (
        SELECT
          id,
          account_id,
          provider_message_id,
          thread_id,
          from_address,
          from_name,
          from_domain,
          subject,
          snippet,
          date,
          received_at,
          is_read,
          is_flagged,
          is_draft,
          is_answered,
          size_bytes,
          has_attachments,
          labels,
          synced_at
        FROM emails_analytics
        ${whereClause}
      ) TO '${filename}' (FORMAT PARQUET, COMPRESSION 'zstd')
    `);

    // Get file size
    const stats = fs.statSync(filename);

    return {
      success: true,
      filePath: filename,
      rowCount,
      sizeBytes: stats.size,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      filePath: filename,
      rowCount: 0,
      sizeBytes: 0,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Export attachments to Parquet file
 */
export async function exportAttachmentsToParquet(
  outputPath?: string,
  accountId?: number
): Promise<ExportResult> {
  const startTime = Date.now();

  // Ensure export directory exists
  const exportDir = outputPath ? path.dirname(outputPath) : DEFAULT_EXPORT_DIR;
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = outputPath || path.join(
    DEFAULT_EXPORT_DIR,
    `attachments_${accountId || 'all'}_${timestamp}.parquet`
  );

  try {
    // Build query
    let whereClause = '';
    const params: unknown[] = [];

    if (accountId !== undefined) {
      whereClause = 'WHERE account_id = ?';
      params.push(accountId);
    }

    // Count rows first
    const countResult = await queryDuckDB<{ count: number }>(
      `SELECT COUNT(*) as count FROM attachments_analytics ${whereClause}`,
      params
    );
    const rowCount = countResult[0]?.count || 0;

    if (rowCount === 0) {
      return {
        success: false,
        filePath: filename,
        rowCount: 0,
        sizeBytes: 0,
        duration: Date.now() - startTime,
        error: 'No attachments to export',
      };
    }

    // Export to Parquet
    await runDuckDB(`
      COPY (
        SELECT
          id,
          email_id,
          account_id,
          filename,
          mime_type,
          size_bytes,
          content_hash,
          extracted_at
        FROM attachments_analytics
        ${whereClause}
      ) TO '${filename}' (FORMAT PARQUET, COMPRESSION 'zstd')
    `);

    // Get file size
    const stats = fs.statSync(filename);

    return {
      success: true,
      filePath: filename,
      rowCount,
      sizeBytes: stats.size,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      filePath: filename,
      rowCount: 0,
      sizeBytes: 0,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * List existing Parquet exports
 */
export function listExports(exportDir: string = DEFAULT_EXPORT_DIR): Array<{
  filename: string;
  path: string;
  sizeBytes: number;
  createdAt: string;
}> {
  if (!fs.existsSync(exportDir)) {
    return [];
  }

  const files = fs.readdirSync(exportDir)
    .filter((f) => f.endsWith('.parquet'));

  return files.map((filename) => {
    const filePath = path.join(exportDir, filename);
    const stats = fs.statSync(filePath);
    return {
      filename,
      path: filePath,
      sizeBytes: stats.size,
      createdAt: stats.birthtime.toISOString(),
    };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Delete an export file
 */
export function deleteExport(filePath: string): boolean {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}
