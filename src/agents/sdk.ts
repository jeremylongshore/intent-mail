/**
 * Claude Agent SDK Integration
 *
 * Core integration with @anthropic-ai/claude-agent-sdk for IntentMail
 * Provides agent orchestration, tool definitions, and MCP server setup
 */

import { query, tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import type { Query } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getEmailConnector } from './email-connector.js';
import type { Email as ConnectorEmail } from './email-connector.js';
import { createProvider } from '../ai/provider.js';
import type { AIProvider, Email as ProviderEmail } from '../ai/provider.js';

// ============================================================
// Type Converters
// ============================================================

/**
 * Convert connector email to provider email format
 */
function toProviderEmail(email: ConnectorEmail): ProviderEmail {
  return {
    id: email.id,
    from: email.from.email,
    to: email.to[0]?.email ?? '',
    subject: email.subject,
    body: email.body,
    date: email.date.toISOString(),
    threadId: email.threadId,
  };
}

// ============================================================
// Shared State (initialized on first use)
// ============================================================

let aiProvider: AIProvider | null = null;

async function getAIProvider(): Promise<AIProvider> {
  if (!aiProvider) {
    aiProvider = await createProvider();
  }
  return aiProvider;
}

// ============================================================
// Email-Specific Tool Definitions
// ============================================================

/**
 * Search emails using semantic understanding
 */
export const searchEmailsTool = tool(
  'search_emails',
  'Search emails using natural language query. Returns matching emails with relevance scores.',
  {
    query: z.string().describe('Natural language search query'),
    limit: z.number().optional().default(10).describe('Maximum results to return'),
    folder: z.string().optional().describe('Folder to search (inbox, sent, drafts)'),
  },
  async (args) => {
    const connector = getEmailConnector();
    const provider = await getAIProvider();

    // First do keyword search via connector
    const searchResults = await connector.search({
      query: args.query,
      folder: args.folder,
      limit: args.limit,
    });

    // If we have results, use AI for semantic ranking
    if (searchResults.length > 0) {
      const emails = searchResults.map(r => toProviderEmail(r.email));

      // Use AI to re-rank results semantically
      const aiResults = await provider.search(args.query, emails);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              query: args.query,
              totalResults: aiResults.length,
              results: aiResults.map(r => ({
                id: r.email.id,
                from: r.email.from,
                subject: r.email.subject,
                snippet: r.snippet,
                score: r.score,
                date: r.email.date,
              })),
            }, null, 2),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            query: args.query,
            totalResults: 0,
            results: [],
            message: 'No emails found matching your query',
          }, null, 2),
        },
      ],
    };
  }
);

/**
 * Get email thread by ID
 */
export const getThreadTool = tool(
  'get_thread',
  'Retrieve a complete email thread with all messages',
  {
    threadId: z.string().describe('Thread ID to retrieve'),
    includeAttachments: z.boolean().optional().default(false),
  },
  async (args) => {
    const connector = getEmailConnector();
    const thread = await connector.getThread(args.threadId);

    if (!thread) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'Thread not found',
              threadId: args.threadId,
            }),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            threadId: thread.id,
            subject: thread.subject,
            participants: thread.participants,
            messageCount: thread.messages.length,
            lastMessageDate: thread.lastMessageDate.toISOString(),
            labels: thread.labels,
            messages: thread.messages.map(m => ({
              id: m.id,
              from: m.from,
              to: m.to,
              date: m.date.toISOString(),
              body: m.body,
              isRead: m.isRead,
              attachments: args.includeAttachments ? m.attachments : m.attachments.map(a => ({
                id: a.id,
                filename: a.filename,
                mimeType: a.mimeType,
                size: a.size,
              })),
            })),
          }, null, 2),
        },
      ],
    };
  }
);

/**
 * Draft an email with AI assistance
 */
export const draftEmailTool = tool(
  'draft_email',
  'Generate an email draft based on context and intent',
  {
    to: z.string().describe('Recipient email address'),
    subject: z.string().optional().describe('Email subject'),
    context: z.string().describe('Context for the email (what to write about)'),
    tone: z.enum(['formal', 'casual', 'friendly', 'professional']).optional().default('professional'),
    replyToThreadId: z.string().optional().describe('Thread ID if this is a reply'),
  },
  async (args) => {
    const connector = getEmailConnector();
    const provider = await getAIProvider();

    // If replying to a thread, get the context
    let threadContext = '';
    if (args.replyToThreadId) {
      const thread = await connector.getThread(args.replyToThreadId);
      if (thread) {
        threadContext = thread.messages
          .map(m => `From: ${m.from.email}\nSubject: ${m.subject}\n\n${m.body}`)
          .join('\n\n---\n\n');
      }
    }

    // Generate draft using AI provider
    const draft = await provider.generateDraft({
      to: args.to,
      subject: args.subject,
      context: args.context + (threadContext ? `\n\nPrevious conversation:\n${threadContext}` : ''),
      tone: args.tone,
    });

    // Save as draft in connector
    const draftId = await connector.createDraft({
      to: [{ email: args.to }],
      subject: args.subject ?? 'Re: ' + (args.replyToThreadId ? 'Previous conversation' : 'New message'),
      body: draft,
      threadId: args.replyToThreadId,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            draftId,
            to: args.to,
            subject: args.subject,
            body: draft,
            tone: args.tone,
            savedAsDraft: true,
          }, null, 2),
        },
      ],
    };
  }
);

/**
 * Apply label/category to emails
 */
export const applyLabelTool = tool(
  'apply_label',
  'Apply a label or category to one or more emails',
  {
    emailIds: z.array(z.string()).describe('Email IDs to label'),
    label: z.string().describe('Label to apply'),
    createIfMissing: z.boolean().optional().default(true),
  },
  async (args) => {
    const connector = getEmailConnector();

    // Create label if needed
    if (args.createIfMissing) {
      const existingLabels = await connector.getFolders();
      if (!existingLabels.includes(args.label)) {
        await connector.createLabel(args.label);
      }
    }

    // Apply label to emails
    await connector.applyLabel(args.emailIds, args.label);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            emailIds: args.emailIds,
            label: args.label,
            emailCount: args.emailIds.length,
          }, null, 2),
        },
      ],
    };
  }
);

/**
 * Summarize emails
 */
export const summarizeEmailsTool = tool(
  'summarize_emails',
  'Generate a summary of one or more emails',
  {
    emailIds: z.array(z.string()).describe('Email IDs to summarize'),
    style: z.enum(['brief', 'detailed', 'action-items']).optional().default('brief'),
  },
  async (args) => {
    const connector = getEmailConnector();
    const provider = await getAIProvider();

    // Fetch emails
    const emails: ProviderEmail[] = [];
    for (const id of args.emailIds) {
      const email = await connector.getEmail(id);
      if (email) {
        emails.push(toProviderEmail(email));
      }
    }

    if (emails.length === 0) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: 'No emails found with the provided IDs',
              emailIds: args.emailIds,
            }),
          },
        ],
      };
    }

    // Generate summary using AI
    const summary = await provider.summarize(emails);

    // For action-items style, add extraction prompt
    let finalSummary = summary;
    if (args.style === 'action-items') {
      finalSummary = `ACTION ITEMS:\n${summary}`;
    } else if (args.style === 'detailed') {
      finalSummary = `DETAILED SUMMARY:\n${summary}`;
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            emailCount: emails.length,
            style: args.style,
            summary: finalSummary,
            emailIds: args.emailIds,
          }, null, 2),
        },
      ],
    };
  }
);

/**
 * Send an email
 */
export const sendEmailTool = tool(
  'send_email',
  'Send an email immediately',
  {
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
    cc: z.array(z.string()).optional().describe('CC recipients'),
    replyToThreadId: z.string().optional().describe('Thread ID if this is a reply'),
  },
  async (args) => {
    const connector = getEmailConnector();

    const messageId = await connector.send({
      to: [{ email: args.to }],
      cc: args.cc?.map(email => ({ email })),
      subject: args.subject,
      body: args.body,
      threadId: args.replyToThreadId,
    });

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            messageId,
            to: args.to,
            subject: args.subject,
            sent: true,
          }, null, 2),
        },
      ],
    };
  }
);

/**
 * Get inbox summary
 */
export const inboxSummaryTool = tool(
  'inbox_summary',
  'Get a summary of the current inbox state',
  {
    limit: z.number().optional().default(20).describe('Number of recent emails to include'),
  },
  async (args) => {
    const connector = getEmailConnector();
    const provider = await getAIProvider();

    const emails = await connector.getEmails('inbox', args.limit);

    const unreadCount = emails.filter(e => !e.isRead).length;
    const starredCount = emails.filter(e => e.isStarred).length;

    // Convert to AI provider format
    const emailsForAI = emails.map(e => toProviderEmail(e));

    // Get AI summary of inbox
    const summary = await provider.summarize(emailsForAI);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            totalEmails: emails.length,
            unreadCount,
            starredCount,
            summary,
            recentEmails: emails.slice(0, 5).map(e => ({
              id: e.id,
              from: e.from.email,
              subject: e.subject,
              date: e.date.toISOString(),
              isRead: e.isRead,
              isStarred: e.isStarred,
            })),
          }, null, 2),
        },
      ],
    };
  }
);

// ============================================================
// MCP Server for Email Tools
// ============================================================

/**
 * Create the IntentMail MCP server with email tools
 */
export function createEmailMcpServer() {
  return createSdkMcpServer({
    name: 'intentmail-email-tools',
    version: '0.1.0',
    tools: [
      searchEmailsTool,
      getThreadTool,
      draftEmailTool,
      applyLabelTool,
      summarizeEmailsTool,
      sendEmailTool,
      inboxSummaryTool,
    ],
  });
}

// ============================================================
// Agent Definitions
// ============================================================

/**
 * Email Triage Agent - processes and categorizes incoming emails
 */
export const triageAgentDefinition = {
  description: 'Processes incoming emails, categorizes them, and identifies priority items requiring attention',
  tools: ['search_emails', 'apply_label', 'summarize_emails', 'inbox_summary'],
  prompt: `You are an email triage specialist. Your job is to:
1. Review incoming emails using inbox_summary
2. Categorize them by urgency and type (work, personal, newsletters, etc.)
3. Identify action items and deadlines
4. Flag priority items requiring immediate attention using apply_label
5. Provide a clear summary of what needs attention

Be concise and focus on actionable insights. Use apply_label to organize emails.`,
  model: 'haiku' as const,
};

/**
 * Draft Agent - composes email responses
 */
export const draftAgentDefinition = {
  description: 'Composes email drafts and responses based on context and user intent',
  tools: ['get_thread', 'draft_email', 'search_emails'],
  prompt: `You are an email drafting assistant. Your job is to:
1. Understand the context of the conversation using get_thread
2. Draft clear, professional responses using draft_email
3. Match the appropriate tone (formal/casual based on context)
4. Include all necessary information
5. Keep emails concise but complete

Ask for clarification if the user's intent is unclear. Always save drafts for review before sending.`,
  model: 'sonnet' as const,
};

/**
 * Search Agent - finds relevant emails and information
 */
export const searchAgentDefinition = {
  description: 'Searches emails using natural language queries and finds relevant information',
  tools: ['search_emails', 'get_thread', 'summarize_emails'],
  prompt: `You are an email search specialist. Your job is to:
1. Understand user search intent
2. Find relevant emails using search_emails
3. Get full threads when context is needed using get_thread
4. Summarize search results using summarize_emails
5. Suggest related searches if results are insufficient

Focus on finding exactly what the user needs. Provide context about found emails.`,
  model: 'haiku' as const,
};

/**
 * Send Agent - handles sending emails with confirmation
 */
export const sendAgentDefinition = {
  description: 'Handles sending emails with user confirmation and proper formatting',
  tools: ['send_email', 'draft_email', 'get_thread'],
  prompt: `You are an email sending assistant. Your job is to:
1. Help users compose and send emails
2. Always show the email content before sending
3. Confirm with the user before actually sending
4. Handle replies by getting thread context first
5. Ensure emails are properly formatted and professional

IMPORTANT: Always ask for confirmation before using send_email. Never send without explicit user approval.`,
  model: 'sonnet' as const,
};

// ============================================================
// Agent Runner
// ============================================================

export interface AgentOptions {
  prompt: string;
  cwd?: string;
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan';
  maxTurns?: number;
}

/**
 * Run an IntentMail agent query
 */
export async function runAgent(options: AgentOptions): Promise<Query> {
  const emailMcpServer = createEmailMcpServer();

  // Ensure email connector is connected
  const connector = getEmailConnector();
  if (!(await connector.isConnected())) {
    await connector.connect();
  }

  return query({
    prompt: options.prompt,
    options: {
      cwd: options.cwd ?? process.cwd(),
      permissionMode: options.permissionMode ?? 'default',
      maxTurns: options.maxTurns ?? 10,
      mcpServers: {
        'intentmail-email': emailMcpServer,
      },
      agents: {
        triage: triageAgentDefinition,
        draft: draftAgentDefinition,
        search: searchAgentDefinition,
        send: sendAgentDefinition,
      },
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `
You are IntentMail, an AI-powered email assistant. You have access to specialized agents:
- triage: For processing and categorizing emails (fast, uses haiku)
- draft: For composing email responses (thorough, uses sonnet)
- search: For finding relevant emails (fast, uses haiku)
- send: For sending emails with confirmation (thorough, uses sonnet)

You also have direct access to email tools:
- search_emails: Search with natural language
- get_thread: Get full email conversations
- draft_email: Create AI-assisted drafts
- apply_label: Organize with labels
- summarize_emails: Get quick summaries
- send_email: Send emails (requires confirmation)
- inbox_summary: Overview of inbox state

Use the appropriate agent or tool for each task. Be helpful, concise, and respect user privacy.
Always confirm before sending emails.
`,
      },
    },
  });
}

/**
 * Run agent and collect all messages
 */
export async function runAgentToCompletion(options: AgentOptions): Promise<{
  result: string;
  sessionId: string;
  usage: { input: number; output: number };
}> {
  const queryResult = await runAgent(options);

  let result = '';
  let sessionId = '';
  let inputTokens = 0;
  let outputTokens = 0;

  for await (const message of queryResult) {
    if (message.type === 'system' && message.subtype === 'init') {
      sessionId = message.session_id;
    }

    if (message.type === 'result' && message.subtype === 'success') {
      result = message.result;
      inputTokens = message.usage.input_tokens ?? 0;
      outputTokens = message.usage.output_tokens ?? 0;
    }
  }

  return {
    result,
    sessionId,
    usage: { input: inputTokens, output: outputTokens },
  };
}
