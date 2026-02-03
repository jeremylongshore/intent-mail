/**
 * Mail Attachment Stats Tool
 *
 * Get statistics about email attachments and deduplication savings.
 */

import { z } from 'zod';
import { getAttachmentStats } from '../../storage/services/attachment-liberation.js';

/**
 * Input schema for mail_attachment_stats
 */
const MailAttachmentStatsInputSchema = z.object({
  accountId: z.number().int().positive().optional().describe('Filter by specific account ID'),
});

/**
 * Output schema for mail_attachment_stats
 */
const MailAttachmentStatsOutputSchema = z.object({
  totalAttachments: z.number(),
  extractedAttachments: z.number(),
  pendingExtraction: z.number(),
  uniqueFiles: z.number(),
  duplicateFiles: z.number(),
  totalStorageBytes: z.number(),
  totalStorageHuman: z.string(),
  deduplicationSavings: z.number(),
  deduplicationSavingsHuman: z.string(),
  deduplicationRatio: z.number(),
  deduplicationPercent: z.string(),
  byMimeType: z.record(z.object({
    count: z.number(),
    bytes: z.number(),
    bytesHuman: z.string(),
  })),
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
 * Mail attachment stats tool definition and handler
 */
export const mailAttachmentStatsTool = {
  definition: {
    name: 'mail_attachment_stats',
    description: `Get statistics about email attachments.

Returns:
- Total attachment count and size
- Extraction progress (extracted vs pending)
- Deduplication metrics (unique files, duplicates, savings)
- Breakdown by MIME type`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: {
          type: 'number',
          description: 'Filter by specific account ID',
        },
      },
    },
  },

  handler: async (args: unknown) => {
    const input = MailAttachmentStatsInputSchema.parse(args);

    const stats = getAttachmentStats(input.accountId);

    // Format MIME type stats
    const byMimeType: Record<string, { count: number; bytes: number; bytesHuman: string }> = {};
    for (const [mimeType, data] of Object.entries(stats.byMimeType)) {
      byMimeType[mimeType] = {
        count: data.count,
        bytes: data.bytes,
        bytesHuman: formatBytes(data.bytes),
      };
    }

    const output = {
      totalAttachments: stats.totalAttachments,
      extractedAttachments: stats.extractedAttachments,
      pendingExtraction: stats.pendingExtraction,
      uniqueFiles: stats.uniqueFiles,
      duplicateFiles: stats.duplicateFiles,
      totalStorageBytes: stats.totalStorageBytes,
      totalStorageHuman: formatBytes(stats.totalStorageBytes),
      deduplicationSavings: stats.deduplicationSavings,
      deduplicationSavingsHuman: formatBytes(stats.deduplicationSavings),
      deduplicationRatio: stats.deduplicationRatio,
      deduplicationPercent: `${(stats.deduplicationRatio * 100).toFixed(1)}%`,
      byMimeType,
    };

    const validated = MailAttachmentStatsOutputSchema.parse(output);

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

export type MailAttachmentStatsInput = z.infer<typeof MailAttachmentStatsInputSchema>;
export type MailAttachmentStatsOutput = z.infer<typeof MailAttachmentStatsOutputSchema>;
