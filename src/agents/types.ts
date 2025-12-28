/**
 * Agent Types and Interfaces
 *
 * Core type definitions for the Agentic OS, following A2A protocol v0.3.0
 * @see A2A_PROTOCOL_RESEARCH.md for full specification
 */

// ============================================================
// Agent Definition Types
// ============================================================

/**
 * Skill definition - a discrete capability an agent can perform
 */
export interface Skill {
  /** Unique identifier for the skill */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the skill does */
  description: string;
  /** Searchable tags */
  tags: string[];
  /** Example prompts that invoke this skill */
  examples: string[];
  /** Accepted input MIME types */
  inputModes: string[];
  /** Output MIME types this skill produces */
  outputModes: string[];
}

/**
 * Agent capabilities
 */
export interface AgentCapabilities {
  /** Supports streaming responses */
  streaming: boolean;
  /** Supports push notifications */
  pushNotifications: boolean;
  /** Maintains state transition history */
  stateTransitionHistory: boolean;
}

/**
 * AgentCard - metadata describing an agent's capabilities
 * Serves as the discovery mechanism for A2A protocol
 */
export interface AgentCard {
  /** Agent name */
  name: string;
  /** Agent description */
  description: string;
  /** Semantic version */
  version: string;
  /** Base URL for A2A communication (optional for local agents) */
  url?: string;
  /** Agent capabilities */
  capabilities: AgentCapabilities;
  /** Default accepted input MIME types */
  defaultInputModes: string[];
  /** Default output MIME types */
  defaultOutputModes: string[];
  /** Skills this agent provides */
  skills: Skill[];
  /** Supports extended card with auth */
  supportsAuthenticatedExtendedCard?: boolean;
}

/**
 * Base agent interface - all agents must implement this
 */
export interface Agent {
  /** Unique agent identifier */
  id: string;
  /** Agent metadata */
  card: AgentCard;
  /** Execute a task */
  execute(task: Task): Promise<TaskResult>;
  /** Check if agent can handle a skill */
  canHandle(skillId: string): boolean;
  /** Get agent health status */
  isHealthy(): Promise<boolean>;
}

// ============================================================
// Message Types (A2A Protocol)
// ============================================================

/**
 * Text content part
 */
export interface TextPart {
  type: 'text';
  mimeType: 'text/plain';
  text: string;
}

/**
 * JSON data part
 */
export interface DataPart {
  type: 'data';
  mimeType: 'application/json';
  data: Record<string, unknown>;
}

/**
 * File/binary content part
 */
export interface FilePart {
  type: 'file';
  mimeType: string;
  name: string;
  /** Base64 encoded content or URL */
  content: string;
  /** If true, content is a URL to fetch */
  isUrl?: boolean;
}

/**
 * Union type for message parts
 */
export type MessagePart = TextPart | DataPart | FilePart;

/**
 * Message input for agent execution
 */
export interface MessageInput {
  /** Content parts */
  parts: MessagePart[];
  /** Target skill ID (optional) */
  skillId?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Message from agent to agent or user
 */
export interface Message {
  /** Message ID */
  id: string;
  /** Sender agent ID (or 'user') */
  from: string;
  /** Recipient agent ID (or 'user') */
  to: string;
  /** Message content */
  input: MessageInput;
  /** Timestamp */
  timestamp: string;
  /** Reference to previous message in conversation */
  replyTo?: string;
}

// ============================================================
// Task Types (A2A Protocol)
// ============================================================

/**
 * Task states following A2A protocol
 */
export enum TaskState {
  /** Task submitted, not yet started */
  SUBMITTED = 'submitted',
  /** Task is being processed */
  WORKING = 'working',
  /** Task requires additional input */
  INPUT_REQUIRED = 'input_required',
  /** Task requires authentication */
  AUTH_REQUIRED = 'auth_required',
  /** Task completed successfully */
  COMPLETED = 'completed',
  /** Task failed with error */
  FAILED = 'failed',
  /** Task was rejected by agent */
  REJECTED = 'rejected',
  /** Task was cancelled */
  CANCELLED = 'cancelled',
}

/**
 * Terminal states - no further transitions possible
 */
export const TERMINAL_STATES: TaskState[] = [
  TaskState.COMPLETED,
  TaskState.FAILED,
  TaskState.REJECTED,
  TaskState.CANCELLED,
];

/**
 * Task status with state and metadata
 */
export interface TaskStatus {
  /** Current state */
  state: TaskState;
  /** Status message */
  message?: string;
  /** Timestamp of state change */
  timestamp: string;
  /** Progress percentage (0-100) */
  progress?: number;
}

/**
 * Artifact - output produced by agent
 */
export interface Artifact {
  /** Artifact ID */
  artifactId: string;
  /** Human-readable name */
  name: string;
  /** Content parts */
  parts: MessagePart[];
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task - unit of work for an agent
 */
export interface Task {
  /** Task ID */
  id: string;
  /** Context/session ID for conversation continuity */
  contextId: string;
  /** Target agent ID */
  agentId: string;
  /** Target skill ID (optional) */
  skillId?: string;
  /** Input message */
  input: MessageInput;
  /** Current status */
  status: TaskStatus;
  /** Output artifacts */
  artifacts: Artifact[];
  /** Task creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Parent task ID for subtasks */
  parentTaskId?: string;
  /** Error details if failed */
  error?: TaskError;
}

/**
 * Task error details
 */
export interface TaskError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Stack trace (development only) */
  stack?: string;
  /** Recoverable flag */
  recoverable: boolean;
}

/**
 * Task result returned after execution
 */
export interface TaskResult {
  /** Final status */
  status: TaskStatus;
  /** Output artifacts */
  artifacts: Artifact[];
  /** Error if failed */
  error?: TaskError;
}

// ============================================================
// Session/Memory Types
// ============================================================

/**
 * Session state - short-term working memory
 */
export interface SessionState {
  /** Key-value storage */
  data: Record<string, unknown>;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Agent session - maintains context across interactions
 */
export interface AgentSession {
  /** Session ID (same as contextId) */
  id: string;
  /** Agent ID this session belongs to */
  agentId: string;
  /** User/caller ID */
  userId?: string;
  /** Session state */
  state: SessionState;
  /** Conversation history (message IDs) */
  messageHistory: string[];
  /** Creation timestamp */
  createdAt: string;
  /** Expiration timestamp */
  expiresAt?: string;
}

/**
 * Long-term memory entry
 */
export interface MemoryEntry {
  /** Memory ID */
  id: string;
  /** Agent ID */
  agentId: string;
  /** Memory type (fact, preference, etc.) */
  type: string;
  /** Memory key for lookup */
  key: string;
  /** Memory value */
  value: unknown;
  /** Confidence score (0-1) */
  confidence: number;
  /** Source (user, inference, etc.) */
  source: string;
  /** Creation timestamp */
  createdAt: string;
  /** Last access timestamp */
  accessedAt: string;
}

// ============================================================
// Event Types (Message Bus)
// ============================================================

/**
 * Event types for the message bus
 */
export enum EventType {
  // Task lifecycle events
  TASK_SUBMITTED = 'task.submitted',
  TASK_STARTED = 'task.started',
  TASK_PROGRESS = 'task.progress',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  TASK_CANCELLED = 'task.cancelled',

  // Agent events
  AGENT_REGISTERED = 'agent.registered',
  AGENT_UNREGISTERED = 'agent.unregistered',
  AGENT_HEALTH_CHANGED = 'agent.health_changed',

  // Message events
  MESSAGE_SENT = 'message.sent',
  MESSAGE_RECEIVED = 'message.received',

  // Session events
  SESSION_CREATED = 'session.created',
  SESSION_UPDATED = 'session.updated',
  SESSION_EXPIRED = 'session.expired',
}

/**
 * Event payload base
 */
export interface EventPayload {
  /** Event ID */
  eventId: string;
  /** Event type */
  type: EventType;
  /** Timestamp */
  timestamp: string;
  /** Source agent/component */
  source: string;
  /** Event-specific data */
  data: Record<string, unknown>;
}

/**
 * Event handler function
 */
export type EventHandler = (event: EventPayload) => void | Promise<void>;

/**
 * Event subscription
 */
export interface EventSubscription {
  /** Subscription ID */
  id: string;
  /** Event type pattern (supports wildcards) */
  pattern: string;
  /** Handler function */
  handler: EventHandler;
  /** Subscriber ID */
  subscriberId: string;
}

// ============================================================
// Registry Types
// ============================================================

/**
 * Agent registration entry
 */
export interface AgentRegistration {
  /** Agent instance */
  agent: Agent;
  /** Registration timestamp */
  registeredAt: string;
  /** Health status */
  healthy: boolean;
  /** Last health check */
  lastHealthCheck: string;
  /** Skill index for fast lookup */
  skillIndex: Map<string, Skill>;
}

// ============================================================
// Router Types
// ============================================================

/**
 * Routing decision
 */
export interface RoutingDecision {
  /** Selected agent ID */
  agentId: string;
  /** Selected skill ID */
  skillId: string;
  /** Confidence in decision (0-1) */
  confidence: number;
  /** Reason for selection */
  reason: string;
  /** Alternative agents if primary fails */
  fallbacks: string[];
}

/**
 * Routing strategy
 */
export enum RoutingStrategy {
  /** Route by skill match */
  SKILL_MATCH = 'skill_match',
  /** Route by explicit agent ID */
  DIRECT = 'direct',
  /** Round-robin load balancing */
  ROUND_ROBIN = 'round_robin',
  /** Route to least loaded agent */
  LEAST_LOADED = 'least_loaded',
}
