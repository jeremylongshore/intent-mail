/**
 * Mail Unstage Tool
 *
 * Restore emails from deletion staging back to normal state.
 */

import { z } from 'zod';
import { unstageEmails } from '../../storage/services/deletion-staging.js';

/**
 * Input schema for mail_unstage
 */
const MailUnstageInputSchema = z.object({
  emailIds: z.array(z.number().int().positive()).min(1).max(100).describe('Email IDs to unstage'),
});

/**
 * Output schema for mail_unstage
 */
const MailUnstageOutputSchema = z.object({
  unstaged: z.number(),
  errors: z.array(z.object({
    emailId: z.number(),
    error: z.string(),
  })),
  message: z.string(),
});

/**
 * Mail unstage tool definition and handler
 */
export const mailUnstageTool = {
  definition: {
    name: 'mail_unstage',
    description: `Restore emails from deletion staging.

This removes emails from the deletion queue and restores them to normal state.
The email will no longer be scheduled for deletion.

Use this when you've reviewed staged emails and want to keep some.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        emailIds: {
          type: 'array',
          items: { type: 'number' },
          description: 'Email IDs to unstage (max 100)',
        },
      },
      required: ['emailIds'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailUnstageInputSchema.parse(args);

    const result = unstageEmails(input.emailIds);

    const output = {
      unstaged: result.unstaged,
      errors: result.errors,
      message: result.unstaged > 0
        ? `${result.unstaged} email(s) restored from deletion staging.`
        : 'No emails were unstaged.',
    };

    const validated = MailUnstageOutputSchema.parse(output);

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

export type MailUnstageInput = z.infer<typeof MailUnstageInputSchema>;
export type MailUnstageOutput = z.infer<typeof MailUnstageOutputSchema>;
