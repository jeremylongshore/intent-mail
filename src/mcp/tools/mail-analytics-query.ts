/**
 * Mail Analytics Query Tool
 *
 * Run custom SQL queries against DuckDB for advanced analytics.
 */

import { z } from 'zod';
import { initDuckDB, queryDuckDB } from '../../analytics/index.js';

/**
 * Input schema for mail_analytics_query
 */
const MailAnalyticsQueryInputSchema = z.object({
  sql: z.string().min(1).describe('SQL query to execute (SELECT only)'),
  limit: z.number().int().positive().max(1000).default(100).describe('Max rows to return (max 1000)'),
});

/**
 * Output schema for mail_analytics_query
 */
const MailAnalyticsQueryOutputSchema = z.object({
  success: z.boolean(),
  rowCount: z.number(),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.unknown())),
  duration: z.number(),
  error: z.string().optional(),
  schema: z.object({
    tables: z.array(z.object({
      name: z.string(),
      description: z.string(),
      columns: z.array(z.string()),
    })),
  }),
});

/**
 * Available tables documentation
 */
const SCHEMA_DOC = {
  tables: [
    {
      name: 'emails_analytics',
      description: 'Email metadata optimized for analytics',
      columns: [
        'id', 'account_id', 'provider_message_id', 'thread_id',
        'from_address', 'from_name', 'from_domain', 'subject', 'snippet',
        'date', 'received_at',
        'is_read', 'is_flagged', 'is_draft', 'is_answered',
        'size_bytes', 'has_attachments', 'labels', 'synced_at',
      ],
    },
    {
      name: 'attachments_analytics',
      description: 'Attachment metadata for storage analysis',
      columns: [
        'id', 'email_id', 'account_id',
        'filename', 'mime_type', 'size_bytes',
        'content_hash', 'extracted_at',
      ],
    },
  ],
};

/**
 * Validate query is read-only
 */
function isReadOnlyQuery(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();

  // Must start with SELECT or WITH (for CTEs)
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    return false;
  }

  // Check for dangerous keywords
  const dangerous = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'CREATE', 'TRUNCATE', 'EXEC', 'EXECUTE'];
  for (const keyword of dangerous) {
    // Match word boundaries
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(sql)) {
      return false;
    }
  }

  return true;
}

/**
 * Mail analytics query tool definition and handler
 */
export const mailAnalyticsQueryTool = {
  definition: {
    name: 'mail_analytics_query',
    description: `Run custom SQL queries against the DuckDB analytics database.

Available tables:
- emails_analytics: Email metadata (from_address, from_domain, subject, date, is_read, size_bytes, etc.)
- attachments_analytics: Attachment metadata (filename, mime_type, size_bytes, content_hash)

Example queries:
- SELECT from_domain, COUNT(*) as cnt FROM emails_analytics GROUP BY from_domain ORDER BY cnt DESC LIMIT 10
- SELECT strftime(date, '%Y-%m') as month, COUNT(*) FROM emails_analytics GROUP BY month ORDER BY month DESC
- SELECT mime_type, SUM(size_bytes) as total FROM attachments_analytics GROUP BY mime_type ORDER BY total DESC

Only SELECT queries are allowed. Use mail_analytics_summary for pre-built queries.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        sql: {
          type: 'string',
          description: 'SQL query to execute (SELECT only)',
        },
        limit: {
          type: 'number',
          description: 'Max rows to return (max 1000, default 100)',
          default: 100,
        },
      },
      required: ['sql'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailAnalyticsQueryInputSchema.parse(args);
    const startTime = Date.now();

    // Validate query is read-only
    if (!isReadOnlyQuery(input.sql)) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              rowCount: 0,
              columns: [],
              rows: [],
              duration: 0,
              error: 'Only SELECT queries are allowed. Detected potentially dangerous SQL.',
              schema: SCHEMA_DOC,
            }, null, 2),
          },
        ],
      };
    }

    try {
      // Initialize DuckDB
      initDuckDB();

      // Add LIMIT if not present
      let sql = input.sql.trim();
      if (!sql.toUpperCase().includes('LIMIT')) {
        sql = `${sql} LIMIT ${input.limit}`;
      }

      // Execute query
      const rows = await queryDuckDB(sql);

      // Extract column names
      const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

      const output = {
        success: true,
        rowCount: rows.length,
        columns,
        rows: rows.slice(0, input.limit),
        duration: Date.now() - startTime,
        schema: SCHEMA_DOC,
      };

      const validated = MailAnalyticsQueryOutputSchema.parse(output);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(validated, null, 2),
          },
        ],
      };
    } catch (error) {
      const output = {
        success: false,
        rowCount: 0,
        columns: [],
        rows: [],
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        schema: SCHEMA_DOC,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(output, null, 2),
          },
        ],
      };
    }
  },
};

export type MailAnalyticsQueryInput = z.infer<typeof MailAnalyticsQueryInputSchema>;
export type MailAnalyticsQueryOutput = z.infer<typeof MailAnalyticsQueryOutputSchema>;
