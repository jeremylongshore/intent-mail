/**
 * Mail Flag Tool
 *
 * Flag or unflag an email for follow-up. Provider-routed:
 *  - Outlook: PATCH flag.flagStatus (flagged / notFlagged)
 *  - Gmail:   add/remove the STARRED label (Gmail's flag analog)
 *
 * The local store's FLAGGED flag is updated to match.
 */

import { z } from 'zod';
import { flagAction } from '../../connectors/email-actions.js';
import { EmailFlag } from '../../types/email.js';

const MailFlagInputSchema = z.object({
  emailId: z.number().int().positive().describe('Local email ID to flag/unflag'),
  flagged: z
    .boolean()
    .default(true)
    .describe('true to flag for follow-up, false to clear the flag'),
});

const MailFlagOutputSchema = z.object({
  success: z.boolean(),
  emailId: z.number().int().positive(),
  provider: z.string(),
  flagged: z.boolean(),
  flags: z.array(z.nativeEnum(EmailFlag)),
});

export const mailFlagTool = {
  definition: {
    name: 'mail_flag',
    description:
      'Flag or unflag an email for follow-up. Works for both Outlook (message flag) and Gmail (STARRED label). Writes through to the provider and updates the local store.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        emailId: { type: 'number', description: 'Local email ID to flag/unflag' },
        flagged: {
          type: 'boolean',
          description: 'true to flag (default), false to clear the flag',
          default: true,
        },
      },
      required: ['emailId'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailFlagInputSchema.parse(args);

    const state = await flagAction(input.emailId, input.flagged);

    const output = {
      success: true,
      emailId: input.emailId,
      provider: state.provider,
      flagged: input.flagged,
      flags: state.flags,
    };

    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(MailFlagOutputSchema.parse(output), null, 2) },
      ],
    };
  },
};

export type MailFlagInput = z.infer<typeof MailFlagInputSchema>;
export type MailFlagOutput = z.infer<typeof MailFlagOutputSchema>;
