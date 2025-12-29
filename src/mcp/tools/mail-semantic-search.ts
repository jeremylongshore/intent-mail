/**
 * MCP Tool: mail_semantic_search
 *
 * AI-powered natural language email search.
 * Understands queries like "Find emails about the contract from last week".
 *
 * E3.S3.3: Semantic Search
 */

import { z } from 'zod';
import {
  semanticSearch,
  findSimilar,
  parseQuery,
  getSearchSuggestions,
} from '../../ai/semantic-search.js';

// ============================================================
// Input Schemas
// ============================================================

/**
 * Semantic search input
 */
const SemanticSearchInputSchema = z.object({
  mode: z.literal('search'),
  /** Natural language search query */
  query: z.string().min(3).describe('Natural language search query'),
  /** Filter by account */
  accountId: z.number().int().positive().optional(),
  /** Maximum results to return */
  limit: z.number().int().positive().max(50).default(20),
  /** Minimum relevance score (0-1) */
  minRelevance: z.number().min(0).max(1).default(0.3),
});

/**
 * Find similar emails input
 */
const FindSimilarInputSchema = z.object({
  mode: z.literal('similar'),
  /** Email ID to find similar emails for */
  emailId: z.number().int().positive(),
  /** Filter by account */
  accountId: z.number().int().positive().optional(),
  /** Maximum results to return */
  limit: z.number().int().positive().max(50).default(10),
});

/**
 * Parse query input (for understanding what the query means)
 */
const ParseQueryInputSchema = z.object({
  mode: z.literal('parse'),
  /** Natural language query to parse */
  query: z.string().min(3),
});

/**
 * Get suggestions input
 */
const GetSuggestionsInputSchema = z.object({
  mode: z.literal('suggest'),
  /** Partial query for suggestions */
  partialQuery: z.string(),
});

/**
 * Combined input schema
 */
const MailSemanticSearchInputSchema = z.discriminatedUnion('mode', [
  SemanticSearchInputSchema,
  FindSimilarInputSchema,
  ParseQueryInputSchema,
  GetSuggestionsInputSchema,
]);

// ============================================================
// Tool Definition
// ============================================================

export const mailSemanticSearchTool = {
  definition: {
    name: 'mail_semantic_search',
    description: `AI-powered natural language email search. Understands queries like:
- "Find emails about the contract from last week"
- "Show me unread messages from John"
- "Emails with attachments about the project"
- "Important emails from this month"

Modes:
- search: Perform semantic search with natural language query
- similar: Find emails similar to a given email
- parse: Parse a query to see how it's interpreted
- suggest: Get search suggestions for a partial query`,
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['search', 'similar', 'parse', 'suggest'],
          description: 'Search mode',
        },
        // Search mode
        query: {
          type: 'string',
          description: 'Natural language search query',
        },
        accountId: {
          type: 'integer',
          description: 'Filter by account ID',
        },
        limit: {
          type: 'integer',
          description: 'Maximum results to return (default 20, max 50)',
          default: 20,
        },
        minRelevance: {
          type: 'number',
          description: 'Minimum relevance score 0-1 (default 0.3)',
          default: 0.3,
        },
        // Similar mode
        emailId: {
          type: 'integer',
          description: 'Email ID to find similar emails for',
        },
        // Suggest mode
        partialQuery: {
          type: 'string',
          description: 'Partial query for suggestions',
        },
      },
      required: ['mode'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailSemanticSearchInputSchema.parse(args);

    try {
      switch (input.mode) {
        case 'search': {
          const results = await semanticSearch(input.query, {
            accountId: input.accountId,
            limit: input.limit,
            minRelevance: input.minRelevance,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'search',
                    query: {
                      original: results.parsedQuery.originalQuery,
                      intent: results.parsedQuery.intent,
                      keywords: results.parsedQuery.keywords,
                      topics: results.parsedQuery.topics,
                      dateRange: results.parsedQuery.dateRange,
                      confidence: results.parsedQuery.confidence,
                    },
                    results: results.results.map((r) => ({
                      id: r.email.id,
                      providerMessageId: r.email.providerMessageId,
                      from: r.email.from,
                      subject: r.email.subject,
                      date: r.email.date,
                      relevanceScore: r.relevanceScore,
                      matchReason: r.matchReason,
                      matchedFields: r.matchedFields,
                      snippet: r.snippet,
                      labels: r.email.labels,
                      hasAttachments: r.email.hasAttachments,
                    })),
                    totalMatches: results.totalMatches,
                    executionTimeMs: results.executionTimeMs,
                    suggestions: results.suggestions,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'similar': {
          const results = await findSimilar(input.emailId, {
            accountId: input.accountId,
            limit: input.limit,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'similar',
                    referenceEmailId: input.emailId,
                    results: results.results.map((r) => ({
                      id: r.email.id,
                      providerMessageId: r.email.providerMessageId,
                      from: r.email.from,
                      subject: r.email.subject,
                      date: r.email.date,
                      relevanceScore: r.relevanceScore,
                      matchReason: r.matchReason,
                      snippet: r.snippet,
                    })),
                    totalMatches: results.totalMatches,
                    executionTimeMs: results.executionTimeMs,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'parse': {
          const parsed = await parseQuery(input.query);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'parse',
                    originalQuery: parsed.originalQuery,
                    interpretation: {
                      intent: parsed.intent,
                      keywords: parsed.keywords,
                      topics: parsed.topics,
                      dateRange: parsed.dateRange,
                      fromFilter: parsed.fromFilter,
                      toFilter: parsed.toFilter,
                      subjectFilter: parsed.subjectFilter,
                      hasAttachments: parsed.hasAttachments,
                      labels: parsed.labels,
                    },
                    confidence: parsed.confidence,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'suggest': {
          const suggestions = await getSearchSuggestions(input.partialQuery);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'suggest',
                    partialQuery: input.partialQuery,
                    suggestions,
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
              error: error instanceof Error ? error.message : 'Semantic search failed',
            }),
          },
        ],
      };
    }
  },
};
