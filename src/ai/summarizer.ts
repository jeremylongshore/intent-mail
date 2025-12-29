/**
 * Email Summarization Module
 *
 * AI-powered email summarization using the multi-provider router.
 * Provides structured summaries with action items, sentiment, and categorization.
 */

import { z } from 'zod';
import type { Email as StorageEmail } from '../types/email.js';
import { MultiProviderRouter } from './router.js';

// ============================================================
// Types and Schemas
// ============================================================

/**
 * Sentiment classification for emails
 */
export type EmailSentiment = 'positive' | 'neutral' | 'negative' | 'urgent';

/**
 * Email category classification
 */
export type EmailCategory =
  | 'meeting'
  | 'newsletter'
  | 'action-required'
  | 'fyi'
  | 'personal'
  | 'commercial'
  | 'notification'
  | 'support'
  | 'other';

/**
 * Structured email summary
 */
export interface EmailSummary {
  /** One sentence summary */
  oneLiner: string;
  /** 3-5 key points as bullet points */
  keyPoints: string[];
  /** Extracted action items/todos */
  actionItems: string[];
  /** Sentiment classification */
  sentiment: EmailSentiment;
  /** Email category */
  category: EmailCategory;
}

/**
 * Zod schema for parsing LLM response
 */
export const EmailSummarySchema = z.object({
  oneLiner: z.string(),
  keyPoints: z.array(z.string()).min(1).max(7),
  actionItems: z.array(z.string()),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'urgent']),
  category: z.enum([
    'meeting',
    'newsletter',
    'action-required',
    'fyi',
    'personal',
    'commercial',
    'notification',
    'support',
    'other',
  ]),
});

// ============================================================
// Prompts
// ============================================================

/**
 * Build structured summarization prompt for a single email
 */
function buildSummarizeEmailPrompt(email: StorageEmail): string {
  const fromStr =
    typeof email.from === 'string'
      ? email.from
      : email.from.name
        ? `${email.from.name} <${email.from.address}>`
        : email.from.address;

  const body = email.bodyText || email.snippet || '';
  const truncatedBody = body.length > 3000 ? body.substring(0, 3000) + '...' : body;

  return `Analyze this email and provide a structured summary.

Email:
From: ${fromStr}
Subject: ${email.subject}
Date: ${email.date}
Body:
${truncatedBody}

Respond with a JSON object containing:
1. "oneLiner": One sentence summary (max 100 chars)
2. "keyPoints": Array of 3-5 key bullet points
3. "actionItems": Array of action items/todos extracted from the email (empty array if none)
4. "sentiment": One of "positive", "neutral", "negative", or "urgent"
5. "category": One of "meeting", "newsletter", "action-required", "fyi", "personal", "commercial", "notification", "support", or "other"

Return ONLY the JSON object, no markdown or additional text:`;
}

/**
 * Build structured summarization prompt for a thread
 */
function buildSummarizeThreadPrompt(emails: StorageEmail[]): string {
  const threadMessages = emails
    .map((email, i) => {
      const fromStr =
        typeof email.from === 'string'
          ? email.from
          : email.from.name
            ? `${email.from.name} <${email.from.address}>`
            : email.from.address;

      const body = email.bodyText || email.snippet || '';
      const truncatedBody = body.length > 1000 ? body.substring(0, 1000) + '...' : body;

      return `Message ${i + 1}:
From: ${fromStr}
Date: ${email.date}
${truncatedBody}`;
    })
    .join('\n\n---\n\n');

  const subject = emails[0]?.subject || 'No subject';

  return `Analyze this email thread and provide a structured summary.

Thread Subject: ${subject}
Number of messages: ${emails.length}

${threadMessages}

Respond with a JSON object containing:
1. "oneLiner": One sentence summary of the entire thread (max 100 chars)
2. "keyPoints": Array of 3-5 key points covering the thread discussion
3. "actionItems": Array of action items/todos extracted from the thread (empty array if none)
4. "sentiment": Overall sentiment - one of "positive", "neutral", "negative", or "urgent"
5. "category": One of "meeting", "newsletter", "action-required", "fyi", "personal", "commercial", "notification", "support", or "other"

Return ONLY the JSON object, no markdown or additional text:`;
}

// ============================================================
// Core Functions
// ============================================================

/** Singleton router instance */
let routerInstance: MultiProviderRouter | null = null;

/**
 * Get or create the AI router
 */
async function getRouter(): Promise<MultiProviderRouter> {
  if (!routerInstance) {
    routerInstance = await MultiProviderRouter.create();
  }
  return routerInstance;
}

/**
 * Parse and validate LLM response into EmailSummary
 */
function parseSummaryResponse(text: string): EmailSummary {
  // Try to extract JSON from response (handle markdown code blocks)
  let jsonStr = text.trim();

  // Remove markdown code blocks if present
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Try to find JSON object
  const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return EmailSummarySchema.parse(parsed);
  } catch (error) {
    // Return a fallback summary if parsing fails
    console.error('[summarizer] Failed to parse LLM response:', error);
    return {
      oneLiner: 'Unable to generate summary',
      keyPoints: ['Email content could not be analyzed'],
      actionItems: [],
      sentiment: 'neutral',
      category: 'other',
    };
  }
}

/**
 * Summarize a single email
 *
 * @param email - The email to summarize
 * @returns Structured email summary
 */
export async function summarizeEmail(email: StorageEmail): Promise<EmailSummary> {
  const router = await getRouter();
  const prompt = buildSummarizeEmailPrompt(email);

  // Use the structured prompt directly via the router
  // The router's summarize expects Email[] but we need structured output
  // So we'll use a workaround: call summarize with our prompt embedded in body
  const dummyEmail = {
    id: 'prompt',
    from: 'system',
    to: 'assistant',
    subject: 'Structured Summarization Request',
    body: prompt,
    date: new Date().toISOString(),
  };

  const response = await router.summarize([dummyEmail]);
  return parseSummaryResponse(response);
}

/**
 * Summarize an email thread
 *
 * @param emails - Array of emails in the thread (chronological order)
 * @returns Structured summary of the entire thread
 */
export async function summarizeThread(emails: StorageEmail[]): Promise<EmailSummary> {
  if (emails.length === 0) {
    return {
      oneLiner: 'Empty thread',
      keyPoints: [],
      actionItems: [],
      sentiment: 'neutral',
      category: 'other',
    };
  }

  if (emails.length === 1) {
    return summarizeEmail(emails[0]);
  }

  const router = await getRouter();
  const prompt = buildSummarizeThreadPrompt(emails);

  const dummyEmail = {
    id: 'prompt',
    from: 'system',
    to: 'assistant',
    subject: 'Thread Summarization Request',
    body: prompt,
    date: new Date().toISOString(),
  };

  const response = await router.summarize([dummyEmail]);
  return parseSummaryResponse(response);
}

/**
 * Batch summarize multiple emails
 *
 * @param emails - Array of emails to summarize
 * @returns Map of email ID to summary
 */
export async function batchSummarize(
  emails: StorageEmail[]
): Promise<Map<string, EmailSummary>> {
  const results = new Map<string, EmailSummary>();

  // Process emails in parallel with concurrency limit
  const CONCURRENCY = 3;
  const chunks: StorageEmail[][] = [];

  for (let i = 0; i < emails.length; i += CONCURRENCY) {
    chunks.push(emails.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const summaries = await Promise.all(
      chunk.map(async (email) => {
        try {
          const summary = await summarizeEmail(email);
          return { id: String(email.id), summary };
        } catch (error) {
          console.error(`[summarizer] Failed to summarize email ${email.id}:`, error);
          return {
            id: String(email.id),
            summary: {
              oneLiner: 'Summarization failed',
              keyPoints: ['Error processing email'],
              actionItems: [],
              sentiment: 'neutral' as EmailSentiment,
              category: 'other' as EmailCategory,
            },
          };
        }
      })
    );

    for (const { id, summary } of summaries) {
      results.set(id, summary);
    }
  }

  return results;
}

/**
 * Quick summary - just the one-liner
 *
 * @param email - The email to summarize
 * @returns One sentence summary
 */
export async function quickSummary(email: StorageEmail): Promise<string> {
  const summary = await summarizeEmail(email);
  return summary.oneLiner;
}

// ============================================================
// Exports
// ============================================================

export type { StorageEmail as Email };
