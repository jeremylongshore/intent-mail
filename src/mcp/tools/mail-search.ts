/**
 * Mail Search Tool
 *
 * Search emails across all accounts with filters and full-text search.
 * Supports Gmail-style query syntax when useGmailSyntax is enabled.
 */

import { z } from 'zod';
import { EmailFlag, EmailSearchFilters } from '../../types/email.js';
import { searchEmails, searchEmailsWithGmailQuery } from '../../storage/services/email-storage.js';

/**
 * Input schema for mail_search
 */
const MailSearchInputSchema = z.object({
  // Full-text search query
  query: z.string().optional().describe(
    'Search query. When useGmailSyntax is true, supports Gmail operators like: ' +
    'from:user@example.com, to:team@, subject:meeting, has:attachment, is:unread, ' +
    'larger:5M, before:2025-01-01, older_than:7d, "exact phrase", -exclude, term1 OR term2'
  ),

  // Enable Gmail-style query syntax
  useGmailSyntax: z.boolean().default(false).describe(
    'Enable Gmail-style query syntax. When true, the query parameter supports operators like ' +
    'from:, to:, subject:, has:, is:, larger:, before:, after:, older_than:, newer_than:, etc.'
  ),

  // Filter by account
  accountId: z.number().int().positive().optional().describe('Filter by specific account ID'),

  // Field filters (only used when useGmailSyntax is false)
  from: z.string().optional().describe('Filter by sender email address (partial match)'),
  subject: z.string().optional().describe('Filter by subject (partial match)'),
  hasAttachments: z.boolean().optional().describe('Filter by attachment presence'),

  // Flags and labels
  flags: z.array(z.nativeEnum(EmailFlag)).optional().describe('Filter by email flags (SEEN, FLAGGED, etc.)'),
  labels: z.array(z.string()).optional().describe('Filter by labels/folders'),
  threadId: z.string().optional().describe('Filter by thread ID'),

  // Date range
  dateFrom: z.string().optional().describe('Filter emails from this date (ISO 8601)'),
  dateTo: z.string().optional().describe('Filter emails up to this date (ISO 8601)'),

  // Pagination
  limit: z.number().int().positive().max(100).default(50).describe('Number of results to return (max 100)'),
  offset: z.number().int().nonnegative().default(0).describe('Number of results to skip'),
});

/**
 * Output schema for mail_search
 */
const MailSearchOutputSchema = z.object({
  emails: z.array(
    z.object({
      id: z.number().int().positive(),
      accountId: z.number().int().positive(),
      providerMessageId: z.string(),
      threadId: z.string().optional(),
      from: z.object({
        address: z.string(),
        name: z.string().optional(),
      }),
      to: z.array(
        z.object({
          address: z.string(),
          name: z.string().optional(),
        })
      ),
      subject: z.string(),
      snippet: z.string().optional(),
      date: z.string(),
      flags: z.array(z.nativeEnum(EmailFlag)),
      labels: z.array(z.string()),
      hasAttachments: z.boolean(),
    })
  ),
  total: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  usedGmailSyntax: z.boolean().optional(),
});

/**
 * Mail search tool definition and handler
 */
export const mailSearchTool = {
  definition: {
    name: 'mail_search',
    description: `Search emails with filters and full-text search.

When useGmailSyntax is enabled, supports Gmail-style operators:
  - from:user@example.com  to:team@company.com  cc:manager@
  - subject:meeting  has:attachment  label:important
  - is:read / is:unread / is:starred
  - larger:5M / smaller:10K
  - before:2025-01-01  after:2024-06-01
  - older_than:7d / newer_than:1m
  - filename:report.pdf  in:inbox
  - "exact phrase"  -exclude
  - term1 OR term2

Examples:
  - query: "from:boss is:unread" with useGmailSyntax: true
  - query: "has:attachment larger:5M older_than:30d" with useGmailSyntax: true
  - query: "from:newsletter@company.com OR from:updates@company.com" with useGmailSyntax: true`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query. Supports Gmail operators when useGmailSyntax is true.',
        },
        useGmailSyntax: {
          type: 'boolean',
          description: 'Enable Gmail-style query syntax (from:, to:, has:, is:, etc.)',
          default: false,
        },
        accountId: {
          type: 'number',
          description: 'Filter by specific account ID',
        },
        from: {
          type: 'string',
          description: 'Filter by sender email address (partial match, ignored if useGmailSyntax is true)',
        },
        subject: {
          type: 'string',
          description: 'Filter by subject (partial match, ignored if useGmailSyntax is true)',
        },
        hasAttachments: {
          type: 'boolean',
          description: 'Filter by attachment presence (ignored if useGmailSyntax is true)',
        },
        flags: {
          type: 'array',
          items: {
            type: 'string',
            enum: Object.values(EmailFlag),
          },
          description: 'Filter by email flags (SEEN, FLAGGED, DRAFT, ANSWERED, DELETED)',
        },
        labels: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'Filter by labels/folders',
        },
        threadId: {
          type: 'string',
          description: 'Filter by thread ID',
        },
        dateFrom: {
          type: 'string',
          description: 'Filter emails from this date (ISO 8601, ignored if useGmailSyntax is true)',
        },
        dateTo: {
          type: 'string',
          description: 'Filter emails up to this date (ISO 8601, ignored if useGmailSyntax is true)',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (max 100, default 50)',
          default: 50,
        },
        offset: {
          type: 'number',
          description: 'Number of results to skip (for pagination, default 0)',
          default: 0,
        },
      },
    },
  },

  handler: async (args: unknown) => {
    // Validate input
    const input = MailSearchInputSchema.parse(args);

    let result;
    let usedGmailSyntax = false;

    if (input.useGmailSyntax && input.query) {
      // Use Gmail query syntax parser
      result = searchEmailsWithGmailQuery({
        gmailQuery: input.query,
        accountId: input.accountId,
        limit: input.limit,
        offset: input.offset,
      });
      usedGmailSyntax = true;
    } else {
      // Use traditional filter-based search
      const filters: EmailSearchFilters = {
        query: input.query,
        accountId: input.accountId,
        from: input.from,
        subject: input.subject,
        hasAttachments: input.hasAttachments,
        flags: input.flags,
        labels: input.labels,
        threadId: input.threadId,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        limit: input.limit,
        offset: input.offset,
      };
      result = searchEmails(filters);
    }

    // Map to simplified output format (exclude body content for search results)
    const output = {
      emails: result.items.map((email) => ({
        id: email.id,
        accountId: email.accountId,
        providerMessageId: email.providerMessageId,
        threadId: email.threadId,
        from: email.from,
        to: email.to,
        subject: email.subject,
        snippet: email.snippet,
        date: email.date,
        flags: email.flags,
        labels: email.labels,
        hasAttachments: email.hasAttachments,
      })),
      total: result.total,
      hasMore: result.hasMore,
      limit: input.limit,
      offset: input.offset,
      usedGmailSyntax,
    };

    // Validate output
    const validated = MailSearchOutputSchema.parse(output);

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

export type MailSearchInput = z.infer<typeof MailSearchInputSchema>;
export type MailSearchOutput = z.infer<typeof MailSearchOutputSchema>;
