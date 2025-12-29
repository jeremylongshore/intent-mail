/**
 * Smart Compose Suggestions Module
 *
 * AI-powered real-time suggestions while composing emails.
 * Provides auto-complete, grammar fixes, tone adjustments, and context-aware suggestions.
 *
 * E3.S3.5: Smart Compose Suggestions
 */

import { z } from 'zod';
import type { Email as StorageEmail } from '../types/email.js';
import { MultiProviderRouter } from './router.js';
import { getToneDescription, type DraftTone } from './draft-generator.js';

// ============================================================
// Types and Schemas
// ============================================================

/**
 * Suggestion type categories
 */
export type SuggestionType =
  | 'completion'      // Complete the current sentence/phrase
  | 'grammar'         // Grammar/spelling correction
  | 'tone'            // Tone adjustment suggestion
  | 'phrase'          // Alternative phrasing
  | 'subject'         // Subject line suggestion
  | 'greeting'        // Greeting/salutation suggestion
  | 'closing'         // Closing/sign-off suggestion
  | 'action';         // Call-to-action suggestion

/**
 * Single suggestion item
 */
export interface Suggestion {
  /** Type of suggestion */
  type: SuggestionType;
  /** The suggested text */
  text: string;
  /** Position to insert (character offset) */
  position?: number;
  /** Length of text to replace (0 for insert) */
  replaceLength?: number;
  /** Preview of how the text would look */
  preview?: string;
  /** Explanation for the suggestion */
  reason?: string;
  /** Confidence score 0-1 */
  confidence: number;
}

/**
 * Compose context for generating suggestions
 */
export interface ComposeContext {
  /** Current draft body */
  body: string;
  /** Current subject line */
  subject?: string;
  /** Recipients */
  to?: string[];
  /** CC recipients */
  cc?: string[];
  /** Cursor position in body */
  cursorPosition?: number;
  /** Email being replied to */
  replyTo?: StorageEmail;
  /** Thread context */
  threadContext?: StorageEmail[];
  /** Desired tone */
  tone?: DraftTone;
  /** User's name for signature */
  senderName?: string;
}

/**
 * Suggestions response
 */
export interface ComposeSuggestionsResult {
  /** List of suggestions */
  suggestions: Suggestion[];
  /** Analysis of current draft */
  analysis?: {
    estimatedTone: DraftTone;
    wordCount: number;
    readingLevel: 'simple' | 'moderate' | 'complex';
    hasGreeting: boolean;
    hasClosing: boolean;
    hasCallToAction: boolean;
  };
  /** Execution time in ms */
  executionTimeMs: number;
}

/**
 * Zod schema for LLM completion response
 */
const CompletionResponseSchema = z.object({
  completions: z.array(z.object({
    text: z.string(),
    confidence: z.number().min(0).max(1),
  })),
});

/**
 * Zod schema for grammar check response
 */
const GrammarResponseSchema = z.object({
  corrections: z.array(z.object({
    original: z.string(),
    corrected: z.string(),
    position: z.number().int().nonnegative(),
    reason: z.string(),
    confidence: z.number().min(0).max(1),
  })),
});

/**
 * Zod schema for phrase suggestions response
 */
const PhraseSuggestionSchema = z.object({
  suggestions: z.array(z.object({
    type: z.enum(['completion', 'grammar', 'tone', 'phrase', 'subject', 'greeting', 'closing', 'action']),
    text: z.string(),
    reason: z.string().optional(),
    confidence: z.number().min(0).max(1),
  })),
});

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
 * Format email context for prompts
 */
function formatEmailContext(email: StorageEmail): string {
  const fromStr =
    typeof email.from === 'string'
      ? email.from
      : email.from.name
        ? `${email.from.name} <${email.from.address}>`
        : email.from.address;

  const body = email.bodyText || email.snippet || '';
  const truncatedBody = body.length > 1500 ? body.substring(0, 1500) + '...' : body;

  return `From: ${fromStr}
Subject: ${email.subject}
Date: ${email.date}
---
${truncatedBody}`;
}

/**
 * Extract text around cursor for context
 */
function getTextAroundCursor(body: string, cursorPosition: number, windowSize: number = 200): {
  before: string;
  after: string;
  currentLine: string;
} {
  const before = body.substring(Math.max(0, cursorPosition - windowSize), cursorPosition);
  const after = body.substring(cursorPosition, Math.min(body.length, cursorPosition + windowSize));

  // Find current line
  const lineStart = body.lastIndexOf('\n', cursorPosition - 1) + 1;
  const lineEnd = body.indexOf('\n', cursorPosition);
  const currentLine = body.substring(lineStart, lineEnd === -1 ? body.length : lineEnd);

  return { before, after, currentLine };
}

/**
 * Analyze the current draft
 */
function analyzeDraft(body: string): {
  wordCount: number;
  readingLevel: 'simple' | 'moderate' | 'complex';
  hasGreeting: boolean;
  hasClosing: boolean;
  hasCallToAction: boolean;
} {
  const words = body.split(/\s+/).filter(w => w.length > 0);
  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / (words.length || 1);
  const sentences = body.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = words.length / (sentences.length || 1);

  // Simple readability heuristic
  let readingLevel: 'simple' | 'moderate' | 'complex' = 'moderate';
  if (avgWordLength < 5 && avgSentenceLength < 15) {
    readingLevel = 'simple';
  } else if (avgWordLength > 6 || avgSentenceLength > 25) {
    readingLevel = 'complex';
  }

  // Check for greeting
  const greetingPatterns = /^(hi|hello|hey|dear|good\s+(morning|afternoon|evening))/im;
  const hasGreeting = greetingPatterns.test(body.substring(0, 100));

  // Check for closing
  const closingPatterns = /(best|regards|sincerely|thanks|cheers|take care|talk soon)/im;
  const hasClosing = closingPatterns.test(body.substring(-200));

  // Check for call to action
  const ctaPatterns = /(please|could you|would you|let me know|can you|need|require|by|deadline)/im;
  const hasCallToAction = ctaPatterns.test(body);

  return {
    wordCount: words.length,
    readingLevel,
    hasGreeting,
    hasClosing,
    hasCallToAction,
  };
}

/**
 * Generate sentence completions at cursor position
 */
export async function getCompletions(
  context: ComposeContext,
  count: number = 3
): Promise<Suggestion[]> {
  const router = await getRouter();
  const cursorPos = context.cursorPosition ?? context.body.length;
  const { before, currentLine } = getTextAroundCursor(context.body, cursorPos);

  // Build prompt for completions
  let prompt = `Complete the email sentence naturally.

CURRENT EMAIL DRAFT:
${context.body.substring(0, cursorPos)}|CURSOR|${context.body.substring(cursorPos)}

The cursor (|CURSOR|) marks where text should be inserted.
Current partial line: "${currentLine}"
Text before cursor: "...${before.slice(-100)}"

`;

  // Add reply context if available
  if (context.replyTo) {
    prompt += `\nREPLYING TO:
${formatEmailContext(context.replyTo)}

`;
  }

  // Add tone guidance
  if (context.tone) {
    prompt += `TONE: ${context.tone}
${getToneDescription(context.tone)}

`;
  }

  prompt += `Generate ${count} natural completions for the current sentence or thought.
Keep completions concise (under 50 words each).
Match the tone and style of the existing text.

Respond with JSON:
{
  "completions": [
    { "text": "completion 1", "confidence": 0.0-1.0 },
    { "text": "completion 2", "confidence": 0.0-1.0 },
    { "text": "completion 3", "confidence": 0.0-1.0 }
  ]
}`;

  const dummyEmail = {
    id: 'prompt',
    from: 'system',
    to: 'assistant',
    subject: 'Completion Request',
    body: prompt,
    date: new Date().toISOString(),
  };

  try {
    const response = await router.summarize([dummyEmail]);
    const parsed = parseJsonResponse(response, CompletionResponseSchema);

    return parsed.completions.map((c) => ({
      type: 'completion' as SuggestionType,
      text: c.text,
      position: cursorPos,
      replaceLength: 0,
      confidence: c.confidence,
    }));
  } catch (error) {
    console.error('[compose-suggestions] Completion failed:', error);
    return [];
  }
}

/**
 * Check grammar and spelling
 */
export async function checkGrammar(
  body: string
): Promise<Suggestion[]> {
  const router = await getRouter();

  const prompt = `Check this email draft for grammar, spelling, and punctuation errors.

EMAIL DRAFT:
${body}

Identify any errors and provide corrections.
Only flag clear errors, not style preferences.

Respond with JSON:
{
  "corrections": [
    {
      "original": "the error text",
      "corrected": "the corrected text",
      "position": <character offset in the text>,
      "reason": "why this is an error",
      "confidence": 0.0-1.0
    }
  ]
}

If no errors found, return: { "corrections": [] }`;

  const dummyEmail = {
    id: 'prompt',
    from: 'system',
    to: 'assistant',
    subject: 'Grammar Check',
    body: prompt,
    date: new Date().toISOString(),
  };

  try {
    const response = await router.summarize([dummyEmail]);
    const parsed = parseJsonResponse(response, GrammarResponseSchema);

    return parsed.corrections.map((c) => ({
      type: 'grammar' as SuggestionType,
      text: c.corrected,
      position: c.position,
      replaceLength: c.original.length,
      reason: c.reason,
      confidence: c.confidence,
    }));
  } catch (error) {
    console.error('[compose-suggestions] Grammar check failed:', error);
    return [];
  }
}

/**
 * Suggest subject lines based on email content
 */
export async function suggestSubjects(
  context: ComposeContext,
  count: number = 5
): Promise<Suggestion[]> {
  const router = await getRouter();

  let prompt = `Generate subject line suggestions for this email.

EMAIL BODY:
${context.body}

`;

  if (context.replyTo) {
    prompt += `REPLYING TO:
Subject: ${context.replyTo.subject}
${context.replyTo.snippet || ''}

`;
  }

  prompt += `Generate ${count} effective subject lines that:
- Summarize the email content
- Are concise (under 60 characters ideally)
- Are clear and specific
- Use appropriate tone

Respond with JSON:
{
  "suggestions": [
    { "type": "subject", "text": "Subject line 1", "confidence": 0.0-1.0 },
    { "type": "subject", "text": "Subject line 2", "confidence": 0.0-1.0 }
  ]
}`;

  const dummyEmail = {
    id: 'prompt',
    from: 'system',
    to: 'assistant',
    subject: 'Subject Suggestions',
    body: prompt,
    date: new Date().toISOString(),
  };

  try {
    const response = await router.summarize([dummyEmail]);
    const parsed = parseJsonResponse(response, PhraseSuggestionSchema);

    return parsed.suggestions
      .filter(s => s.type === 'subject')
      .map((s) => ({
        type: 'subject' as SuggestionType,
        text: s.text,
        reason: s.reason,
        confidence: s.confidence,
      }));
  } catch (error) {
    console.error('[compose-suggestions] Subject suggestion failed:', error);
    return [];
  }
}

/**
 * Suggest greeting/salutation
 */
export async function suggestGreetings(
  context: ComposeContext
): Promise<Suggestion[]> {
  const router = await getRouter();
  const recipient = context.to?.[0] || 'the recipient';
  const tone = context.tone || 'professional';

  const prompt = `Suggest appropriate greeting/salutation options for an email.

RECIPIENT: ${recipient}
TONE: ${tone}
${getToneDescription(tone)}

${context.replyTo ? `This is a REPLY to an email from: ${typeof context.replyTo.from === 'string' ? context.replyTo.from : context.replyTo.from.address}` : 'This is a NEW email.'}

Generate 4-5 greeting options appropriate for the context and tone.
Include both formal and semi-formal options.

Respond with JSON:
{
  "suggestions": [
    { "type": "greeting", "text": "Hi [Name],", "confidence": 0.0-1.0 },
    { "type": "greeting", "text": "Dear [Name],", "confidence": 0.0-1.0 }
  ]
}`;

  const dummyEmail = {
    id: 'prompt',
    from: 'system',
    to: 'assistant',
    subject: 'Greeting Suggestions',
    body: prompt,
    date: new Date().toISOString(),
  };

  try {
    const response = await router.summarize([dummyEmail]);
    const parsed = parseJsonResponse(response, PhraseSuggestionSchema);

    return parsed.suggestions
      .filter(s => s.type === 'greeting')
      .map((s) => ({
        type: 'greeting' as SuggestionType,
        text: s.text,
        position: 0,
        replaceLength: 0,
        confidence: s.confidence,
      }));
  } catch (error) {
    console.error('[compose-suggestions] Greeting suggestion failed:', error);
    // Return some defaults
    return [
      { type: 'greeting', text: 'Hi,', confidence: 0.7 },
      { type: 'greeting', text: 'Hello,', confidence: 0.6 },
      { type: 'greeting', text: 'Dear recipient,', confidence: 0.5 },
    ];
  }
}

/**
 * Suggest closing/sign-off
 */
export async function suggestClosings(
  context: ComposeContext
): Promise<Suggestion[]> {
  const router = await getRouter();
  const tone = context.tone || 'professional';
  const senderName = context.senderName || '[Your Name]';

  const prompt = `Suggest appropriate closing/sign-off options for an email.

TONE: ${tone}
${getToneDescription(tone)}
SENDER NAME: ${senderName}

Generate 4-5 closing options appropriate for the tone.
Include the sender name in the closing.

Respond with JSON:
{
  "suggestions": [
    { "type": "closing", "text": "Best regards,\\n${senderName}", "confidence": 0.0-1.0 },
    { "type": "closing", "text": "Thanks,\\n${senderName}", "confidence": 0.0-1.0 }
  ]
}`;

  const dummyEmail = {
    id: 'prompt',
    from: 'system',
    to: 'assistant',
    subject: 'Closing Suggestions',
    body: prompt,
    date: new Date().toISOString(),
  };

  try {
    const response = await router.summarize([dummyEmail]);
    const parsed = parseJsonResponse(response, PhraseSuggestionSchema);

    return parsed.suggestions
      .filter(s => s.type === 'closing')
      .map((s) => ({
        type: 'closing' as SuggestionType,
        text: s.text.replace(/\\n/g, '\n'),
        confidence: s.confidence,
      }));
  } catch (error) {
    console.error('[compose-suggestions] Closing suggestion failed:', error);
    // Return some defaults
    return [
      { type: 'closing', text: `Best regards,\n${senderName}`, confidence: 0.7 },
      { type: 'closing', text: `Thanks,\n${senderName}`, confidence: 0.6 },
      { type: 'closing', text: `Sincerely,\n${senderName}`, confidence: 0.5 },
    ];
  }
}

/**
 * Suggest tone adjustments
 */
export async function suggestToneAdjustments(
  body: string,
  targetTone: DraftTone
): Promise<Suggestion[]> {
  const router = await getRouter();

  const prompt = `Analyze this email draft and suggest tone adjustments to make it more ${targetTone}.

CURRENT DRAFT:
${body}

TARGET TONE: ${targetTone}
${getToneDescription(targetTone)}

Identify specific phrases that could be adjusted to better match the target tone.
Provide alternative phrasing for each.

Respond with JSON:
{
  "suggestions": [
    {
      "type": "tone",
      "text": "suggested replacement phrase",
      "reason": "the original phrase and why it should change",
      "confidence": 0.0-1.0
    }
  ]
}

If the draft already matches the target tone well, return: { "suggestions": [] }`;

  const dummyEmail = {
    id: 'prompt',
    from: 'system',
    to: 'assistant',
    subject: 'Tone Analysis',
    body: prompt,
    date: new Date().toISOString(),
  };

  try {
    const response = await router.summarize([dummyEmail]);
    const parsed = parseJsonResponse(response, PhraseSuggestionSchema);

    return parsed.suggestions
      .filter(s => s.type === 'tone')
      .map((s) => ({
        type: 'tone' as SuggestionType,
        text: s.text,
        reason: s.reason,
        confidence: s.confidence,
      }));
  } catch (error) {
    console.error('[compose-suggestions] Tone suggestion failed:', error);
    return [];
  }
}

/**
 * Get comprehensive suggestions for current compose state
 */
export async function getComposeSuggestions(
  context: ComposeContext
): Promise<ComposeSuggestionsResult> {
  const startTime = Date.now();
  const suggestions: Suggestion[] = [];

  // Analyze the current draft
  const analysis = analyzeDraft(context.body);
  const estimatedTone: DraftTone = analysis.readingLevel === 'complex' ? 'formal' : 'professional';

  // Get completions if cursor is at a natural completion point
  if (context.cursorPosition !== undefined) {
    const { currentLine } = getTextAroundCursor(context.body, context.cursorPosition);

    // Only get completions if there's partial text to complete
    if (currentLine.trim().length > 3 && !currentLine.trim().endsWith('.')) {
      const completions = await getCompletions(context, 3);
      suggestions.push(...completions);
    }
  }

  // Suggest greeting if missing
  if (!analysis.hasGreeting && context.body.length < 50) {
    const greetings = await suggestGreetings(context);
    suggestions.push(...greetings);
  }

  // Suggest closing if email is substantial but missing closing
  if (!analysis.hasClosing && analysis.wordCount > 30) {
    const closings = await suggestClosings(context);
    suggestions.push(...closings);
  }

  // Check grammar if there's meaningful content
  if (analysis.wordCount > 10) {
    const grammarSuggestions = await checkGrammar(context.body);
    suggestions.push(...grammarSuggestions);
  }

  // Suggest subject if not provided and body has content
  if (!context.subject && analysis.wordCount > 20) {
    const subjectSuggestions = await suggestSubjects(context, 3);
    suggestions.push(...subjectSuggestions);
  }

  return {
    suggestions,
    analysis: {
      estimatedTone,
      ...analysis,
    },
    executionTimeMs: Date.now() - startTime,
  };
}

/**
 * Quick inline suggestion - fastest response for real-time typing
 */
export async function getInlineSuggestion(
  partialText: string,
  context?: {
    tone?: DraftTone;
    replyTo?: StorageEmail;
  }
): Promise<string | null> {
  const router = await getRouter();

  // Only suggest if there's a partial sentence to complete
  if (partialText.length < 5 || partialText.endsWith('.') || partialText.endsWith('!') || partialText.endsWith('?')) {
    return null;
  }

  const prompt = `Complete this sentence naturally with 5-15 words:
"${partialText}"

${context?.tone ? `Use ${context.tone} tone.` : ''}
${context?.replyTo ? `Context: Replying to email about "${context.replyTo.subject}"` : ''}

Respond with ONLY the completion text (no quotes, no explanation):`;

  const dummyEmail = {
    id: 'prompt',
    from: 'system',
    to: 'assistant',
    subject: 'Inline Completion',
    body: prompt,
    date: new Date().toISOString(),
  };

  try {
    const response = await router.summarize([dummyEmail]);
    const completion = response.trim();

    // Basic validation - completion should be reasonable length
    if (completion.length > 0 && completion.length < 200) {
      return completion;
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Helper Functions
// ============================================================

/**
 * Parse JSON response from LLM with schema validation
 */
function parseJsonResponse<T>(response: string, schema: z.ZodSchema<T>): T {
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

  const parsed = JSON.parse(jsonStr);
  return schema.parse(parsed);
}
