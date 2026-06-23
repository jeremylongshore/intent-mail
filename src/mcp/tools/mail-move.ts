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
import { getProviderClientForAccount } from '../../connectors/provider-client.js';
import { getEmailById, addLabels, removeLabels } from '../../storage/services/email-storage.js';

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

/** Destinations that mean "remove from inbox" on Gmail. */
const ARCHIVE_ALIASES = new Set(['archive', 'archived', 'all mail', 'allmail']);

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

    const email = getEmailById(input.emailId);
    if (!email) {
      throw new Error(`Email with ID ${input.emailId} not found`);
    }

    const client = await getProviderClientForAccount(email.accountId);
    const isArchive = ARCHIVE_ALIASES.has(input.destination.trim().toLowerCase());

    if (client.provider === 'outlook') {
      await client.outlook!.moveMessage(email.providerMessageId, input.destination);
      // Outlook folders are not mirrored into local labels; leave labels as-is.
    } else {
      // Gmail: relabel.
      if (isArchive) {
        await client.gmail!.modifyMessageLabels(email.providerMessageId, undefined, ['INBOX']);
        removeLabels(input.emailId, ['INBOX']);
      } else {
        await client.gmail!.modifyMessageLabels(email.providerMessageId, [input.destination], undefined);
        addLabels(input.emailId, [input.destination]);
      }
    }

    const updated = getEmailById(input.emailId);

    const output = {
      success: true,
      emailId: input.emailId,
      provider: client.provider,
      destination: input.destination,
      labels: updated?.labels ?? email.labels,
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
