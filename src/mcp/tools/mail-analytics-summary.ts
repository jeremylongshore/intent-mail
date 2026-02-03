/**
 * Mail Analytics Summary Tool
 *
 * Aggregate statistics using DuckDB for fast analytics.
 */

import { z } from 'zod';
import {
  initDuckDB,
  getStorageSummary,
  getTopSenders,
  getEmailsByDomain,
  getLabelDistribution,
  getEmailVolumeByPeriod,
  getUnreadSummary,
} from '../../analytics/index.js';
import { syncAllEmails, getSyncStatus } from '../../analytics/sync-to-duckdb.js';

/**
 * Input schema for mail_analytics_summary
 */
const MailAnalyticsSummaryInputSchema = z.object({
  accountId: z.number().int().positive().optional().describe('Filter by specific account ID'),
  syncFirst: z.boolean().default(false).describe('Sync SQLite to DuckDB before querying'),
  sections: z.array(z.enum([
    'storage', 'topSenders', 'domains', 'labels', 'volume', 'unread'
  ])).default(['storage', 'topSenders', 'domains']).describe('Which analytics sections to include'),
});

/**
 * Output schema for mail_analytics_summary
 */
const MailAnalyticsSummaryOutputSchema = z.object({
  syncStatus: z.object({
    inSync: z.boolean(),
    sqliteEmails: z.number(),
    duckdbEmails: z.number(),
  }),
  storage: z.object({
    totalEmails: z.number(),
    totalAttachments: z.number(),
    emailSizeHuman: z.string(),
    attachmentSizeHuman: z.string(),
    totalSizeHuman: z.string(),
    deduplicationSavingsHuman: z.string(),
  }).optional(),
  topSenders: z.array(z.object({
    fromAddress: z.string(),
    emailCount: z.number(),
    unreadCount: z.number(),
  })).optional(),
  domains: z.array(z.object({
    domain: z.string(),
    emailCount: z.number(),
    totalSizeHuman: z.string(),
  })).optional(),
  labels: z.array(z.object({
    label: z.string(),
    emailCount: z.number(),
    unreadCount: z.number(),
  })).optional(),
  volume: z.array(z.object({
    period: z.string(),
    emailCount: z.number(),
  })).optional(),
  unread: z.object({
    totalUnread: z.number(),
    topDomains: z.array(z.object({
      domain: z.string(),
      count: z.number(),
    })),
    oldestUnread: z.string().nullable(),
  }).optional(),
});

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Mail analytics summary tool definition and handler
 */
export const mailAnalyticsSummaryTool = {
  definition: {
    name: 'mail_analytics_summary',
    description: `Get aggregate email analytics using DuckDB.

Provides high-performance analytics across your email archive:
- Storage usage and deduplication savings
- Top senders by email count
- Email volume by domain
- Label distribution
- Email volume over time
- Unread email summary

Use syncFirst=true to ensure DuckDB has the latest data from SQLite.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: {
          type: 'number',
          description: 'Filter by specific account ID',
        },
        syncFirst: {
          type: 'boolean',
          description: 'Sync SQLite to DuckDB before querying (default false)',
          default: false,
        },
        sections: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['storage', 'topSenders', 'domains', 'labels', 'volume', 'unread'],
          },
          description: 'Which analytics sections to include',
          default: ['storage', 'topSenders', 'domains'],
        },
      },
    },
  },

  handler: async (args: unknown) => {
    const input = MailAnalyticsSummaryInputSchema.parse(args);

    // Initialize DuckDB
    initDuckDB();

    // Sync if requested
    if (input.syncFirst) {
      await syncAllEmails(input.accountId);
    }

    // Get sync status
    const syncStatus = await getSyncStatus();

    // Build output based on requested sections
    const output: z.infer<typeof MailAnalyticsSummaryOutputSchema> = {
      syncStatus: {
        inSync: syncStatus.inSync,
        sqliteEmails: syncStatus.sqliteEmails,
        duckdbEmails: syncStatus.duckdbEmails,
      },
    };

    const sections = new Set(input.sections);

    if (sections.has('storage')) {
      const storage = await getStorageSummary(input.accountId);
      output.storage = {
        totalEmails: storage.totalEmails,
        totalAttachments: storage.totalAttachments,
        emailSizeHuman: formatBytes(storage.emailSizeBytes),
        attachmentSizeHuman: formatBytes(storage.attachmentSizeBytes),
        totalSizeHuman: formatBytes(storage.totalSizeBytes),
        deduplicationSavingsHuman: formatBytes(storage.deduplicationSavings),
      };
    }

    if (sections.has('topSenders')) {
      const senders = await getTopSenders(input.accountId, 10);
      output.topSenders = senders.map((s) => ({
        fromAddress: s.fromAddress,
        emailCount: Number(s.emailCount),
        unreadCount: Number(s.unreadCount),
      }));
    }

    if (sections.has('domains')) {
      const domains = await getEmailsByDomain(input.accountId, 10);
      output.domains = domains.map((d) => ({
        domain: d.domain,
        emailCount: Number(d.emailCount),
        totalSizeHuman: formatBytes(Number(d.totalSizeBytes)),
      }));
    }

    if (sections.has('labels')) {
      const labels = await getLabelDistribution(input.accountId, 10);
      output.labels = labels.map((l) => ({
        label: l.label,
        emailCount: Number(l.emailCount),
        unreadCount: Number(l.unreadCount),
      }));
    }

    if (sections.has('volume')) {
      const volume = await getEmailVolumeByPeriod(input.accountId, 'month', 12);
      output.volume = volume.map((v) => ({
        period: v.period,
        emailCount: Number(v.emailCount),
      }));
    }

    if (sections.has('unread')) {
      const unread = await getUnreadSummary(input.accountId);
      output.unread = {
        totalUnread: unread.totalUnread,
        topDomains: unread.unreadByDomain.map((d) => ({
          domain: d.domain,
          count: Number(d.count),
        })),
        oldestUnread: unread.oldestUnread,
      };
    }

    const validated = MailAnalyticsSummaryOutputSchema.parse(output);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(validated, null, 2),
        },
      ],
    };
  },
};

export type MailAnalyticsSummaryInput = z.infer<typeof MailAnalyticsSummaryInputSchema>;
export type MailAnalyticsSummaryOutput = z.infer<typeof MailAnalyticsSummaryOutputSchema>;
