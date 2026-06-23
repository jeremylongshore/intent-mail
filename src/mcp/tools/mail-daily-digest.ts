/**
 * Mail Daily Digest Tool
 *
 * One call that returns the full structured daily-review payload: a stats
 * header, priority-ranked category groups, and per-email triage (priority,
 * why, action, deadline, summary, citations, suggested action, available
 * actions). Backed by the shared buildDailyDigest engine so the MCP surface,
 * the live artifact, and the web app stay in lockstep.
 */

import { z } from 'zod';
import { buildDailyDigest } from '../../ai/daily-digest.js';

const MailDailyDigestInputSchema = z.object({
  accountId: z.number().int().positive().optional().describe('Account to digest (default: all accounts)'),
  limit: z.number().int().positive().max(200).default(50).describe('Max emails/threads to include (default 50)'),
  unreadOnly: z.boolean().default(false).describe('Only include unread mail'),
  sinceHours: z.number().int().positive().optional().describe('Only mail received in the last N hours'),
  useCache: z.boolean().default(true).describe('Reuse cached AI results for unchanged emails (fast re-open)'),
});

export const mailDailyDigestTool = {
  definition: {
    name: 'mail_daily_digest',
    description:
      'Build the daily email digest: a stats header (new / need-response / high-priority), priority-ranked category groups, and per-email triage (priority P1–P4, a one-line "why", action type, urgency signals, detected deadline, summary, citations, and the actions available via mail_action). Long threads are collapsed with a thread-size badge. This is the primary read for the daily check-in and the visual daily-review surface.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: { type: 'number', description: 'Account to digest (default: all accounts)' },
        limit: { type: 'number', description: 'Max emails/threads to include (default 50)', default: 50 },
        unreadOnly: { type: 'boolean', description: 'Only include unread mail', default: false },
        sinceHours: { type: 'number', description: 'Only mail received in the last N hours' },
        useCache: {
          type: 'boolean',
          description: 'Reuse cached AI results for unchanged emails (fast re-open)',
          default: true,
        },
      },
      required: [],
    },
  },

  handler: async (args: unknown) => {
    const input = MailDailyDigestInputSchema.parse(args);

    const digest = await buildDailyDigest({
      accountId: input.accountId,
      limit: input.limit,
      unreadOnly: input.unreadOnly,
      sinceHours: input.sinceHours,
      useCache: input.useCache,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(digest, null, 2),
        },
      ],
    };
  },
};

export type MailDailyDigestInput = z.infer<typeof MailDailyDigestInputSchema>;
