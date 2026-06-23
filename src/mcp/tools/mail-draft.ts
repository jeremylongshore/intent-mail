/**
 * MCP Tool: mail_draft
 *
 * AI-powered email draft generation with tone control.
 * Generates drafts for replies, new emails, follow-ups, etc.
 *
 * E3.S3.2: Smart Draft Generation
 */

import { z } from 'zod';
import {
  generateDraft,
  generateQuickReply,
  suggestReply,
  improveDraft,
} from '../../ai/draft-generator.js';
import { getEmailById, getEmailsByThreadId } from '../../storage/services/email-storage.js';
import { expandContext } from '../../ai/context-store.js';

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

const IntentSchema = z.enum([
  'reply',
  'forward',
  'followup',
  'introduction',
  'request',
  'confirm',
  'decline',
  'inform',
  'thank',
  'apologize',
]);

const QuickReplyTypeSchema = z.enum([
  'accept',
  'decline',
  'acknowledge',
  'question',
  'thanks',
]);

/**
 * Generate a new draft from scratch or in reply to an email
 */
const GenerateDraftInputSchema = z.object({
  mode: z.literal('generate'),
  /** Email intent */
  intent: IntentSchema,
  /** Desired tone */
  tone: ToneSchema.default('professional'),
  /** Recipient email address */
  to: z.string().email().optional(),
  /** Email subject (will be generated if not provided) */
  subject: z.string().optional(),
  /** Key points to include */
  keyPoints: z.array(z.string()).optional(),
  /** Additional context or instructions */
  context: z.string().optional(),
  /** Email ID to reply to */
  replyToEmailId: z.number().int().positive().optional(),
  /** Desired length */
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  /** Include greeting */
  includeGreeting: z.boolean().default(true),
  /** Include signature placeholder */
  includeSignature: z.boolean().default(true),
  /** Sender's name for signature */
  senderName: z.string().optional(),
});

/**
 * Generate a quick reply to an email
 */
const QuickReplyInputSchema = z.object({
  mode: z.literal('quick_reply'),
  /** Email ID to reply to */
  emailId: z.number().int().positive(),
  /** Type of quick reply */
  replyType: QuickReplyTypeSchema,
  /** Desired tone */
  tone: ToneSchema.default('professional'),
});

/**
 * Suggest a reply based on thread context
 */
const SuggestReplyInputSchema = z.object({
  mode: z.literal('suggest'),
  /** Thread ID to analyze */
  threadId: z.string(),
  /** Desired tone */
  tone: ToneSchema.default('professional'),
});

/**
 * Improve an existing draft
 */
const ImproveDraftInputSchema = z.object({
  mode: z.literal('improve'),
  /** Current draft text */
  currentDraft: z.string().min(10),
  /** Desired tone */
  tone: ToneSchema.default('professional'),
  /** Areas to focus on */
  focusAreas: z.array(
    z.enum(['clarity', 'conciseness', 'tone', 'grammar', 'structure'])
  ).optional(),
});

/**
 * Combined input schema
 */
const MailDraftInputSchema = z.discriminatedUnion('mode', [
  GenerateDraftInputSchema,
  QuickReplyInputSchema,
  SuggestReplyInputSchema,
  ImproveDraftInputSchema,
]);

// Type inference handled by zod discriminated union

// ============================================================
// Tool Definition
// ============================================================

export const mailDraftTool = {
  definition: {
    name: 'mail_draft',
    description: `Generate AI-powered email drafts with tone control and context awareness.

Modes:
- generate: Create a new draft from scratch or in reply to an email
- quick_reply: Generate a quick response (accept/decline/acknowledge/question/thanks)
- suggest: Analyze a thread and suggest an appropriate reply
- improve: Enhance an existing draft while preserving voice

Tones: formal, professional, casual, friendly, brief, apologetic, grateful, assertive
Intents: reply, forward, followup, introduction, request, confirm, decline, inform, thank, apologize`,
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['generate', 'quick_reply', 'suggest', 'improve'],
          description: 'Draft generation mode',
        },
        // Generate mode
        intent: {
          type: 'string',
          enum: ['reply', 'forward', 'followup', 'introduction', 'request', 'confirm', 'decline', 'inform', 'thank', 'apologize'],
          description: 'Email intent (for generate mode)',
        },
        tone: {
          type: 'string',
          enum: ['formal', 'professional', 'casual', 'friendly', 'brief', 'apologetic', 'grateful', 'assertive'],
          default: 'professional',
          description: 'Desired email tone',
        },
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject (will be generated if not provided)',
        },
        keyPoints: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key points to include in the draft',
        },
        context: {
          type: 'string',
          description: 'Additional context or instructions',
        },
        replyToEmailId: {
          type: 'integer',
          description: 'Email ID to reply to (for generate mode)',
        },
        length: {
          type: 'string',
          enum: ['short', 'medium', 'long'],
          default: 'medium',
          description: 'Desired email length',
        },
        includeGreeting: {
          type: 'boolean',
          default: true,
          description: 'Include greeting/salutation',
        },
        includeSignature: {
          type: 'boolean',
          default: true,
          description: 'Include signature placeholder',
        },
        senderName: {
          type: 'string',
          description: 'Sender name for signature',
        },
        // Quick reply mode
        emailId: {
          type: 'integer',
          description: 'Email ID to reply to (for quick_reply mode)',
        },
        replyType: {
          type: 'string',
          enum: ['accept', 'decline', 'acknowledge', 'question', 'thanks'],
          description: 'Type of quick reply',
        },
        // Suggest mode
        threadId: {
          type: 'string',
          description: 'Thread ID to analyze (for suggest mode)',
        },
        // Improve mode
        currentDraft: {
          type: 'string',
          description: 'Current draft text to improve',
        },
        focusAreas: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['clarity', 'conciseness', 'tone', 'grammar', 'structure'],
          },
          description: 'Areas to focus improvement on',
        },
      },
      required: ['mode'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailDraftInputSchema.parse(args);

    try {
      switch (input.mode) {
        case 'generate': {
          // Get reply context if replyToEmailId provided
          let replyTo;
          let threadContext;

          if (input.replyToEmailId) {
            replyTo = await getEmailById(input.replyToEmailId);
            if (replyTo?.threadId) {
              const threadEmails = await getEmailsByThreadId(replyTo.threadId);
              // Exclude the email we're replying to from context
              threadContext = threadEmails.filter(
                (e) => e.id !== input.replyToEmailId
              );
            }
          }

          const draft = await generateDraft({
            intent: input.intent,
            tone: input.tone,
            to: input.to,
            subject: input.subject,
            keyPoints: input.keyPoints,
            // C7 L1: expand @project:/@client: mentions into a context block.
            context: expandContext(input.context),
            replyTo: replyTo || undefined,
            threadContext,
            length: input.length,
            includeGreeting: input.includeGreeting,
            includeSignature: input.includeSignature,
            senderName: input.senderName,
          });

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'generate',
                    draft: {
                      body: draft.body,
                      suggestedSubject: draft.suggestedSubject,
                      confidence: draft.confidence,
                      suggestions: draft.suggestions,
                    },
                    metadata: {
                      intent: input.intent,
                      tone: input.tone,
                      length: input.length,
                      replyToEmailId: input.replyToEmailId,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'quick_reply': {
          const email = await getEmailById(input.emailId);
          if (!email) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `Email with ID ${input.emailId} not found`,
                  }),
                },
              ],
            };
          }

          const draft = await generateQuickReply(
            email,
            input.replyType,
            input.tone
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'quick_reply',
                    draft: {
                      body: draft.body,
                      confidence: draft.confidence,
                    },
                    metadata: {
                      emailId: input.emailId,
                      replyType: input.replyType,
                      tone: input.tone,
                      originalSubject: email.subject,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'suggest': {
          const threadEmails = await getEmailsByThreadId(input.threadId);
          if (threadEmails.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: false,
                    error: `No emails found in thread ${input.threadId}`,
                  }),
                },
              ],
            };
          }

          const draft = await suggestReply(threadEmails, input.tone);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'suggest',
                    draft: {
                      body: draft.body,
                      confidence: draft.confidence,
                      detectedIntent: draft.detectedIntent,
                    },
                    metadata: {
                      threadId: input.threadId,
                      tone: input.tone,
                      emailCount: threadEmails.length,
                      lastEmailSubject: threadEmails[threadEmails.length - 1].subject,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        case 'improve': {
          const draft = await improveDraft(
            input.currentDraft,
            input.tone,
            input.focusAreas
          );

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'improve',
                    draft: {
                      body: draft.body,
                      confidence: draft.confidence,
                      suggestions: draft.suggestions,
                    },
                    metadata: {
                      tone: input.tone,
                      focusAreas: input.focusAreas || ['clarity', 'conciseness', 'tone'],
                      originalLength: input.currentDraft.length,
                      improvedLength: draft.body.length,
                    },
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
              error: error instanceof Error ? error.message : 'Draft generation failed',
            }),
          },
        ],
      };
    }
  },
};
