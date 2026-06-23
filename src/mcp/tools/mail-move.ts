/**
 * Mail Move Tool
 *
 * Move an email to a folder (Outlook) or relabel it (Gmail). Provider-routed:
 *  - Outlook: POST /messages/{id}/move with a folder id or well-known name
 *             ("archive", "deleteditems", "junkemail", ...).
 *  - Gmail:   no folders — emulate by adding the destination label and (for
 *             archive-like moves out of the inbox) removing the INBOX label.
 *
 * The local store's labels are updated best-effort to reflect the move.
 */

import { z } from 'zod';
import { moveAction } from '../../connectors/email-actions.js';

const MailMoveInputSchema = z.object({
  emailId: z.number().int().positive().describe('Local email ID to move'),
  destination: z
    .string()
    .min(1)
    .describe(
      'Destination folder. Outlook: a folder id or well-known name (archive, deleteditems, junkemail, inbox). Gmail: a label name, or "archive" to remove from the inbox.'
    ),
});

const MailMoveOutputSchema = z.object({
  success: z.boolean(),
  emailId: z.number().int().positive(),
  provider: z.string(),
  destination: z.string(),
  labels: z.array(z.string()),
});

export const mailMoveTool = {
  definition: {
    name: 'mail_move',
    description:
      'Move an email to a folder (Outlook) or apply a destination label (Gmail). Outlook accepts a folder id or well-known name (archive/deleteditems/junkemail/inbox). Gmail relabels; "archive" removes the INBOX label.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        emailId: { type: 'number', description: 'Local email ID to move' },
        destination: {
          type: 'string',
          description:
            'Outlook: folder id or well-known name (archive, deleteditems, junkemail, inbox). Gmail: label name, or "archive".',
        },
      },
      required: ['emailId', 'destination'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailMoveInputSchema.parse(args);

    const state = await moveAction(input.emailId, input.destination);

    const output = {
      success: true,
      emailId: input.emailId,
      provider: state.provider,
      destination: input.destination,
      labels: state.labels,
    };

    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(MailMoveOutputSchema.parse(output), null, 2) },
      ],
    };
  },
};

export type MailMoveInput = z.infer<typeof MailMoveInputSchema>;
export type MailMoveOutput = z.infer<typeof MailMoveOutputSchema>;
