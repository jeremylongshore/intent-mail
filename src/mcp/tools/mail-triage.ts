/**
 * MCP Tool: mail_triage
 *
 * AI-powered inbox triage for email prioritization.
 * Auto-categorizes emails by priority and action needed.
 *
 * E3.S3.4: Inbox Triage
 */

import { z } from 'zod';
import {
  triageEmail,
  batchTriage,
  quickTriage,
  getInboxSummary,
} from '../../ai/inbox-triage.js';
import { getEmailById, searchEmails } from '../../storage/services/email-storage.js';

// ============================================================
// Input Schemas
// ============================================================

/**
 * Triage a single email
 */
const TriageSingleInputSchema = z.object({
  mode: z.literal('single'),
  /** Email ID to triage */
  emailId: z.number().int().positive(),
});

/**
 * Batch triage multiple emails
 */
const TriageBatchInputSchema = z.object({
  mode: z.literal('batch'),
  /** Account ID to filter emails */
  accountId: z.number().int().positive().optional(),
  /** Maximum emails to triage */
  limit: z.number().int().positive().max(50).default(20),
});

/**
 * Quick triage - just priority and action
 */
const TriageQuickInputSchema = z.object({
  mode: z.literal('quick'),
  /** Email ID to triage */
  emailId: z.number().int().positive(),
});

/**
 * Get inbox summary with triage statistics
 */
const TriageSummaryInputSchema = z.object({
  mode: z.literal('summary'),
  /** Account ID to filter emails */
  accountId: z.number().int().positive().optional(),
  /** Maximum emails to analyze */
  limit: z.number().int().positive().max(100).default(50),
});

/**
 * Combined input schema
 */
const MailTriageInputSchema = z.discriminatedUnion('mode', [
  TriageSingleInputSchema,
  TriageBatchInputSchema,
  TriageQuickInputSchema,
  TriageSummaryInputSchema,
]);

// ============================================================
// Tool Definition
// ============================================================

export const mailTriageTool = {
  definition: {
    name: 'mail_triage',
    description: `AI-powered inbox triage for email prioritization.
Auto-categorizes emails by priority (P1-P4) and action needed.

Priority Levels:
- P1 (Urgent): Needs immediate attention
- P2 (High): Important, handle today
- P3 (Normal): Standard priority
- P4 (Low): Can be deferred

Action Types:
- reply-needed: Requires a response
- follow-up: Needs follow-up later
- review: Needs review/decision
- delegate: Should be delegated
- schedule: Needs calendar action
- archive: Can be archived
- unsubscribe: Newsletter to unsubscribe
- waiting: Awaiting response
- info-only: FYI, no action needed

Modes:
- single: Triage one email with full analysis
- batch: Triage multiple emails with sorting
- quick: Get just priority and action type
- summary: Get inbox statistics and suggestions`,
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['single', 'batch', 'quick', 'summary'],
          description: 'Triage mode',
        },
        // Single/quick mode
        emailId: {
          type: 'integer',
          description: 'Email ID to triage',
        },
        // Batch/summary mode
        accountId: {
          type: 'integer',
          description: 'Filter by account ID',
        },
        limit: {
          type: 'integer',
          description: 'Maximum emails to process (default 20 for batch, 50 for summary)',
        },
      },
      required: ['mode'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailTriageInputSchema.parse(args);

    try {
      switch (input.mode) {
        case 'single': {
          const email = await getEmailById(input.emailId);
          if (!email) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Email with ID ${input.emailId} not found`,
                  }),
                },
              ],
            };
          }

          const result = await triageEmail(email);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'single',
                    triage: {
                      emailId: result.emailId,
                      subject: email.subject,
                      from: email.from,
                      priority: result.priority,
                      actionType: result.actionType,
                      secondaryAction: result.secondaryAction,
                      urgencySignals: result.urgencySignals,
                      deadline: result.deadline,
                      reason: result.reason,
                      confidence: result.confidence,
                      suggestedNextStep: result.suggestedNextStep,
                      estimatedTimeMinutes: result.estimatedTimeMinutes,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'batch': {
          // Fetch emails to triage
          const searchResult = searchEmails({
            accountId: input.accountId,
            limit: input.limit,
            offset: 0,
          });
          const emails = searchResult.items;

          if (emails.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    mode: 'batch',
                    message: 'No emails to triage',
                    results: [],
                    summary: {
                      totalEmails: 0,
                      byPriority: { P1: 0, P2: 0, P3: 0, P4: 0 },
                      byAction: {},
                      needsImmediateAttention: 0,
                      estimatedTotalTimeMinutes: 0,
                    },
                  }),
                },
              ],
            };
          }

          const results = await batchTriage(emails);

          // Enrich results with email subjects
          const enrichedResults = results.results.map((r) => {
            const email = emails.find((e) => e.id === r.emailId);
            return {
              ...r,
              subject: email?.subject || 'Unknown',
              from: email?.from || 'Unknown',
            };
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'batch',
                    results: enrichedResults,
                    summary: results.summary,
                    suggestedOrder: results.suggestedOrder,
                    executionTimeMs: results.executionTimeMs,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'quick': {
          const email = await getEmailById(input.emailId);
          if (!email) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Email with ID ${input.emailId} not found`,
                  }),
                },
              ],
            };
          }

          const result = await quickTriage(email);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'quick',
                    emailId: input.emailId,
                    subject: email.subject,
                    priority: result.priority,
                    actionType: result.actionType,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'summary': {
          // Fetch emails for summary
          const searchResult = searchEmails({
            accountId: input.accountId,
            limit: input.limit,
            offset: 0,
          });
          const emails = searchResult.items;

          const summary = await getInboxSummary(emails);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'summary',
                    analyzedEmails: emails.length,
                    summary: {
                      totalUnread: summary.totalUnread,
                      needsAction: summary.needsAction,
                      highPriority: summary.highPriority,
                      canArchive: summary.canArchive,
                    },
                    suggestions: summary.suggestions,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Unknown mode',
                }),
              },
            ],
          };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : 'Triage failed',
            }),
          },
        ],
      };
    }
  },
};
