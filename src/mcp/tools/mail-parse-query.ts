/**
 * Mail Parse Query Tool
 *
 * Debug tool to parse and validate Gmail-style search queries.
 * Shows the parsed AST and generated SQL for troubleshooting.
 */

import { z } from 'zod';
import { parseQuery, astToSql } from '../../search/index.js';

/**
 * Input schema for mail_parse_query
 */
const MailParseQueryInputSchema = z.object({
  query: z.string().describe('Gmail-style search query to parse'),
  showSql: z.boolean().default(true).describe('Include generated SQL in output'),
});

/**
 * Output schema for mail_parse_query
 */
const MailParseQueryOutputSchema = z.object({
  success: z.boolean(),
  query: z.string(),
  ast: z.unknown().optional(),
  sql: z.object({
    whereClause: z.string(),
    params: z.array(z.unknown()),
    useFts: z.boolean(),
    ftsQuery: z.string().optional(),
  }).optional(),
  errors: z.array(z.object({
    message: z.string(),
    position: z.number(),
    length: z.number(),
  })),
  supportedOperators: z.object({
    field: z.array(z.string()),
    has: z.array(z.string()),
    is: z.array(z.string()),
    size: z.array(z.string()),
    date: z.array(z.string()),
    other: z.array(z.string()),
  }),
});

/**
 * Supported operators documentation
 */
const SUPPORTED_OPERATORS = {
  field: ['from:', 'to:', 'cc:', 'bcc:', 'subject:', 'label:', 'filename:', 'in:'],
  has: ['has:attachment', 'has:drive', 'has:document', 'has:spreadsheet', 'has:presentation', 'has:youtube'],
  is: ['is:read', 'is:unread', 'is:starred', 'is:important', 'is:snoozed', 'is:muted'],
  size: ['larger:SIZE', 'smaller:SIZE (SIZE: 5M, 10K, 1024)'],
  date: ['before:DATE', 'after:DATE', 'older_than:PERIOD', 'newer_than:PERIOD (PERIOD: 7d, 2w, 1m, 1y)'],
  other: ['"exact phrase"', '-exclude', 'term1 OR term2', '(grouping)'],
};

/**
 * Mail parse query tool definition and handler
 */
export const mailParseQueryTool = {
  definition: {
    name: 'mail_parse_query',
    description: `Debug tool to parse and validate Gmail-style search queries.

Use this to:
- Verify query syntax is correct
- Understand how a query will be interpreted
- See the generated SQL for debugging
- View all supported operators

Examples:
  - query: "from:boss is:unread has:attachment"
  - query: "subject:meeting after:2025-01-01 -spam"
  - query: "larger:5M older_than:30d"`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Gmail-style search query to parse',
        },
        showSql: {
          type: 'boolean',
          description: 'Include generated SQL in output (default: true)',
          default: true,
        },
      },
      required: ['query'],
    },
  },

  handler: async (args: unknown) => {
    // Validate input
    const input = MailParseQueryInputSchema.parse(args);

    // Parse the query
    const parseResult = parseQuery(input.query);

    // Build output
    const output: z.infer<typeof MailParseQueryOutputSchema> = {
      success: parseResult.success,
      query: input.query,
      errors: parseResult.errors,
      supportedOperators: SUPPORTED_OPERATORS,
    };

    if (parseResult.success && parseResult.ast) {
      output.ast = parseResult.ast;

      if (input.showSql) {
        const sqlResult = astToSql(parseResult.ast);
        output.sql = sqlResult;
      }
    }

    // Validate output
    const validated = MailParseQueryOutputSchema.parse(output);

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

export type MailParseQueryInput = z.infer<typeof MailParseQueryInputSchema>;
export type MailParseQueryOutput = z.infer<typeof MailParseQueryOutputSchema>;
