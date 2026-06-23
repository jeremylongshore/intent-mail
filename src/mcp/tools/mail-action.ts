/**
 * Mail Action Tool
 *
 * One consolidated write verb for the daily-review surface. A discriminated
 * union of operations (mark_read, archive, stage_delete, flag, move,
 * unsubscribe), each delegating to the shared email-actions service (no logic
 * duplication). Returns the resulting newState so a UI can patch one row
 * optimistically. Destructive deletes remain two-phase (stage here, commit via
 * mail_commit_deletions).
 */

import { z } from 'zod';
import {
  flagAction,
  moveAction,
  markReadAction,
  archiveAction,
  stageDeleteAction,
  unsubscribeAction,
  ActionState,
} from '../../connectors/email-actions.js';

const MailActionInputSchema = z.object({
  emailId: z.number().int().positive().describe('Local email ID to act on'),
  op: z
    .enum(['mark_read', 'archive', 'stage_delete', 'flag', 'move', 'unsubscribe'])
    .describe('Operation to perform'),
  // op-specific params
  isRead: z.boolean().optional().describe('For mark_read: true (read) / false (unread). Default true.'),
  flagged: z.boolean().optional().describe('For flag: true (flag) / false (unflag). Default true.'),
  destination: z.string().optional().describe('For move: folder id / well-known name / Gmail label.'),
});

const MailActionOutputSchema = z.object({
  success: z.boolean(),
  emailId: z.number().int().positive(),
  op: z.string(),
  newState: z.object({
    emailId: z.number(),
    provider: z.string(),
    isRead: z.boolean(),
    flagged: z.boolean(),
    labels: z.array(z.string()),
    flags: z.array(z.string()),
    staged: z.boolean(),
  }),
});

export const mailActionTool = {
  definition: {
    name: 'mail_action',
    description:
      'Perform one inbox action on an email: mark_read, archive, flag, move, stage_delete, or unsubscribe. Writes through to the provider and returns the email\'s newState so a UI can update one row. Deletes are two-phase: stage_delete here, then mail_commit_deletions to finalize.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        emailId: { type: 'number', description: 'Local email ID to act on' },
        op: {
          type: 'string',
          enum: ['mark_read', 'archive', 'stage_delete', 'flag', 'move', 'unsubscribe'],
          description: 'Operation to perform',
        },
        isRead: { type: 'boolean', description: 'For mark_read (default true)' },
        flagged: { type: 'boolean', description: 'For flag (default true)' },
        destination: { type: 'string', description: 'For move: folder/label destination' },
      },
      required: ['emailId', 'op'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailActionInputSchema.parse(args);

    let newState: ActionState;
    switch (input.op) {
      case 'mark_read':
        newState = await markReadAction(input.emailId, input.isRead ?? true);
        break;
      case 'archive':
        newState = await archiveAction(input.emailId);
        break;
      case 'flag':
        newState = await flagAction(input.emailId, input.flagged ?? true);
        break;
      case 'move':
        if (!input.destination) {
          throw new Error('move requires a destination');
        }
        newState = await moveAction(input.emailId, input.destination);
        break;
      case 'stage_delete':
        newState = stageDeleteAction(input.emailId);
        break;
      case 'unsubscribe':
        newState = await unsubscribeAction(input.emailId);
        break;
      default: {
        // Exhaustiveness guard.
        const _never: never = input.op;
        throw new Error(`Unsupported op: ${String(_never)}`);
      }
    }

    const output = {
      success: true,
      emailId: input.emailId,
      op: input.op,
      newState,
    };

    return {
      content: [
        { type: 'text' as const, text: JSON.stringify(MailActionOutputSchema.parse(output), null, 2) },
      ],
    };
  },
};

export type MailActionInput = z.infer<typeof MailActionInputSchema>;
