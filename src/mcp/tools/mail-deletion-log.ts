/**
 * Mail Deletion Log Tool
 *
 * View deletion history for audit trail.
 */

import { z } from 'zod';
import { getDeletionLog } from '../../storage/services/deletion-staging.js';

/**
 * Input schema for mail_deletion_log
 */
const MailDeletionLogInputSchema = z.object({
  accountId: z.number().int().positive().optional().describe('Filter by specific account ID'),
  includeUncommitted: z.boolean().default(true).describe('Include staged (not yet deleted) entries'),
  limit: z.number().int().positive().max(100).default(50).describe('Number of results (max 100)'),
  offset: z.number().int().nonnegative().default(0).describe('Pagination offset'),
});

/**
 * Output schema for mail_deletion_log
 */
const MailDeletionLogOutputSchema = z.object({
  entries: z.array(z.object({
    id: z.number(),
    emailId: z.number(),
    accountId: z.number(),
    providerMessageId: z.string(),
    emailSubject: z.string(),
    emailFrom: z.string(),
    emailDate: z.string(),
    stagedAt: z.string(),
    backupPath: z.string().nullable(),
    committedAt: z.string().nullable(),
    committedBy: z.string().nullable(),
    retentionDays: z.number(),
    expiresAt: z.string(),
    status: z.enum(['staged', 'deleted', 'expired']),
  })),
  total: z.number(),
  hasMore: z.boolean(),
  summary: z.object({
    totalEntries: z.number(),
    staged: z.number(),
    deleted: z.number(),
  }),
});

/**
 * Mail deletion log tool definition and handler
 */
export const mailDeletionLogTool = {
  definition: {
    name: 'mail_deletion_log',
    description: `View deletion history for audit purposes.

Shows:
- All deletion events (staging and commits)
- Email details at time of deletion
- Backup paths for recovery
- Timestamps and who committed the deletion

Use this for:
- Auditing deletion activity
- Finding backup paths for recovery
- Tracking deletion patterns`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: {
          type: 'number',
          description: 'Filter by specific account ID',
        },
        includeUncommitted: {
          type: 'boolean',
          description: 'Include staged (not yet deleted) entries (default true)',
          default: true,
        },
        limit: {
          type: 'number',
          description: 'Number of results (max 100, default 50)',
          default: 50,
        },
        offset: {
          type: 'number',
          description: 'Pagination offset (default 0)',
          default: 0,
        },
      },
    },
  },

  handler: async (args: unknown) => {
    const input = MailDeletionLogInputSchema.parse(args);

    const result = getDeletionLog(
      input.accountId,
      input.includeUncommitted,
      input.limit,
      input.offset
    );

    // Add status to each entry
    const now = new Date();
    const entries = result.entries.map((e) => {
      let status: 'staged' | 'deleted' | 'expired';
      if (e.committedAt) {
        status = 'deleted';
      } else if (new Date(e.expiresAt) < now) {
        status = 'expired';
      } else {
        status = 'staged';
      }

      return { ...e, status };
    });

    // Calculate summary
    const staged = entries.filter((e) => e.status === 'staged').length;
    const deleted = entries.filter((e) => e.status === 'deleted').length;

    const output = {
      entries,
      total: result.total,
      hasMore: input.offset + entries.length < result.total,
      summary: {
        totalEntries: result.total,
        staged,
        deleted,
      },
    };

    const validated = MailDeletionLogOutputSchema.parse(output);

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

export type MailDeletionLogInput = z.infer<typeof MailDeletionLogInputSchema>;
export type MailDeletionLogOutput = z.infer<typeof MailDeletionLogOutputSchema>;
