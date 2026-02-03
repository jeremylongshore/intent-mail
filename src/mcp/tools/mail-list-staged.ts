/**
 * Mail List Staged Tool
 *
 * List emails staged for deletion with retention countdown.
 */

import { z } from 'zod';
import { listStagedEmails } from '../../storage/services/deletion-staging.js';

/**
 * Input schema for mail_list_staged
 */
const MailListStagedInputSchema = z.object({
  accountId: z.number().int().positive().optional().describe('Filter by specific account ID'),
  limit: z.number().int().positive().max(100).default(50).describe('Number of results (max 100)'),
  offset: z.number().int().nonnegative().default(0).describe('Pagination offset'),
});

/**
 * Output schema for mail_list_staged
 */
const MailListStagedOutputSchema = z.object({
  emails: z.array(z.object({
    id: z.number(),
    accountId: z.number(),
    providerMessageId: z.string(),
    subject: z.string(),
    from: z.string(),
    date: z.string(),
    stagedAt: z.string(),
    backupPath: z.string().nullable(),
    expiresAt: z.string(),
    daysUntilExpiry: z.number(),
  })),
  total: z.number(),
  hasMore: z.boolean(),
  summary: z.object({
    totalStaged: z.number(),
    expiringToday: z.number(),
    expiringThisWeek: z.number(),
  }),
});

/**
 * Mail list staged tool definition and handler
 */
export const mailListStagedTool = {
  definition: {
    name: 'mail_list_staged',
    description: `List emails staged for deletion.

Shows:
- Email details (subject, from, date)
- When it was staged
- Days until automatic expiry
- Backup path for recovery

Use this to review before calling mail_commit_deletions.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: {
          type: 'number',
          description: 'Filter by specific account ID',
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
    const input = MailListStagedInputSchema.parse(args);

    const result = listStagedEmails(input.accountId, input.limit, input.offset);

    // Calculate summary
    const expiringToday = result.emails.filter((e) => e.daysUntilExpiry <= 1).length;
    const expiringThisWeek = result.emails.filter((e) => e.daysUntilExpiry <= 7).length;

    const output = {
      emails: result.emails,
      total: result.total,
      hasMore: input.offset + result.emails.length < result.total,
      summary: {
        totalStaged: result.total,
        expiringToday,
        expiringThisWeek,
      },
    };

    const validated = MailListStagedOutputSchema.parse(output);

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

export type MailListStagedInput = z.infer<typeof MailListStagedInputSchema>;
export type MailListStagedOutput = z.infer<typeof MailListStagedOutputSchema>;
