/**
 * Pre-built Analytical Queries
 *
 * High-performance analytics queries using DuckDB.
 * These queries run hundreds of times faster than equivalent SQLite queries.
 */

import { queryDuckDB } from './duckdb.js';

/**
 * Top senders by email count
 */
export interface TopSender {
  fromAddress: string;
  fromName: string | null;
  fromDomain: string;
  emailCount: number;
  unreadCount: number;
  latestDate: string;
}

export async function getTopSenders(
  accountId?: number,
  limit: number = 20
): Promise<TopSender[]> {
  let whereClause = '';
  const params: unknown[] = [];

  if (accountId !== undefined) {
    whereClause = 'WHERE account_id = ?';
    params.push(accountId);
  }

  return queryDuckDB<TopSender>(`
    SELECT
      from_address as "fromAddress",
      from_name as "fromName",
      from_domain as "fromDomain",
      COUNT(*) as "emailCount",
      SUM(CASE WHEN NOT is_read THEN 1 ELSE 0 END) as "unreadCount",
      MAX(date) as "latestDate"
    FROM emails_analytics
    ${whereClause}
    GROUP BY from_address, from_name, from_domain
    ORDER BY "emailCount" DESC
    LIMIT ?
  `, [...params, limit]);
}

/**
 * Email volume by domain
 */
export interface DomainStats {
  domain: string;
  emailCount: number;
  totalSizeBytes: number;
  avgSizeBytes: number;
  withAttachments: number;
}

export async function getEmailsByDomain(
  accountId?: number,
  limit: number = 20
): Promise<DomainStats[]> {
  let whereClause = '';
  const params: unknown[] = [];

  if (accountId !== undefined) {
    whereClause = 'WHERE account_id = ?';
    params.push(accountId);
  }

  return queryDuckDB<DomainStats>(`
    SELECT
      from_domain as domain,
      COUNT(*) as "emailCount",
      COALESCE(SUM(size_bytes), 0) as "totalSizeBytes",
      COALESCE(AVG(size_bytes), 0) as "avgSizeBytes",
      SUM(CASE WHEN has_attachments THEN 1 ELSE 0 END) as "withAttachments"
    FROM emails_analytics
    ${whereClause}
    GROUP BY from_domain
    ORDER BY "emailCount" DESC
    LIMIT ?
  `, [...params, limit]);
}

/**
 * Email volume over time
 */
export interface TimeSeriesPoint {
  period: string;
  emailCount: number;
  sizeBytes: number;
}

export async function getEmailVolumeByPeriod(
  accountId?: number,
  periodType: 'day' | 'week' | 'month' | 'year' = 'month',
  limit: number = 12
): Promise<TimeSeriesPoint[]> {
  let whereClause = '';
  const params: unknown[] = [];

  if (accountId !== undefined) {
    whereClause = 'WHERE account_id = ?';
    params.push(accountId);
  }

  const periodFormat = {
    day: "strftime(date, '%Y-%m-%d')",
    week: "strftime(date, '%Y-W%W')",
    month: "strftime(date, '%Y-%m')",
    year: "strftime(date, '%Y')",
  }[periodType];

  return queryDuckDB<TimeSeriesPoint>(`
    SELECT
      ${periodFormat} as period,
      COUNT(*) as "emailCount",
      COALESCE(SUM(size_bytes), 0) as "sizeBytes"
    FROM emails_analytics
    ${whereClause}
    GROUP BY period
    ORDER BY period DESC
    LIMIT ?
  `, [...params, limit]);
}

/**
 * Label distribution
 */
export interface LabelStats {
  label: string;
  emailCount: number;
  unreadCount: number;
}

export async function getLabelDistribution(
  accountId?: number,
  limit: number = 20
): Promise<LabelStats[]> {
  let whereClause = '';
  const params: unknown[] = [];

  if (accountId !== undefined) {
    whereClause = 'WHERE account_id = ?';
    params.push(accountId);
  }

  return queryDuckDB<LabelStats>(`
    SELECT
      unnest(labels) as label,
      COUNT(*) as "emailCount",
      SUM(CASE WHEN NOT is_read THEN 1 ELSE 0 END) as "unreadCount"
    FROM emails_analytics
    ${whereClause}
    GROUP BY label
    ORDER BY "emailCount" DESC
    LIMIT ?
  `, [...params, limit]);
}

/**
 * Attachment statistics by MIME type
 */
export interface MimeTypeStats {
  mimeType: string;
  count: number;
  totalSizeBytes: number;
  avgSizeBytes: number;
}

export async function getAttachmentsByMimeType(
  accountId?: number,
  limit: number = 20
): Promise<MimeTypeStats[]> {
  let whereClause = '';
  const params: unknown[] = [];

  if (accountId !== undefined) {
    whereClause = 'WHERE account_id = ?';
    params.push(accountId);
  }

  return queryDuckDB<MimeTypeStats>(`
    SELECT
      mime_type as "mimeType",
      COUNT(*) as count,
      SUM(size_bytes) as "totalSizeBytes",
      AVG(size_bytes) as "avgSizeBytes"
    FROM attachments_analytics
    ${whereClause}
    GROUP BY mime_type
    ORDER BY "totalSizeBytes" DESC
    LIMIT ?
  `, [...params, limit]);
}

/**
 * Storage usage summary
 */
export interface StorageSummary {
  totalEmails: number;
  totalAttachments: number;
  emailSizeBytes: number;
  attachmentSizeBytes: number;
  totalSizeBytes: number;
  uniqueAttachments: number;
  duplicateAttachments: number;
  deduplicationSavings: number;
}

export async function getStorageSummary(accountId?: number): Promise<StorageSummary> {
  let whereClause = '';
  const params: unknown[] = [];

  if (accountId !== undefined) {
    whereClause = 'WHERE account_id = ?';
    params.push(accountId);
  }

  // Email stats
  const emailStats = await queryDuckDB<{
    count: number;
    sizeBytes: number;
  }>(`
    SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as "sizeBytes"
    FROM emails_analytics
    ${whereClause}
  `, params);

  // Attachment stats
  const attachmentStats = await queryDuckDB<{
    count: number;
    sizeBytes: number;
    uniqueHashes: number;
  }>(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(size_bytes), 0) as "sizeBytes",
      COUNT(DISTINCT content_hash) as "uniqueHashes"
    FROM attachments_analytics
    ${whereClause}
  `, params);

  const totalEmails = emailStats[0]?.count || 0;
  const emailSizeBytes = Number(emailStats[0]?.sizeBytes || 0);
  const totalAttachments = attachmentStats[0]?.count || 0;
  const attachmentSizeBytes = Number(attachmentStats[0]?.sizeBytes || 0);
  const uniqueAttachments = attachmentStats[0]?.uniqueHashes || 0;
  const duplicateAttachments = totalAttachments - uniqueAttachments;

  // Estimate deduplication savings
  const avgAttachmentSize = totalAttachments > 0 ? attachmentSizeBytes / totalAttachments : 0;
  const deduplicationSavings = Math.floor(duplicateAttachments * avgAttachmentSize);

  return {
    totalEmails,
    totalAttachments,
    emailSizeBytes,
    attachmentSizeBytes,
    totalSizeBytes: emailSizeBytes + attachmentSizeBytes,
    uniqueAttachments,
    duplicateAttachments,
    deduplicationSavings,
  };
}

/**
 * Unread email summary
 */
export interface UnreadSummary {
  totalUnread: number;
  unreadByDomain: Array<{ domain: string; count: number }>;
  oldestUnread: string | null;
}

export async function getUnreadSummary(accountId?: number): Promise<UnreadSummary> {
  let whereClause = 'WHERE NOT is_read';
  const params: unknown[] = [];

  if (accountId !== undefined) {
    whereClause += ' AND account_id = ?';
    params.push(accountId);
  }

  // Total unread
  const totalRow = await queryDuckDB<{ count: number }>(`
    SELECT COUNT(*) as count FROM emails_analytics ${whereClause}
  `, params);

  // Unread by domain
  const byDomain = await queryDuckDB<{ domain: string; count: number }>(`
    SELECT from_domain as domain, COUNT(*) as count
    FROM emails_analytics
    ${whereClause}
    GROUP BY from_domain
    ORDER BY count DESC
    LIMIT 10
  `, params);

  // Oldest unread
  const oldestRow = await queryDuckDB<{ date: string }>(`
    SELECT MIN(date) as date FROM emails_analytics ${whereClause}
  `, params);

  return {
    totalUnread: totalRow[0]?.count || 0,
    unreadByDomain: byDomain,
    oldestUnread: oldestRow[0]?.date || null,
  };
}
