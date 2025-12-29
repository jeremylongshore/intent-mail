/**
 * Inbox Triage Module
 *
 * AI-powered email prioritization and action classification.
 * Auto-categorizes emails by priority and action needed for efficient inbox management.
 *
 * E3.S3.4: Inbox Triage
 */

import { z } from 'zod';
import { type Email as StorageEmail, EmailFlag } from '../types/email.js';
import { MultiProviderRouter } from './router.js';

// ============================================================
// Types and Schemas
// ============================================================

/**
 * Priority levels for emails
 * P1: Urgent - needs immediate attention
 * P2: High - important, needs attention today
 * P3: Normal - standard priority
 * P4: Low - can be deferred
 */
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

/**
 * Action needed classification
 */
export type ActionType =
  | 'reply-needed'      // Requires a response
  | 'follow-up'         // Needs follow-up later
  | 'review'            // Needs review/decision
  | 'delegate'          // Should be delegated
  | 'schedule'          // Needs calendar action
  | 'archive'           // Can be archived
  | 'unsubscribe'       // Newsletter/spam to unsubscribe
  | 'waiting'           // Waiting on response
  | 'info-only'         // FYI, no action needed
  | 'none';             // No specific action

/**
 * Urgency signals detected in email
 */
export type UrgencySignal =
  | 'deadline-mentioned'
  | 'urgent-language'
  | 'sender-vip'
  | 'thread-active'
  | 'request-action'
  | 'time-sensitive'
  | 'none';

/**
 * Triage result for a single email
 */
export interface TriageResult {
  /** Email ID */
  emailId: number;
  /** Provider message ID */
  providerMessageId: string;
  /** Assigned priority */
  priority: Priority;
  /** Primary action needed */
  actionType: ActionType;
  /** Secondary action if applicable */
  secondaryAction?: ActionType;
  /** Urgency signals detected */
  urgencySignals: UrgencySignal[];
  /** Detected deadline if any */
  deadline?: {
    date: string;
    confidence: number;
  };
  /** Brief reason for priority assignment */
  reason: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Suggested next step */
  suggestedNextStep?: string;
  /** Estimated time to handle (minutes) */
  estimatedTimeMinutes?: number;
}

/**
 * Batch triage results
 */
export interface BatchTriageResults {
  /** Individual email results */
  results: TriageResult[];
  /** Summary statistics */
  summary: {
    totalEmails: number;
    byPriority: Record<Priority, number>;
    byAction: Record<ActionType, number>;
    needsImmediateAttention: number;
    estimatedTotalTimeMinutes: number;
  };
  /** Suggested processing order (email IDs) */
  suggestedOrder: number[];
  /** Execution time in ms */
  executionTimeMs: number;
}

/**
 * Zod schema for parsing LLM triage response
 */
const TriageResponseSchema = z.object({
  priority: z.enum(['P1', 'P2', 'P3', 'P4']),
  actionType: z.enum([
    'reply-needed',
    'follow-up',
    'review',
    'delegate',
    'schedule',
    'archive',
    'unsubscribe',
    'waiting',
    'info-only',
    'none',
  ]),
  secondaryAction: z.enum([
    'reply-needed',
    'follow-up',
    'review',
    'delegate',
    'schedule',
    'archive',
    'unsubscribe',
    'waiting',
    'info-only',
    'none',
  ]).optional(),
  urgencySignals: z.array(z.enum([
    'deadline-mentioned',
    'urgent-language',
    'sender-vip',
    'thread-active',
    'request-action',
    'time-sensitive',
    'none',
  ])),
  deadline: z.object({
    date: z.string(),
    confidence: z.number().min(0).max(1),
  }).optional(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  suggestedNextStep: z.string().optional(),
  estimatedTimeMinutes: z.number().int().positive().optional(),
});

// ============================================================
// Prompts
// ============================================================

/**
 * Build triage prompt for a single email
 */
function buildTriagePrompt(email: StorageEmail): string {
  const fromStr =
    typeof email.from === 'string'
      ? email.from
      : email.from.name
        ? `${email.from.name} <${email.from.address}>`
        : email.from.address;

  const body = email.bodyText || email.snippet || '';
  const truncatedBody = body.length > 3000 ? body.substring(0, 3000) + '...' : body;
  const labels = email.labels?.join(', ') || 'none';
  const isUnread = email.flags?.includes(EmailFlag.SEEN) ? 'No' : 'Yes';

  return `Analyze this email and determine its priority and required action.

Email:
From: ${fromStr}
Subject: ${email.subject}
Date: ${email.date}
Labels: ${labels}
Unread: ${isUnread}
Has Attachments: ${email.hasAttachments ? 'Yes' : 'No'}

Body:
${truncatedBody}

Respond with a JSON object containing:
1. "priority": Priority level
   - "P1": Urgent - needs immediate attention (e.g., crisis, deadline today, VIP request)
   - "P2": High - important, should handle today (e.g., client request, time-sensitive)
   - "P3": Normal - standard priority (e.g., regular business communication)
   - "P4": Low - can be deferred (e.g., newsletters, FYI, promotions)

2. "actionType": Primary action needed
   - "reply-needed": Requires a response
   - "follow-up": Needs follow-up later
   - "review": Needs review/decision
   - "delegate": Should be delegated to someone else
   - "schedule": Needs calendar action (meeting, reminder)
   - "archive": Can be archived immediately
   - "unsubscribe": Newsletter/spam to unsubscribe from
   - "waiting": Already responded, waiting on reply
   - "info-only": FYI, no action needed
   - "none": No specific action

3. "secondaryAction": Optional secondary action if applicable

4. "urgencySignals": Array of detected signals
   - "deadline-mentioned": Specific deadline in email
   - "urgent-language": Words like urgent, ASAP, critical
   - "sender-vip": Appears to be from important sender
   - "thread-active": Part of active conversation
   - "request-action": Explicit action request
   - "time-sensitive": Time-sensitive content
   - "none": No urgency signals

5. "deadline": If a deadline is mentioned, include:
   { "date": "YYYY-MM-DD", "confidence": 0.0-1.0 }

6. "reason": Brief explanation for priority (max 50 words)

7. "confidence": Your confidence in this assessment (0.0-1.0)

8. "suggestedNextStep": Specific action to take (optional)

9. "estimatedTimeMinutes": Estimated time to handle this email (optional)

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
 * Parse and validate LLM triage response
 */
function parseTriageResponse(text: string, email: StorageEmail): TriageResult {
  // Try to extract JSON from response
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
    const validated = TriageResponseSchema.parse(parsed);

    return {
      emailId: email.id as number,
      providerMessageId: email.providerMessageId,
      priority: validated.priority,
      actionType: validated.actionType,
      secondaryAction: validated.secondaryAction,
      urgencySignals: validated.urgencySignals,
      deadline: validated.deadline,
      reason: validated.reason,
      confidence: validated.confidence,
      suggestedNextStep: validated.suggestedNextStep,
      estimatedTimeMinutes: validated.estimatedTimeMinutes,
    };
  } catch (error) {
    // Return a fallback result if parsing fails
    console.error('[inbox-triage] Failed to parse LLM response:', error instanceof Error ? error.message : String(error));
    return {
      emailId: email.id as number,
      providerMessageId: email.providerMessageId,
      priority: 'P3',
      actionType: 'review',
      urgencySignals: ['none'],
      reason: 'Unable to automatically triage',
      confidence: 0.3,
    };
  }
}

/**
 * Triage a single email
 *
 * @param email - The email to triage
 * @returns Triage result with priority and action
 */
export async function triageEmail(email: StorageEmail): Promise<TriageResult> {
  const router = await getRouter();
  const prompt = buildTriagePrompt(email);

  // Use the router with structured prompt
  const dummyEmail = {
    id: 'prompt',
    from: 'system',
    to: 'assistant',
    subject: 'Email Triage Request',
    body: prompt,
    date: new Date().toISOString(),
  };

  const response = await router.summarize([dummyEmail]);
  return parseTriageResponse(response, email);
}

/**
 * Batch triage multiple emails
 *
 * @param emails - Array of emails to triage
 * @returns Batch triage results with summary and suggested order
 */
export async function batchTriage(emails: StorageEmail[]): Promise<BatchTriageResults> {
  const startTime = Date.now();

  if (emails.length === 0) {
    return {
      results: [],
      summary: {
        totalEmails: 0,
        byPriority: { P1: 0, P2: 0, P3: 0, P4: 0 },
        byAction: {
          'reply-needed': 0,
          'follow-up': 0,
          'review': 0,
          'delegate': 0,
          'schedule': 0,
          'archive': 0,
          'unsubscribe': 0,
          'waiting': 0,
          'info-only': 0,
          'none': 0,
        },
        needsImmediateAttention: 0,
        estimatedTotalTimeMinutes: 0,
      },
      suggestedOrder: [],
      executionTimeMs: Date.now() - startTime,
    };
  }

  // For small batches, triage individually for better accuracy
  if (emails.length <= 5) {
    const results: TriageResult[] = [];

    for (const email of emails) {
      try {
        const result = await triageEmail(email);
        results.push(result);
      } catch (error) {
        console.error(`[inbox-triage] Failed to triage email ${email.id}:`, error instanceof Error ? error.message : String(error));
        results.push({
          emailId: email.id as number,
          providerMessageId: email.providerMessageId,
          priority: 'P3',
          actionType: 'review',
          urgencySignals: ['none'],
          reason: 'Triage failed',
          confidence: 0.2,
        });
      }
    }

    return buildBatchResults(results, Date.now() - startTime);
  }

  // For larger batches, use batch processing with concurrency
  const CONCURRENCY = 3;
  const results: TriageResult[] = [];
  const chunks: StorageEmail[][] = [];

  for (let i = 0; i < emails.length; i += CONCURRENCY) {
    chunks.push(emails.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(async (email) => {
        try {
          return await triageEmail(email);
        } catch (error) {
          console.error(`[inbox-triage] Failed to triage email ${email.id}:`, error instanceof Error ? error.message : String(error));
          return {
            emailId: email.id as number,
            providerMessageId: email.providerMessageId,
            priority: 'P3' as Priority,
            actionType: 'review' as ActionType,
            urgencySignals: ['none'] as UrgencySignal[],
            reason: 'Triage failed',
            confidence: 0.2,
          };
        }
      })
    );

    results.push(...chunkResults);
  }

  return buildBatchResults(results, Date.now() - startTime);
}

/**
 * Build batch results with summary and suggested order
 */
function buildBatchResults(results: TriageResult[], executionTimeMs: number): BatchTriageResults {
  // Calculate summary statistics
  const byPriority: Record<Priority, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
  const byAction: Record<ActionType, number> = {
    'reply-needed': 0,
    'follow-up': 0,
    'review': 0,
    'delegate': 0,
    'schedule': 0,
    'archive': 0,
    'unsubscribe': 0,
    'waiting': 0,
    'info-only': 0,
    'none': 0,
  };
  let estimatedTotalTime = 0;

  for (const result of results) {
    byPriority[result.priority]++;
    byAction[result.actionType]++;
    if (result.estimatedTimeMinutes) {
      estimatedTotalTime += result.estimatedTimeMinutes;
    }
  }

  // Sort results by priority and action importance
  const priorityOrder: Record<Priority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
  const actionOrder: Record<ActionType, number> = {
    'reply-needed': 0,
    'schedule': 1,
    'review': 2,
    'follow-up': 3,
    'delegate': 4,
    'waiting': 5,
    'info-only': 6,
    'archive': 7,
    'unsubscribe': 8,
    'none': 9,
  };

  const sortedResults = [...results].sort((a, b) => {
    // First by priority
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by action type
    return actionOrder[a.actionType] - actionOrder[b.actionType];
  });

  const suggestedOrder = sortedResults.map((r) => r.emailId);

  return {
    results,
    summary: {
      totalEmails: results.length,
      byPriority,
      byAction,
      needsImmediateAttention: byPriority.P1 + byPriority.P2,
      estimatedTotalTimeMinutes: estimatedTotalTime,
    },
    suggestedOrder,
    executionTimeMs,
  };
}

/**
 * Quick triage - returns just priority and action
 *
 * @param email - The email to triage
 * @returns Priority and action type
 */
export async function quickTriage(email: StorageEmail): Promise<{
  priority: Priority;
  actionType: ActionType;
}> {
  const result = await triageEmail(email);
  return {
    priority: result.priority,
    actionType: result.actionType,
  };
}

/**
 * Get inbox summary with triage statistics
 *
 * @param emails - Array of emails to analyze
 * @returns Summary of inbox state
 */
export async function getInboxSummary(emails: StorageEmail[]): Promise<{
  totalUnread: number;
  needsAction: number;
  highPriority: number;
  canArchive: number;
  suggestions: string[];
}> {
  const triageResults = await batchTriage(emails);

  const needsAction = triageResults.results.filter(
    (r) => r.actionType === 'reply-needed' || r.actionType === 'review' || r.actionType === 'follow-up'
  ).length;

  const canArchive = triageResults.results.filter(
    (r) => r.actionType === 'archive' || r.actionType === 'info-only'
  ).length;

  const suggestions: string[] = [];

  if (triageResults.summary.byPriority.P1 > 0) {
    suggestions.push(`${triageResults.summary.byPriority.P1} urgent email(s) need immediate attention`);
  }

  if (triageResults.summary.byAction['reply-needed'] > 3) {
    suggestions.push(`Consider setting aside time for ${triageResults.summary.byAction['reply-needed']} pending replies`);
  }

  if (canArchive > 5) {
    suggestions.push(`${canArchive} emails can be archived to reduce inbox clutter`);
  }

  if (triageResults.summary.byAction['unsubscribe'] > 0) {
    suggestions.push(`Consider unsubscribing from ${triageResults.summary.byAction['unsubscribe']} newsletter(s)`);
  }

  return {
    totalUnread: emails.filter((e) => !e.flags?.includes(EmailFlag.SEEN)).length,
    needsAction,
    highPriority: triageResults.summary.byPriority.P1 + triageResults.summary.byPriority.P2,
    canArchive,
    suggestions,
  };
}
