/**
 * Semantic Search Module
 *
 * AI-powered natural language email search using LLM for query understanding
 * and semantic similarity ranking. Goes beyond keyword matching.
 *
 * E3.S3.3: Semantic Search
 */

import { z } from 'zod';
import type { Email as StorageEmail } from '../types/email.js';
import { EmailFlag } from '../types/email.js';
import { MultiProviderRouter } from './router.js';
import { searchEmails } from '../storage/services/email-storage.js';

// ============================================================
// Types and Schemas
// ============================================================

/**
 * Parsed query with extracted intent and filters
 */
export interface ParsedQuery {
  /** Original natural language query */
  originalQuery: string;
  /** Extracted search intent */
  intent: QueryIntent;
  /** Keywords extracted from query */
  keywords: string[];
  /** Inferred date range */
  dateRange?: {
    from?: string;
    to?: string;
    relative?: string; // e.g., "last week", "yesterday"
  };
  /** Inferred sender filter */
  fromFilter?: string;
  /** Inferred recipient filter */
  toFilter?: string;
  /** Inferred subject filter */
  subjectFilter?: string;
  /** Whether attachments are expected */
  hasAttachments?: boolean;
  /** Inferred labels/folders */
  labels?: string[];
  /** Semantic topics extracted */
  topics?: string[];
  /** Confidence in parsing (0-1) */
  confidence: number;
}

/**
 * Query intent types
 */
export type QueryIntent =
  | 'find_specific'     // Find a specific email
  | 'find_related'      // Find emails related to a topic
  | 'find_from_person'  // Find emails from someone
  | 'find_about_topic'  // Find emails about a topic
  | 'find_recent'       // Find recent emails
  | 'find_unread'       // Find unread emails
  | 'find_important'    // Find important/flagged emails
  | 'find_with_attachment' // Find emails with attachments
  | 'general_search';   // General keyword search

/**
 * Semantic search result with relevance scoring
 */
export interface SemanticSearchResult {
  /** The matched email */
  email: StorageEmail;
  /** Semantic relevance score (0-1) */
  relevanceScore: number;
  /** Why this email matched (human-readable) */
  matchReason: string;
  /** Specific fields that matched */
  matchedFields: ('subject' | 'body' | 'from' | 'to' | 'date' | 'labels')[];
  /** Highlighted snippet */
  snippet: string;
}

/**
 * Search results with metadata
 */
export interface SemanticSearchResults {
  /** Parsed query interpretation */
  parsedQuery: ParsedQuery;
  /** Search results ranked by relevance */
  results: SemanticSearchResult[];
  /** Total matches found */
  totalMatches: number;
  /** Search execution time in ms */
  executionTimeMs: number;
  /** Suggested refinements */
  suggestions?: string[];
}

/**
 * Zod schema for parsing LLM query understanding response
 */
const ParsedQuerySchema = z.object({
  intent: z.enum([
    'find_specific',
    'find_related',
    'find_from_person',
    'find_about_topic',
    'find_recent',
    'find_unread',
    'find_important',
    'find_with_attachment',
    'general_search',
  ]),
  keywords: z.array(z.string()),
  dateRange: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    relative: z.string().optional(),
  }).optional(),
  fromFilter: z.string().optional(),
  toFilter: z.string().optional(),
  subjectFilter: z.string().optional(),
  hasAttachments: z.boolean().optional(),
  labels: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
});

/**
 * Zod schema for LLM ranking response
 */
const RankingResultSchema = z.object({
  emailId: z.string(),
  relevanceScore: z.number().min(0).max(1),
  matchReason: z.string(),
  matchedFields: z.array(z.enum(['subject', 'body', 'from', 'to', 'date', 'labels'])),
});

// ============================================================
// Query Parsing
// ============================================================

/**
 * Build prompt for query understanding
 */
function buildQueryParsingPrompt(query: string): string {
  const today = new Date().toISOString().split('T')[0];

  return `Parse this natural language email search query and extract structured search parameters.

Today's date: ${today}

Query: "${query}"

Extract the following:
1. intent: The type of search the user wants
2. keywords: Important search terms
3. dateRange: Any date filters (convert relative dates like "last week" to ISO dates)
4. fromFilter: Sender email or name if mentioned
5. toFilter: Recipient if mentioned
6. subjectFilter: Subject line pattern if mentioned
7. hasAttachments: true if attachments are mentioned
8. labels: Any folders/labels mentioned (inbox, sent, drafts, etc.)
9. topics: Semantic topics/themes extracted
10. confidence: How confident you are in this parsing (0-1)

Respond with JSON only:
{
  "intent": "find_specific|find_related|find_from_person|find_about_topic|find_recent|find_unread|find_important|find_with_attachment|general_search",
  "keywords": ["word1", "word2"],
  "dateRange": {"from": "2025-01-01", "to": "2025-01-07", "relative": "last week"},
  "fromFilter": "john@example.com",
  "subjectFilter": "meeting",
  "hasAttachments": false,
  "labels": ["inbox"],
  "topics": ["project planning", "deadlines"],
  "confidence": 0.85
}`;
}

/**
 * Parse relative date expressions to absolute dates
 */
function parseRelativeDate(relative: string): { from?: string; to?: string } {
  const today = new Date();
  const result: { from?: string; to?: string } = {};

  const lowerRelative = relative.toLowerCase();

  if (lowerRelative.includes('today')) {
    result.from = today.toISOString().split('T')[0];
    result.to = today.toISOString().split('T')[0];
  } else if (lowerRelative.includes('yesterday')) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    result.from = yesterday.toISOString().split('T')[0];
    result.to = yesterday.toISOString().split('T')[0];
  } else if (lowerRelative.includes('last week') || lowerRelative.includes('past week')) {
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    result.from = weekAgo.toISOString().split('T')[0];
    result.to = today.toISOString().split('T')[0];
  } else if (lowerRelative.includes('last month') || lowerRelative.includes('past month')) {
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    result.from = monthAgo.toISOString().split('T')[0];
    result.to = today.toISOString().split('T')[0];
  } else if (lowerRelative.includes('this week')) {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    result.from = startOfWeek.toISOString().split('T')[0];
    result.to = today.toISOString().split('T')[0];
  } else if (lowerRelative.includes('this month')) {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    result.from = startOfMonth.toISOString().split('T')[0];
    result.to = today.toISOString().split('T')[0];
  }

  return result;
}

// ============================================================
// Semantic Ranking
// ============================================================

/**
 * Build prompt for semantic ranking of search results
 */
function buildRankingPrompt(
  query: string,
  parsedQuery: ParsedQuery,
  emails: StorageEmail[]
): string {
  // Format emails for ranking
  const emailSummaries = emails.map((email, index) => {
    const fromStr = typeof email.from === 'string'
      ? email.from
      : email.from.name
        ? `${email.from.name} <${email.from.address}>`
        : email.from.address;

    const body = email.bodyText || email.snippet || '';
    const truncatedBody = body.length > 500 ? body.substring(0, 500) + '...' : body;

    return `[${index}] ID: ${email.providerMessageId}
From: ${fromStr}
Subject: ${email.subject}
Date: ${email.date}
Labels: ${email.labels.join(', ')}
Preview: ${truncatedBody}`;
  }).join('\n\n');

  return `Rank these emails by relevance to the search query.

Original Query: "${query}"
Search Intent: ${parsedQuery.intent}
Topics: ${parsedQuery.topics?.join(', ') || 'general'}
Keywords: ${parsedQuery.keywords.join(', ')}

EMAILS:
${emailSummaries}

For each email, provide a relevance score (0-1) and brief reason.
Higher scores for emails that:
- Directly match the query intent
- Contain the key topics/keywords
- Match any date/sender/subject filters
- Are more recent (for recency-biased queries)

Respond with a JSON array (one object per email, in order of relevance):
[
  {
    "emailId": "provider-message-id",
    "relevanceScore": 0.95,
    "matchReason": "Direct match for contract discussion from last week",
    "matchedFields": ["subject", "body", "date"]
  }
]`;
}

// ============================================================
// Main Functions
// ============================================================

/** Singleton router instance */
let routerInstance: MultiProviderRouter | null = null;

/**
 * Get or create the router instance
 */
async function getRouter(): Promise<MultiProviderRouter> {
  if (!routerInstance) {
    routerInstance = await MultiProviderRouter.create();
  }
  return routerInstance;
}

/**
 * Parse JSON response from LLM, handling potential issues
 */
function parseJsonResponse<T>(response: string, schema: z.ZodSchema<T>): T | null {
  let jsonStr = response.trim();

  // Handle markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Handle responses that start with explanation
  const jsonStart = jsonStr.indexOf('{');
  const arrayStart = jsonStr.indexOf('[');
  const start = jsonStart !== -1 && (arrayStart === -1 || jsonStart < arrayStart)
    ? jsonStart
    : arrayStart;

  if (start !== -1) {
    const isArray = jsonStr[start] === '[';
    const end = isArray ? jsonStr.lastIndexOf(']') : jsonStr.lastIndexOf('}');
    if (end > start) {
      jsonStr = jsonStr.substring(start, end + 1);
    }
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return schema.parse(parsed);
  } catch {
    return null;
  }
}

/**
 * Parse a natural language query into structured search parameters
 */
export async function parseQuery(query: string): Promise<ParsedQuery> {
  const router = await getRouter();
  const prompt = buildQueryParsingPrompt(query);

  try {
    const response = await router.generateDraft({ context: prompt });
    const parsed = parseJsonResponse(response, ParsedQuerySchema);

    if (parsed) {
      // Handle relative date conversion
      if (parsed.dateRange?.relative && !parsed.dateRange.from) {
        const absoluteDates = parseRelativeDate(parsed.dateRange.relative);
        parsed.dateRange.from = absoluteDates.from;
        parsed.dateRange.to = absoluteDates.to;
      }

      return {
        originalQuery: query,
        ...parsed,
      };
    }
  } catch (error) {
    console.error('[semantic-search] Query parsing failed:', error);
  }

  // Fallback: basic keyword extraction
  const keywords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 2 && !['the', 'and', 'for', 'from', 'with', 'about'].includes(word));

  return {
    originalQuery: query,
    intent: 'general_search',
    keywords,
    confidence: 0.3,
  };
}

/**
 * Perform semantic search across emails
 *
 * @example
 * ```typescript
 * const results = await semanticSearch('Find emails about the contract from last week');
 * console.log(results.results[0].matchReason);
 * ```
 */
export async function semanticSearch(
  query: string,
  options: {
    accountId?: number;
    limit?: number;
    minRelevance?: number;
  } = {}
): Promise<SemanticSearchResults> {
  const startTime = Date.now();
  const { accountId, limit = 20, minRelevance = 0.3 } = options;

  // Step 1: Parse the natural language query
  const parsedQuery = await parseQuery(query);

  // Step 2: Build database search filters from parsed query
  const dbFilters: Parameters<typeof searchEmails>[0] = {
    accountId,
    limit: Math.min(limit * 3, 100), // Fetch more for ranking
    offset: 0,
  };

  // Apply extracted filters
  if (parsedQuery.keywords.length > 0) {
    dbFilters.query = parsedQuery.keywords.join(' ');
  }
  if (parsedQuery.fromFilter) {
    dbFilters.from = parsedQuery.fromFilter;
  }
  if (parsedQuery.subjectFilter) {
    dbFilters.subject = parsedQuery.subjectFilter;
  }
  if (parsedQuery.hasAttachments) {
    dbFilters.hasAttachments = true;
  }
  if (parsedQuery.dateRange?.from) {
    dbFilters.dateFrom = parsedQuery.dateRange.from;
  }
  if (parsedQuery.dateRange?.to) {
    dbFilters.dateTo = parsedQuery.dateRange.to;
  }
  if (parsedQuery.labels && parsedQuery.labels.length > 0) {
    dbFilters.labels = parsedQuery.labels;
  }

  // Handle intent-specific filters
  if (parsedQuery.intent === 'find_unread') {
    dbFilters.flags = [];
  }
  if (parsedQuery.intent === 'find_important') {
    dbFilters.flags = [EmailFlag.FLAGGED];
  }

  // Step 3: Fetch candidate emails from database
  const dbResults = await searchEmails(dbFilters);

  if (dbResults.items.length === 0) {
    return {
      parsedQuery,
      results: [],
      totalMatches: 0,
      executionTimeMs: Date.now() - startTime,
      suggestions: ['Try broadening your search with fewer filters', 'Check if emails exist in the specified date range'],
    };
  }

  // Step 4: Use AI to rank results by semantic relevance
  const router = await getRouter();
  const rankingPrompt = buildRankingPrompt(query, parsedQuery, dbResults.items);

  let rankedResults: SemanticSearchResult[] = [];

  try {
    const rankingResponse = await router.generateDraft({ context: rankingPrompt });
    const rankings = parseJsonResponse(rankingResponse, z.array(RankingResultSchema));

    if (rankings) {
      // Map rankings back to emails
      const emailMap = new Map(dbResults.items.map((e) => [e.providerMessageId, e]));

      rankedResults = rankings
        .filter((r) => r.relevanceScore >= minRelevance)
        .map((r) => {
          const email = emailMap.get(r.emailId);
          if (!email) return null;

          return {
            email,
            relevanceScore: r.relevanceScore,
            matchReason: r.matchReason,
            matchedFields: r.matchedFields,
            snippet: email.snippet || email.bodyText?.substring(0, 200) || '',
          };
        })
        .filter((r): r is SemanticSearchResult => r !== null)
        .slice(0, limit);
    }
  } catch (error) {
    console.error('[semantic-search] Ranking failed, using fallback:', error);
  }

  // Fallback: if AI ranking failed, use basic scoring
  if (rankedResults.length === 0) {
    rankedResults = dbResults.items.slice(0, limit).map((email) => {
      const queryLower = query.toLowerCase();
      const subjectMatch = email.subject.toLowerCase().includes(queryLower) ? 0.3 : 0;
      const bodyMatch = (email.bodyText || '').toLowerCase().includes(queryLower) ? 0.2 : 0;
      const keywordMatches = parsedQuery.keywords.filter((kw) =>
        email.subject.toLowerCase().includes(kw) ||
        (email.bodyText || '').toLowerCase().includes(kw)
      ).length;
      const keywordScore = Math.min(keywordMatches * 0.1, 0.4);

      return {
        email,
        relevanceScore: Math.min(subjectMatch + bodyMatch + keywordScore + 0.2, 1),
        matchReason: 'Keyword match',
        matchedFields: ['subject', 'body'] as ('subject' | 'body')[],
        snippet: email.snippet || email.bodyText?.substring(0, 200) || '',
      };
    });

    // Sort by score
    rankedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Generate suggestions if few results
  const suggestions: string[] = [];
  if (rankedResults.length < 3) {
    suggestions.push('Try using different keywords');
    if (parsedQuery.dateRange) {
      suggestions.push('Consider expanding the date range');
    }
    if (parsedQuery.fromFilter) {
      suggestions.push('Try searching without the sender filter');
    }
  }

  return {
    parsedQuery,
    results: rankedResults,
    totalMatches: rankedResults.length,
    executionTimeMs: Date.now() - startTime,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
  };
}

/**
 * Find emails similar to a given email
 */
export async function findSimilar(
  emailId: number,
  options: {
    limit?: number;
    accountId?: number;
  } = {}
): Promise<SemanticSearchResults> {
  const { limit = 10, accountId } = options;
  const startTime = Date.now();

  // Get the reference email
  const { getEmailById } = await import('../storage/services/email-storage.js');
  const referenceEmail = getEmailById(emailId);

  if (!referenceEmail) {
    return {
      parsedQuery: {
        originalQuery: `Similar to email #${emailId}`,
        intent: 'find_related',
        keywords: [],
        confidence: 0,
      },
      results: [],
      totalMatches: 0,
      executionTimeMs: Date.now() - startTime,
      suggestions: ['Email not found'],
    };
  }

  // Build a search query from the email content
  const searchQuery = `emails similar to: ${referenceEmail.subject}`;

  // Use semantic search with the email's topics
  const results = await semanticSearch(searchQuery, { accountId, limit: limit + 1 });

  // Filter out the reference email itself
  results.results = results.results.filter((r) => r.email.id !== emailId).slice(0, limit);
  results.totalMatches = results.results.length;
  results.parsedQuery.originalQuery = `Similar to: "${referenceEmail.subject}"`;

  return results;
}

/**
 * Smart search suggestions based on query patterns
 */
export async function getSearchSuggestions(
  partialQuery: string
): Promise<string[]> {
  const suggestions: string[] = [];

  const lowerQuery = partialQuery.toLowerCase();

  // Time-based suggestions
  if (lowerQuery.includes('last') || lowerQuery.includes('recent')) {
    suggestions.push('emails from last week');
    suggestions.push('emails from last month');
    suggestions.push('recent unread emails');
  }

  // Person-based suggestions
  if (lowerQuery.includes('from')) {
    suggestions.push('emails from [person name]');
    suggestions.push('emails from my boss');
    suggestions.push('emails from the team');
  }

  // Topic-based suggestions
  if (lowerQuery.includes('about')) {
    suggestions.push('emails about the project');
    suggestions.push('emails about meeting');
    suggestions.push('emails about deadline');
  }

  // Attachment suggestions
  if (lowerQuery.includes('attach') || lowerQuery.includes('file')) {
    suggestions.push('emails with attachments');
    suggestions.push('emails with PDF attachments');
    suggestions.push('emails with documents');
  }

  // Status suggestions
  if (lowerQuery.includes('unread') || lowerQuery.includes('new')) {
    suggestions.push('unread emails');
    suggestions.push('new emails today');
  }

  if (lowerQuery.includes('important') || lowerQuery.includes('star')) {
    suggestions.push('important emails');
    suggestions.push('starred emails');
    suggestions.push('flagged emails');
  }

  // Default suggestions if no matches
  if (suggestions.length === 0) {
    suggestions.push('unread emails from this week');
    suggestions.push('emails with attachments');
    suggestions.push('important emails');
    suggestions.push('emails about [topic]');
  }

  return suggestions.slice(0, 5);
}

// ============================================================
// Exports
// ============================================================

export { parseRelativeDate };
