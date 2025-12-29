/**
 * Smart Draft Generation Module
 *
 * AI-powered email draft generation with tone control and context awareness.
 * Uses the multi-provider router for automatic failover.
 *
 * E3.S3.2: Smart Draft Generation
 */

import { z } from 'zod';
import type { Email as StorageEmail } from '../types/email.js';
import { MultiProviderRouter } from './router.js';

// ============================================================
// Types and Schemas
// ============================================================

/**
 * Tone options for draft generation
 */
export type DraftTone =
  | 'formal'      // Business formal, proper salutations
  | 'professional' // Business casual, warm but professional
  | 'casual'      // Friendly and relaxed
  | 'friendly'    // Warm and personable
  | 'brief'       // Concise and to-the-point
  | 'apologetic'  // Expressing regret or apology
  | 'grateful'    // Expressing thanks
  | 'assertive';  // Firm and direct

/**
 * Intent for the draft
 */
export type DraftIntent =
  | 'reply'       // Reply to an email
  | 'forward'     // Forward with context
  | 'followup'    // Follow up on previous communication
  | 'introduction' // Introduce yourself/topic
  | 'request'     // Request something
  | 'confirm'     // Confirm something
  | 'decline'     // Politely decline
  | 'inform'      // Share information
  | 'thank'       // Thank someone
  | 'apologize';  // Apologize for something

/**
 * Draft generation options
 */
export interface DraftOptions {
  /** Target recipient email */
  to?: string;
  /** Email subject (optional, will be generated if not provided) */
  subject?: string;
  /** The intent of the email */
  intent: DraftIntent;
  /** Desired tone */
  tone: DraftTone;
  /** Key points to include in the draft */
  keyPoints?: string[];
  /** Additional context or instructions */
  context?: string;
  /** Original email being replied to (for replies) */
  replyTo?: StorageEmail;
  /** Thread context (previous emails in the thread) */
  threadContext?: StorageEmail[];
  /** Maximum length (short, medium, long) */
  length?: 'short' | 'medium' | 'long';
  /** Include greeting/salutation */
  includeGreeting?: boolean;
  /** Include signature placeholder */
  includeSignature?: boolean;
  /** User's name for signature */
  senderName?: string;
}

/**
 * Generated draft result
 */
export interface GeneratedDraft {
  /** The generated email body */
  body: string;
  /** Suggested subject line (if not provided) */
  suggestedSubject?: string;
  /** Alternative versions with different approaches */
  alternatives?: string[];
  /** Detected intent from context */
  detectedIntent?: DraftIntent;
  /** Confidence score (0-1) */
  confidence: number;
  /** Suggestions for improvement */
  suggestions?: string[];
}

/**
 * Zod schema for parsing LLM response
 */
export const GeneratedDraftSchema = z.object({
  body: z.string(),
  suggestedSubject: z.string().optional(),
  alternatives: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
  suggestions: z.array(z.string()).optional(),
});

// ============================================================
// Prompts
// ============================================================

/**
 * Get tone description for prompt
 */
function getToneDescription(tone: DraftTone): string {
  const descriptions: Record<DraftTone, string> = {
    formal: 'Use formal business language with proper salutations (Dear..., Sincerely). Avoid contractions.',
    professional: 'Use professional but warm language. Business casual, friendly yet appropriate.',
    casual: 'Use relaxed, conversational language. Contractions are fine. Be natural.',
    friendly: 'Use warm, personable language. Show genuine care and connection.',
    brief: 'Be concise and to-the-point. No unnecessary pleasantries. Get straight to the purpose.',
    apologetic: 'Express genuine regret. Take responsibility where appropriate. Offer solutions.',
    grateful: 'Express sincere appreciation. Be specific about what you are thankful for.',
    assertive: 'Be direct and confident. State positions clearly. Use "I" statements.',
  };
  return descriptions[tone];
}

/**
 * Get intent description for prompt
 */
function getIntentDescription(intent: DraftIntent): string {
  const descriptions: Record<DraftIntent, string> = {
    reply: 'Respond to the original email addressing its main points.',
    forward: 'Forward the email with helpful context for the new recipient.',
    followup: 'Follow up on a previous conversation or request.',
    introduction: 'Introduce yourself or a topic to the recipient.',
    request: 'Make a clear request, explaining the reason and any deadlines.',
    confirm: 'Confirm arrangements, agreements, or receipt of information.',
    decline: 'Politely decline while maintaining a positive relationship.',
    inform: 'Share information clearly and completely.',
    thank: 'Express gratitude with specificity about what you appreciate.',
    apologize: 'Apologize sincerely and offer to make things right.',
  };
  return descriptions[intent];
}

/**
 * Get length guidance for prompt
 */
function getLengthGuidance(length: 'short' | 'medium' | 'long'): string {
  const guidance: Record<string, string> = {
    short: '2-4 sentences. Be concise.',
    medium: '1-2 paragraphs. Cover key points without being too brief.',
    long: '2-4 paragraphs. Provide thorough coverage of all points.',
  };
  return guidance[length];
}

/**
 * Format email for context
 */
function formatEmailContext(email: StorageEmail): string {
  const fromStr =
    typeof email.from === 'string'
      ? email.from
      : email.from.name
        ? `${email.from.name} <${email.from.address}>`
        : email.from.address;

  const body = email.bodyText || email.snippet || '';
  const truncatedBody = body.length > 2000 ? body.substring(0, 2000) + '...' : body;

  return `From: ${fromStr}
Subject: ${email.subject}
Date: ${email.date}
---
${truncatedBody}`;
}

/**
 * Build the draft generation prompt
 */
function buildDraftPrompt(options: DraftOptions): string {
  const parts: string[] = [];

  // System context
  parts.push('You are an expert email writer helping compose a professional email.');
  parts.push('');

  // Intent and tone
  parts.push(`INTENT: ${options.intent}`);
  parts.push(getIntentDescription(options.intent));
  parts.push('');
  parts.push(`TONE: ${options.tone}`);
  parts.push(getToneDescription(options.tone));
  parts.push('');

  // Length
  parts.push(`LENGTH: ${getLengthGuidance(options.length || 'medium')}`);
  parts.push('');

  // Recipient
  if (options.to) {
    parts.push(`RECIPIENT: ${options.to}`);
    parts.push('');
  }

  // Subject
  if (options.subject) {
    parts.push(`SUBJECT: ${options.subject}`);
  } else {
    parts.push('SUBJECT: (Generate an appropriate subject line)');
  }
  parts.push('');

  // Original email context for replies
  if (options.replyTo) {
    parts.push('ORIGINAL EMAIL (replying to):');
    parts.push(formatEmailContext(options.replyTo));
    parts.push('');
  }

  // Thread context
  if (options.threadContext && options.threadContext.length > 0) {
    parts.push('THREAD CONTEXT (previous messages):');
    // Only include last 3 messages to keep context manageable
    const recentMessages = options.threadContext.slice(-3);
    for (const msg of recentMessages) {
      parts.push('---');
      parts.push(formatEmailContext(msg));
    }
    parts.push('');
  }

  // Key points to include
  if (options.keyPoints && options.keyPoints.length > 0) {
    parts.push('KEY POINTS TO INCLUDE:');
    for (const point of options.keyPoints) {
      parts.push(`- ${point}`);
    }
    parts.push('');
  }

  // Additional context
  if (options.context) {
    parts.push('ADDITIONAL CONTEXT:');
    parts.push(options.context);
    parts.push('');
  }

  // Instructions
  parts.push('INSTRUCTIONS:');
  parts.push('1. Write the email body only (no headers)');
  if (options.includeGreeting !== false) {
    parts.push('2. Start with an appropriate greeting');
  } else {
    parts.push('2. Do not include a greeting');
  }
  if (options.includeSignature !== false) {
    const name = options.senderName || '[Your Name]';
    parts.push(`3. End with a closing and signature placeholder: ${name}`);
  } else {
    parts.push('3. Do not include a signature');
  }
  parts.push('4. Keep the tone consistent throughout');
  parts.push('5. Be natural and human-like, not robotic');
  parts.push('');

  // Output format
  parts.push('Respond with a JSON object:');
  parts.push('{');
  parts.push('  "body": "The complete email body text",');
  if (!options.subject) {
    parts.push('  "suggestedSubject": "A suggested subject line",');
  }
  parts.push('  "confidence": 0.0-1.0,');
  parts.push('  "suggestions": ["Optional improvement suggestions"]');
  parts.push('}');

  return parts.join('\n');
}

/**
 * Build quick reply prompt for simple responses
 */
function buildQuickReplyPrompt(
  replyTo: StorageEmail,
  responseType: 'accept' | 'decline' | 'acknowledge' | 'question' | 'thanks',
  tone: DraftTone
): string {
  const typeInstructions: Record<string, string> = {
    accept: 'Accept the request/invitation positively.',
    decline: 'Politely decline while maintaining goodwill.',
    acknowledge: 'Acknowledge receipt and understanding.',
    question: 'Ask for clarification on the main points.',
    thanks: 'Express gratitude for what was shared/offered.',
  };

  return `Generate a quick ${responseType} response to this email.

ORIGINAL EMAIL:
${formatEmailContext(replyTo)}

RESPONSE TYPE: ${responseType}
${typeInstructions[responseType]}

TONE: ${tone}
${getToneDescription(tone)}

Write a short (2-4 sentence) response. Respond with JSON:
{
  "body": "The response text",
  "confidence": 0.0-1.0
}`;
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
function parseJsonResponse(response: string): GeneratedDraft {
  // Try to extract JSON from the response
  let jsonStr = response.trim();

  // Handle markdown code blocks
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  // Handle responses that start with explanation
  const jsonStart = jsonStr.indexOf('{');
  const jsonEnd = jsonStr.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return GeneratedDraftSchema.parse(parsed);
  } catch {
    // If JSON parsing fails, treat the whole response as the body
    return {
      body: response.trim(),
      confidence: 0.5,
      suggestions: ['Response was not in expected JSON format'],
    };
  }
}

/**
 * Generate an email draft based on options
 *
 * @example
 * ```typescript
 * const draft = await generateDraft({
 *   intent: 'reply',
 *   tone: 'professional',
 *   replyTo: originalEmail,
 *   keyPoints: ['Confirm meeting time', 'Ask about agenda'],
 * });
 * console.log(draft.body);
 * ```
 */
export async function generateDraft(options: DraftOptions): Promise<GeneratedDraft> {
  const router = await getRouter();
  const prompt = buildDraftPrompt(options);

  // Use the router's generateDraft which handles failover
  const response = await router.generateDraft({
    to: options.to,
    subject: options.subject,
    context: prompt,
    tone: options.tone === 'brief' ? 'professional' : options.tone as 'formal' | 'casual' | 'friendly' | 'professional',
  });

  return parseJsonResponse(response);
}

/**
 * Generate a quick reply for common response types
 *
 * @example
 * ```typescript
 * const draft = await generateQuickReply(email, 'accept', 'friendly');
 * console.log(draft.body); // "Thanks for the invitation! I'd love to join..."
 * ```
 */
export async function generateQuickReply(
  replyTo: StorageEmail,
  responseType: 'accept' | 'decline' | 'acknowledge' | 'question' | 'thanks',
  tone: DraftTone = 'professional'
): Promise<GeneratedDraft> {
  const router = await getRouter();
  const prompt = buildQuickReplyPrompt(replyTo, responseType, tone);

  const response = await router.generateDraft({
    context: prompt,
    tone: tone === 'brief' ? 'professional' : tone as 'formal' | 'casual' | 'friendly' | 'professional',
  });

  return parseJsonResponse(response);
}

/**
 * Suggest reply based on thread context (wrapper around router.suggestReply)
 *
 * Analyzes the thread and generates an appropriate reply suggestion.
 */
export async function suggestReply(
  thread: StorageEmail[],
  _tone: DraftTone = 'professional'
): Promise<GeneratedDraft> {
  if (thread.length === 0) {
    return {
      body: '',
      confidence: 0,
      suggestions: ['No emails in thread to reply to'],
    };
  }

  const router = await getRouter();
  const lastEmail = thread[thread.length - 1];

  // Convert to router's format
  const threadData = {
    id: lastEmail.threadId || lastEmail.providerMessageId,
    subject: lastEmail.subject,
    messages: thread.map((e) => ({
      id: e.providerMessageId,
      from: typeof e.from === 'string' ? e.from : e.from.address,
      to: e.to.map((t) => (typeof t === 'string' ? t : t.address)).join(', '),
      subject: e.subject,
      body: e.bodyText || e.snippet || '',
      date: e.date,
      threadId: e.threadId,
    })),
  };

  const response = await router.suggestReply(threadData);

  // Wrap in our format
  return {
    body: response,
    confidence: 0.8,
    detectedIntent: 'reply',
  };
}

/**
 * Improve an existing draft
 *
 * Takes a user's draft and suggests improvements while maintaining their voice.
 */
export async function improveDraft(
  currentDraft: string,
  tone: DraftTone = 'professional',
  improvements?: ('clarity' | 'conciseness' | 'tone' | 'grammar' | 'structure')[]
): Promise<GeneratedDraft> {
  const router = await getRouter();

  const focusAreas = improvements || ['clarity', 'conciseness', 'tone'];

  const prompt = `Improve this email draft while maintaining the author's voice and intent.

CURRENT DRAFT:
${currentDraft}

DESIRED TONE: ${tone}
${getToneDescription(tone)}

FOCUS AREAS:
${focusAreas.map((f) => `- ${f}`).join('\n')}

INSTRUCTIONS:
1. Preserve the core message and intent
2. Improve ${focusAreas.join(', ')}
3. Keep the author's personality evident
4. Do not add information not implied in the original

Respond with JSON:
{
  "body": "The improved draft",
  "confidence": 0.0-1.0,
  "suggestions": ["What was improved and why"]
}`;

  const response = await router.generateDraft({
    context: prompt,
    tone: tone === 'brief' ? 'professional' : tone as 'formal' | 'casual' | 'friendly' | 'professional',
  });

  return parseJsonResponse(response);
}

/**
 * Generate multiple draft variations for A/B testing or user choice
 */
export async function generateDraftVariations(
  options: DraftOptions,
  count: number = 3
): Promise<GeneratedDraft[]> {
  const tones: DraftTone[] = ['formal', 'professional', 'casual'];
  const variations: GeneratedDraft[] = [];

  for (let i = 0; i < Math.min(count, tones.length); i++) {
    const draft = await generateDraft({
      ...options,
      tone: i === 0 ? options.tone : tones[i],
    });
    variations.push(draft);
  }

  return variations;
}

// ============================================================
// Exports
// ============================================================

export {
  getToneDescription,
  getIntentDescription,
  buildDraftPrompt,
};
