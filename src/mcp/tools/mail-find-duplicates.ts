/**
 * Mail Find Duplicates Tool
 *
 * Find duplicate attachments across emails based on content hash.
 */

import { z } from 'zod';
import { findDuplicates } from '../../storage/services/attachment-liberation.js';

/**
 * Input schema for mail_find_duplicates
 */
const MailFindDuplicatesInputSchema = z.object({
  accountId: z.number().int().positive().optional().describe('Filter by specific account ID'),
  minDuplicates: z.number().int().positive().default(2).describe('Minimum number of duplicates to report (default 2)'),
  limit: z.number().int().positive().max(100).default(20).describe('Max duplicate groups to return (max 100)'),
});

/**
 * Output schema for mail_find_duplicates
 */
const MailFindDuplicatesOutputSchema = z.object({
  duplicateGroups: z.array(z.object({
    contentHash: z.string(),
    filename: z.string(),
    sizeBytes: z.number(),
    sizeHuman: z.string(),
    mimeType: z.string(),
    duplicateCount: z.number(),
    wastedBytes: z.number(),
    wastedBytesHuman: z.string(),
    attachments: z.array(z.object({
      id: z.number(),
      emailId: z.number(),
      accountId: z.number(),
      filename: z.string(),
    })),
  })),
  totalDuplicateGroups: z.number(),
  totalWastedBytes: z.number(),
  totalWastedBytesHuman: z.string(),
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
 * Mail find duplicates tool definition and handler
 */
export const mailFindDuplicatesTool = {
  definition: {
    name: 'mail_find_duplicates',
    description: `Find duplicate attachments across emails.

Identifies files with identical content (by SHA-256 hash) that appear in multiple emails.
Shows:
- Duplicate groups sorted by wasted storage (largest first)
- All emails containing each duplicate
- Total wasted storage from duplicates

Use this to:
- Identify redundant attachments
- Find forwarded/copied files
- Assess storage optimization potential`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: {
          type: 'number',
          description: 'Filter by specific account ID',
        },
        minDuplicates: {
          type: 'number',
          description: 'Minimum number of duplicates to report (default 2)',
          default: 2,
        },
        limit: {
          type: 'number',
          description: 'Max duplicate groups to return (max 100, default 20)',
          default: 20,
        },
      },
    },
  },

  handler: async (args: unknown) => {
    const input = MailFindDuplicatesInputSchema.parse(args);

    const duplicates = findDuplicates(input.accountId, input.minDuplicates);

    // Calculate totals and format output
    let totalWastedBytes = 0;
    const duplicateGroups = duplicates.slice(0, input.limit).map((group) => {
      // Wasted bytes = (duplicates - 1) * size (we only need one copy)
      const wastedBytes = (group.attachments.length - 1) * group.sizeBytes;
      totalWastedBytes += wastedBytes;

      return {
        contentHash: group.contentHash,
        filename: group.filename,
        sizeBytes: group.sizeBytes,
        sizeHuman: formatBytes(group.sizeBytes),
        mimeType: group.mimeType,
        duplicateCount: group.attachments.length,
        wastedBytes,
        wastedBytesHuman: formatBytes(wastedBytes),
        attachments: group.attachments,
      };
    });

    const output = {
      duplicateGroups,
      totalDuplicateGroups: duplicates.length,
      totalWastedBytes,
      totalWastedBytesHuman: formatBytes(totalWastedBytes),
    };

    const validated = MailFindDuplicatesOutputSchema.parse(output);

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

export type MailFindDuplicatesInput = z.infer<typeof MailFindDuplicatesInputSchema>;
export type MailFindDuplicatesOutput = z.infer<typeof MailFindDuplicatesOutputSchema>;
