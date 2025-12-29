/**
 * Mail Summarize Tool
 *
 * AI-powered email summarization with structured output.
 * Supports single email, thread, and batch summarization.
 */

import { z } from 'zod';
import {
  summarizeEmail,
  summarizeThread,
  batchSummarize,
  EmailSummarySchema,
  type EmailSummary,
} from '../../ai/summarizer.js';
import { getEmailById, getEmailsByThreadId } from '../../storage/services/email-storage.js';

/**
 * Input schema for mail_summarize
 */
const MailSummarizeInputSchema = z.object({
  // Single email ID
  emailId: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('ID of a single email to summarize'),

  // Thread ID for thread summarization
  threadId: z
    .string()
    .optional()
    .describe('Thread ID to summarize all emails in the thread'),

  // Multiple email IDs for batch summarization
  emailIds: z
    .array(z.number().int().positive())
    .optional()
    .describe('Array of email IDs for batch summarization'),

  // Options
  includeActionItems: z
    .boolean()
    .default(true)
    .describe('Include extracted action items in the summary'),
});

/**
 * Output schema for mail_summarize
 */
const SingleSummaryOutputSchema = z.object({
  type: z.literal('single'),
  emailId: z.number().int().positive(),
  summary: EmailSummarySchema,
});

const ThreadSummaryOutputSchema = z.object({
  type: z.literal('thread'),
  threadId: z.string(),
  messageCount: z.number().int().nonnegative(),
  summary: EmailSummarySchema,
});

const BatchSummaryOutputSchema = z.object({
  type: z.literal('batch'),
  count: z.number().int().nonnegative(),
  summaries: z.array(
    z.object({
      emailId: z.number().int().positive(),
      summary: EmailSummarySchema,
    })
  ),
});

const MailSummarizeOutputSchema = z.union([
  SingleSummaryOutputSchema,
  ThreadSummaryOutputSchema,
  BatchSummaryOutputSchema,
]);

type MailSummarizeOutput = z.infer<typeof MailSummarizeOutputSchema>;

/**
 * Mail summarize tool definition and handler
 */
export const mailSummarizeTool = {
  definition: {
    name: 'mail_summarize',
    description:
      'Summarize an email or thread using AI. Returns structured summary with key points, action items, sentiment, and category classification.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        emailId: {
          type: 'number',
          description: 'ID of a single email to summarize',
        },
        threadId: {
          type: 'string',
          description: 'Thread ID to summarize all emails in the thread',
        },
        emailIds: {
          type: 'array',
          items: {
            type: 'number',
          },
          description: 'Array of email IDs for batch summarization',
        },
        includeActionItems: {
          type: 'boolean',
          description: 'Include extracted action items in the summary (default: true)',
          default: true,
        },
      },
    },
  },

  handler: async (args: unknown) => {
    // Validate input
    const input = MailSummarizeInputSchema.parse(args);

    // Ensure at least one mode is specified
    if (!input.emailId && !input.threadId && !input.emailIds) {
      throw new Error('Must specify one of: emailId, threadId, or emailIds');
    }

    let output: MailSummarizeOutput;

    // Mode 1: Single email summarization
    if (input.emailId) {
      const email = getEmailById(input.emailId);
      if (!email) {
        throw new Error(`Email with ID ${input.emailId} not found`);
      }

      const summary = await summarizeEmail(email);

      // Optionally filter out action items
      const finalSummary: EmailSummary = input.includeActionItems
        ? summary
        : { ...summary, actionItems: [] };

      output = {
        type: 'single',
        emailId: input.emailId,
        summary: finalSummary,
      };
    }
    // Mode 2: Thread summarization
    else if (input.threadId) {
      const emails = getEmailsByThreadId(input.threadId);
      if (emails.length === 0) {
        throw new Error(`No emails found for thread ID ${input.threadId}`);
      }

      const summary = await summarizeThread(emails);

      const finalSummary: EmailSummary = input.includeActionItems
        ? summary
        : { ...summary, actionItems: [] };

      output = {
        type: 'thread',
        threadId: input.threadId,
        messageCount: emails.length,
        summary: finalSummary,
      };
    }
    // Mode 3: Batch summarization
    else if (input.emailIds && input.emailIds.length > 0) {
      // Fetch all emails
      const emails = input.emailIds
        .map((id) => {
          const email = getEmailById(id);
          return email ? { id, email } : null;
        })
        .filter((e): e is { id: number; email: NonNullable<ReturnType<typeof getEmailById>> } => e !== null);

      if (emails.length === 0) {
        throw new Error('No valid emails found for the provided IDs');
      }

      const summaryMap = await batchSummarize(emails.map((e) => e.email));

      const summaries = emails.map(({ id, email }) => {
        const summary = summaryMap.get(String(email.id)) || {
          oneLiner: 'Summarization failed',
          keyPoints: [],
          actionItems: [],
          sentiment: 'neutral' as const,
          category: 'other' as const,
        };

        const finalSummary: EmailSummary = input.includeActionItems
          ? summary
          : { ...summary, actionItems: [] };

        return {
          emailId: id,
          summary: finalSummary,
        };
      });

      output = {
        type: 'batch',
        count: summaries.length,
        summaries,
      };
    } else {
      throw new Error('Must specify one of: emailId, threadId, or emailIds');
    }

    // Validate output
    const validated = MailSummarizeOutputSchema.parse(output);

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

export type MailSummarizeInput = z.infer<typeof MailSummarizeInputSchema>;
export type { MailSummarizeOutput };
