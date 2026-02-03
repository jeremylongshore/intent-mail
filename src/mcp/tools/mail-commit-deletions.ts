/**
 * Mail Commit Deletions Tool
 *
 * Permanently delete staged emails (requires confirmation).
 */

import { z } from 'zod';
import { commitDeletions, listStagedEmails } from '../../storage/services/deletion-staging.js';

/**
 * Input schema for mail_commit_deletions
 */
const MailCommitDeletionsInputSchema = z.object({
  emailIds: z.array(z.number().int().positive()).min(1).max(100).optional().describe('Specific email IDs to delete. If not provided, prompts for confirmation.'),
  confirm: z.boolean().default(false).describe('Must be true to actually delete. Safety check.'),
  deleteFromProvider: z.boolean().default(false).describe('Also delete from Gmail/Outlook (not just local)'),
});

/**
 * Output schema for mail_commit_deletions
 */
const MailCommitDeletionsOutputSchema = z.object({
  deleted: z.number(),
  errors: z.array(z.object({
    emailId: z.number(),
    error: z.string(),
  })),
  deletedFromProvider: z.boolean(),
  message: z.string(),
  staged: z.array(z.object({
    id: z.number(),
    subject: z.string(),
    from: z.string(),
    daysUntilExpiry: z.number(),
  })).optional(),
});

/**
 * Mail commit deletions tool definition and handler
 */
export const mailCommitDeletionsTool = {
  definition: {
    name: 'mail_commit_deletions',
    description: `Permanently delete staged emails.

IMPORTANT: This action is IRREVERSIBLE for local database.
If backups were created during staging, they remain on disk.

Workflow:
1. Call without confirm=true to see what will be deleted
2. Review the list of staged emails
3. Call again with confirm=true to actually delete

Set deleteFromProvider=true to also delete from Gmail/Outlook (NOT YET IMPLEMENTED).`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        emailIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Specific email IDs to delete (max 100). Omit to see staged list.',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to actually delete. Safety check.',
          default: false,
        },
        deleteFromProvider: {
          type: 'boolean',
          description: 'Also delete from Gmail/Outlook (not implemented yet)',
          default: false,
        },
      },
    },
  },

  handler: async (args: unknown) => {
    const input = MailCommitDeletionsInputSchema.parse(args);

    // If no confirm, just show what would be deleted
    if (!input.confirm) {
      const emailIds = input.emailIds || [];
      let stagedEmails;

      if (emailIds.length > 0) {
        // Get specific emails
        const result = listStagedEmails(undefined, 100);
        stagedEmails = result.emails.filter((e) => emailIds.includes(e.id));
      } else {
        // Get all staged emails
        const result = listStagedEmails(undefined, 20);
        stagedEmails = result.emails;
      }

      const output = {
        deleted: 0,
        errors: [],
        deletedFromProvider: false,
        message: `Would delete ${stagedEmails.length} email(s). Set confirm=true to proceed.`,
        staged: stagedEmails.map((e) => ({
          id: e.id,
          subject: e.subject,
          from: e.from,
          daysUntilExpiry: e.daysUntilExpiry,
        })),
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    }

    // Get email IDs to delete
    let emailIds = input.emailIds;
    if (!emailIds || emailIds.length === 0) {
      // If no specific IDs provided with confirm=true, that's an error
      const output = {
        deleted: 0,
        errors: [{ emailId: 0, error: 'Must specify emailIds when confirm=true' }],
        deletedFromProvider: false,
        message: 'No emails deleted. Please specify emailIds.',
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    }

    // Commit the deletions
    const result = commitDeletions(emailIds, 'user');

    // TODO: If deleteFromProvider is true, also delete from Gmail/Outlook

    const output = {
      deleted: result.deleted,
      errors: result.errors,
      deletedFromProvider: false, // Not implemented yet
      message: result.deleted > 0
        ? `${result.deleted} email(s) permanently deleted from local database.`
        : 'No emails were deleted.',
    };

    const validated = MailCommitDeletionsOutputSchema.parse(output);

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

export type MailCommitDeletionsInput = z.infer<typeof MailCommitDeletionsInputSchema>;
export type MailCommitDeletionsOutput = z.infer<typeof MailCommitDeletionsOutputSchema>;
