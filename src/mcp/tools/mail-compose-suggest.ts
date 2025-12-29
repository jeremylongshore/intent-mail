/**
 * MCP Tool: mail_compose_suggest
 *
 * AI-powered real-time suggestions while composing emails.
 * Provides completions, grammar checks, subject suggestions, and more.
 *
 * E3.S3.5: Smart Compose Suggestions
 */

import { z } from 'zod';
import {
  getCompletions,
  checkGrammar,
  suggestSubjects,
  suggestGreetings,
  suggestClosings,
  suggestToneAdjustments,
  getComposeSuggestions,
  getInlineSuggestion,
  type ComposeContext,
} from '../../ai/compose-suggestions.js';
import { getEmailById } from '../../storage/services/email-storage.js';

// ============================================================
// Input Schemas
// ============================================================

const ToneSchema = z.enum([
  'formal',
  'professional',
  'casual',
  'friendly',
  'brief',
  'apologetic',
  'grateful',
  'assertive',
]);

/**
 * Get sentence completions
 */
const CompletionInputSchema = z.object({
  mode: z.literal('completion'),
  /** Current draft body */
  body: z.string(),
  /** Cursor position in body */
  cursorPosition: z.number().int().nonnegative().optional(),
  /** Desired tone */
  tone: ToneSchema.optional(),
  /** Email ID being replied to */
  replyToId: z.number().int().positive().optional(),
  /** Number of completions to generate */
  count: z.number().int().positive().max(5).default(3),
});

/**
 * Check grammar and spelling
 */
const GrammarInputSchema = z.object({
  mode: z.literal('grammar'),
  /** Text to check */
  body: z.string().min(10),
});

/**
 * Suggest subject lines
 */
const SubjectInputSchema = z.object({
  mode: z.literal('subject'),
  /** Email body */
  body: z.string().min(20),
  /** Email ID being replied to */
  replyToId: z.number().int().positive().optional(),
  /** Number of suggestions */
  count: z.number().int().positive().max(10).default(5),
});

/**
 * Suggest greetings
 */
const GreetingInputSchema = z.object({
  mode: z.literal('greeting'),
  /** Recipients */
  to: z.array(z.string().email()).optional(),
  /** Desired tone */
  tone: ToneSchema.optional(),
  /** Email ID being replied to */
  replyToId: z.number().int().positive().optional(),
});

/**
 * Suggest closings
 */
const ClosingInputSchema = z.object({
  mode: z.literal('closing'),
  /** Desired tone */
  tone: ToneSchema.optional(),
  /** Sender name for signature */
  senderName: z.string().optional(),
});

/**
 * Get tone adjustment suggestions
 */
const ToneInputSchema = z.object({
  mode: z.literal('tone'),
  /** Current draft body */
  body: z.string().min(20),
  /** Target tone */
  targetTone: ToneSchema,
});

/**
 * Get comprehensive suggestions
 */
const FullInputSchema = z.object({
  mode: z.literal('full'),
  /** Current draft body */
  body: z.string(),
  /** Current subject */
  subject: z.string().optional(),
  /** Recipients */
  to: z.array(z.string().email()).optional(),
  /** Cursor position */
  cursorPosition: z.number().int().nonnegative().optional(),
  /** Desired tone */
  tone: ToneSchema.optional(),
  /** Email ID being replied to */
  replyToId: z.number().int().positive().optional(),
  /** Sender name */
  senderName: z.string().optional(),
});

/**
 * Get quick inline suggestion
 */
const InlineInputSchema = z.object({
  mode: z.literal('inline'),
  /** Partial text to complete */
  partialText: z.string().min(5),
  /** Desired tone */
  tone: ToneSchema.optional(),
  /** Email ID being replied to */
  replyToId: z.number().int().positive().optional(),
});

/**
 * Combined input schema
 */
const MailComposeSuggestInputSchema = z.discriminatedUnion('mode', [
  CompletionInputSchema,
  GrammarInputSchema,
  SubjectInputSchema,
  GreetingInputSchema,
  ClosingInputSchema,
  ToneInputSchema,
  FullInputSchema,
  InlineInputSchema,
]);

// ============================================================
// Tool Definition
// ============================================================

export const mailComposeSuggestTool = {
  definition: {
    name: 'mail_compose_suggest',
    description: `AI-powered real-time suggestions while composing emails.

Modes:
- completion: Generate sentence completions at cursor position
- grammar: Check grammar and spelling errors
- subject: Suggest subject lines based on content
- greeting: Suggest appropriate greetings
- closing: Suggest sign-offs and closings
- tone: Suggest adjustments to match target tone
- full: Get comprehensive suggestions (completions, grammar, subject, etc.)
- inline: Quick single completion for real-time typing

Tones: formal, professional, casual, friendly, brief, apologetic, grateful, assertive`,
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['completion', 'grammar', 'subject', 'greeting', 'closing', 'tone', 'full', 'inline'],
          description: 'Suggestion mode',
        },
        // Common
        body: {
          type: 'string',
          description: 'Current email draft body',
        },
        tone: {
          type: 'string',
          enum: ['formal', 'professional', 'casual', 'friendly', 'brief', 'apologetic', 'grateful', 'assertive'],
          description: 'Desired email tone',
        },
        replyToId: {
          type: 'integer',
          description: 'Email ID being replied to (for context)',
        },
        // Completion mode
        cursorPosition: {
          type: 'integer',
          description: 'Cursor position in body for completions',
        },
        count: {
          type: 'integer',
          description: 'Number of suggestions to generate',
        },
        // Subject mode
        subject: {
          type: 'string',
          description: 'Current subject line',
        },
        // Greeting/closing modes
        to: {
          type: 'array',
          items: { type: 'string' },
          description: 'Recipients email addresses',
        },
        senderName: {
          type: 'string',
          description: 'Sender name for signature',
        },
        // Tone mode
        targetTone: {
          type: 'string',
          enum: ['formal', 'professional', 'casual', 'friendly', 'brief', 'apologetic', 'grateful', 'assertive'],
          description: 'Target tone for adjustments',
        },
        // Inline mode
        partialText: {
          type: 'string',
          description: 'Partial text to complete',
        },
      },
      required: ['mode'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailComposeSuggestInputSchema.parse(args);

    try {
      switch (input.mode) {
        case 'completion': {
          // Get reply context if provided
          let replyTo;
          if (input.replyToId) {
            replyTo = await getEmailById(input.replyToId) ?? undefined;
          }

          const context: ComposeContext = {
            body: input.body,
            cursorPosition: input.cursorPosition,
            tone: input.tone,
            replyTo,
          };

          const suggestions = await getCompletions(context, input.count);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'completion',
                    suggestions: suggestions.map((s) => ({
                      text: s.text,
                      confidence: s.confidence,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'grammar': {
          const suggestions = await checkGrammar(input.body);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'grammar',
                    corrections: suggestions.map((s) => ({
                      corrected: s.text,
                      position: s.position,
                      replaceLength: s.replaceLength,
                      reason: s.reason,
                      confidence: s.confidence,
                    })),
                    hasErrors: suggestions.length > 0,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'subject': {
          let replyTo;
          if (input.replyToId) {
            replyTo = await getEmailById(input.replyToId) ?? undefined;
          }

          const context: ComposeContext = {
            body: input.body,
            replyTo,
          };

          const suggestions = await suggestSubjects(context, input.count);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'subject',
                    suggestions: suggestions.map((s) => ({
                      text: s.text,
                      confidence: s.confidence,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'greeting': {
          let replyTo;
          if (input.replyToId) {
            replyTo = await getEmailById(input.replyToId) ?? undefined;
          }

          const context: ComposeContext = {
            body: '',
            to: input.to,
            tone: input.tone,
            replyTo,
          };

          const suggestions = await suggestGreetings(context);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'greeting',
                    suggestions: suggestions.map((s) => ({
                      text: s.text,
                      confidence: s.confidence,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'closing': {
          const context: ComposeContext = {
            body: '',
            tone: input.tone,
            senderName: input.senderName,
          };

          const suggestions = await suggestClosings(context);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'closing',
                    suggestions: suggestions.map((s) => ({
                      text: s.text,
                      confidence: s.confidence,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'tone': {
          const suggestions = await suggestToneAdjustments(input.body, input.targetTone);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'tone',
                    targetTone: input.targetTone,
                    adjustments: suggestions.map((s) => ({
                      suggestion: s.text,
                      reason: s.reason,
                      confidence: s.confidence,
                    })),
                    needsAdjustment: suggestions.length > 0,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'full': {
          let replyTo;
          if (input.replyToId) {
            replyTo = await getEmailById(input.replyToId) ?? undefined;
          }

          const context: ComposeContext = {
            body: input.body,
            subject: input.subject,
            to: input.to,
            cursorPosition: input.cursorPosition,
            tone: input.tone,
            replyTo,
            senderName: input.senderName,
          };

          const result = await getComposeSuggestions(context);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'full',
                    suggestions: result.suggestions.map((s) => ({
                      type: s.type,
                      text: s.text,
                      position: s.position,
                      replaceLength: s.replaceLength,
                      reason: s.reason,
                      confidence: s.confidence,
                    })),
                    analysis: result.analysis,
                    executionTimeMs: result.executionTimeMs,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'inline': {
          let replyTo;
          if (input.replyToId) {
            replyTo = await getEmailById(input.replyToId) ?? undefined;
          }

          const suggestion = await getInlineSuggestion(input.partialText, {
            tone: input.tone,
            replyTo,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'inline',
                    partialText: input.partialText,
                    completion: suggestion,
                    hasCompletion: suggestion !== null,
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
              error: error instanceof Error ? error.message : 'Suggestion generation failed',
            }),
          },
        ],
      };
    }
  },
};
