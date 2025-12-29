/**
 * Agentic OS Core
 *
 * Claude Agent SDK-based multi-agent orchestration system
 * Claude Code acts as the orchestrator, user-configured AI provider (Gemini/Groq/etc) handles operations
 * @see https://platform.claude.com/docs/en/agent-sdk/typescript
 */

// Claude Agent SDK integration
export {
  // MCP Server & Tools
  createEmailMcpServer,
  searchEmailsTool,
  getThreadTool,
  draftEmailTool,
  applyLabelTool,
  summarizeEmailsTool,
  sendEmailTool,
  inboxSummaryTool,

  // Agent Definitions
  triageAgentDefinition,
  draftAgentDefinition,
  searchAgentDefinition,
  sendAgentDefinition,

  // Agent Runner
  runAgent,
  runAgentToCompletion,
  type AgentOptions,
} from './sdk.js';

// Email Connector (for Gmail/Outlook/IMAP integration)
export {
  type EmailConnector,
  type Email,
  type EmailThread,
  type EmailDraft,
  type EmailAddress,
  type EmailAttachment,
  type EmailSearchOptions,
  type EmailSearchResult,
  MockEmailConnector,
  getEmailConnector,
  setEmailConnector,
  initEmailConnector,
} from './email-connector.js';

// Gmail Connector
export { GmailEmailConnector, createGmailConnector } from './gmail-connector.js';

// IMAP Connector (simpler, uses app password)
export { ImapEmailConnector, createImapConnector } from './imap-connector.js';

// Legacy A2A types (for compatibility)
export {
  // Agent definitions
  type Skill,
  type AgentCapabilities,
  type AgentCard,
  type Agent,

  // Message types
  type TextPart,
  type DataPart,
  type FilePart,
  type MessagePart,
  type MessageInput,
  type Message,

  // Task types
  TaskState,
  TERMINAL_STATES,
  type TaskStatus,
  type Artifact,
  type Task,
  type TaskError,
  type TaskResult,

  // Session/Memory types
  type SessionState,
  type AgentSession,
  type MemoryEntry,

  // Event types
  EventType,
  type EventPayload,
  type EventHandler,
  type EventSubscription,

  // Registry types
  type AgentRegistration,

  // Router types
  type RoutingDecision,
  RoutingStrategy,
} from './types.js';
