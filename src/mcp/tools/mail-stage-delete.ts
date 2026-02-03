/**
 * Mail Stage Delete Tool
 *
 * Stage emails for deletion with a review period before permanent removal.
 */

import { z } from 'zod';
import { stageForDeletion } from '../../storage/services/deletion-staging.js';

/**
 * Input schema for mail_stage_delete
 */
const MailStageDeleteInputSchema = z.object({
  emailIds: z.array(z.number().int().positive()).min(1).max(100).describe('Email IDs to stage for deletion'),
  retentionDays: z.number().int().positive().max(365).default(30).describe('Days to retain before auto-commit (default 30)'),
  backupMime: z.boolean().default(true).describe('Create backup before deletion (default true)'),
  reason: z.string().optional().describe('Reason for deletion (for audit log)'),
});

/**
 * Output schema for mail_stage_delete
 */
const MailStageDeleteOutputSchema = z.object({
  staged: z.number(),
  errors: z.array(z.object({
    emailId: z.number(),
    error: z.string(),
  })),
  retentionDays: z.number(),
  expiresAt: z.string(),
  message: z.string(),
});

/**
 * Mail stage delete tool definition and handler
 */
export const mailStageDeleteTool = {
  definition: {
    name: 'mail_stage_delete',
    description: `Stage emails for deletion with a review period.

This is the SAFE way to delete emails:
1. Emails are marked for deletion but NOT removed
2. A MIME backup is created for recovery
3. Emails can be reviewed with mail_list_staged
4. Use mail_unstage to restore emails
5. Use mail_commit_deletions to permanently delete after review

Default retention: 30 days before auto-expiry.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        emailIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Email IDs to stage for deletion (max 100)',
        },
        retentionDays: {
          type: 'number',
          description: 'Days to retain before auto-commit (default 30, max 365)',
          default: 30,
        },
        backupMime: {
          type: 'boolean',
          description: 'Create backup before deletion (default true)',
          default: true,
        },
        reason: {
          type: 'string',
          description: 'Reason for deletion (for audit log)',
        },
      },
      required: ['emailIds'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailStageDeleteInputSchema.parse(args);

    const result = stageForDeletion(input.emailIds, {
      retentionDays: input.retentionDays,
      backupMime: input.backupMime,
      reason: input.reason,
    });

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.retentionDays);

    const output = {
      staged: result.staged,
      errors: result.errors,
      retentionDays: input.retentionDays,
      expiresAt: expiresAt.toISOString(),
      message: result.staged > 0
        ? `${result.staged} email(s) staged for deletion. Use mail_list_staged to review, mail_unstage to restore, or mail_commit_deletions to permanently delete.`
        : 'No emails were staged.',
    };

    const validated = MailStageDeleteOutputSchema.parse(output);

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

export type MailStageDeleteInput = z.infer<typeof MailStageDeleteInputSchema>;
export type MailStageDeleteOutput = z.infer<typeof MailStageDeleteOutputSchema>;
