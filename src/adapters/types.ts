/**
 * Multi-Surface Adapter Types
 *
 * Platform-agnostic interfaces enabling IntentMail to render
 * to Terminal (Ink), Discord (Reacord), and Web (React DOM).
 *
 * E1.S1.1: Adapter Pattern Foundation
 */

import type { Email, EmailConnector } from '../agents/email-connector.js';

// Thread type (may be added in email-connector later)
export interface Thread {
  id: string;
  subject: string;
  messages: Email[];
  participants: { email: string; name?: string }[];
  lastMessageDate: Date;
  labels: string[];
  isRead: boolean;
}

// ============================================================
// Core Render Target Types
// ============================================================

export type RenderTarget = 'terminal' | 'discord' | 'web';

/**
 * Platform-specific rendering capabilities
 */
export interface PlatformCapabilities {
  /** Supports keyboard input (terminal only) */
  keyboard: boolean;
  /** Supports mouse/click interactions */
  clickable: boolean;
  /** Supports rich embeds (Discord) */
  embeds: boolean;
  /** Supports modals/dialogs */
  modals: boolean;
  /** Supports real-time updates */
  realtime: boolean;
  /** Max characters per message/view */
  maxLength: number;
  /** Supports file attachments inline */
  attachments: boolean;
}

// ============================================================
// Component Props (Platform-Agnostic)
// ============================================================

export interface EmailListProps {
  emails: Email[];
  selectedIndex: number;
  onSelect: (email: Email, index: number) => void;
  onCompose: () => void;
  onSearch: () => void;
  onRefresh: () => void;
  loading: boolean;
  error: string | null;
}

export interface EmailDetailProps {
  email: Email;
  onBack: () => void;
  onReply: () => void;
  onStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
  scrollOffset: number;
  onScroll: (offset: number) => void;
}

export interface ComposeProps {
  to: string;
  subject: string;
  body: string;
  replyTo?: Email;
  onToChange: (value: string) => void;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  sending: boolean;
  error: string | null;
}

export interface SearchProps {
  query: string;
  results: Email[];
  selectedIndex: number;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onSelect: (email: Email) => void;
  onBack: () => void;
  searching: boolean;
}

export interface NotificationProps {
  email: Email;
  onRead: () => void;
  onDismiss: () => void;
}

// ============================================================
// Adapter Interface
// ============================================================

/**
 * Platform adapter contract
 *
 * Each platform implements this interface to provide:
 * 1. Component rendering for that platform
 * 2. Platform-specific capabilities
 * 3. Lifecycle management (mount/unmount)
 */
export interface PlatformAdapter {
  /** Unique identifier for this platform */
  readonly target: RenderTarget;

  /** Platform capabilities */
  readonly capabilities: PlatformCapabilities;

  /**
   * Initialize the adapter
   * Called once at startup
   */
  initialize(): Promise<void>;

  /**
   * Cleanup and shutdown
   */
  destroy(): Promise<void>;

  /**
   * Render the main application
   * @param connector Email connector for data operations
   */
  render(connector: EmailConnector): void;

  /**
   * Show a notification (if supported)
   */
  notify?(props: NotificationProps): void;
}

// ============================================================
// Adapter Registry
// ============================================================

/**
 * Registry for managing platform adapters
 */
export interface AdapterRegistry {
  /** Register an adapter */
  register(adapter: PlatformAdapter): void;

  /** Get adapter by target */
  get(target: RenderTarget): PlatformAdapter | undefined;

  /** Get all registered adapters */
  all(): PlatformAdapter[];

  /** Get the currently active adapter */
  active(): PlatformAdapter | undefined;

  /** Set the active adapter */
  setActive(target: RenderTarget): void;
}

// ============================================================
// Event Types (Cross-Platform)
// ============================================================

export type AppEvent =
  | { type: 'navigate'; view: 'inbox' | 'detail' | 'compose' | 'search' }
  | { type: 'select-email'; email: Email }
  | { type: 'compose'; replyTo?: Email }
  | { type: 'search'; query: string }
  | { type: 'refresh' }
  | { type: 'error'; message: string }
  | { type: 'notification'; email: Email };

export type EventHandler = (event: AppEvent) => void;

// ============================================================
// Shared State Types
// ============================================================

export interface AppState {
  view: 'inbox' | 'detail' | 'compose' | 'search';
  selectedEmail: Email | null;
  selectedThread: Thread | null;
  replyTo: Email | null;
  searchQuery: string;
  searchResults: Email[];
  loading: boolean;
  error: string | null;
}

export type StateSubscriber = (state: AppState) => void;

/**
 * Cross-platform state manager
 */
export interface StateManager {
  getState(): AppState;
  setState(partial: Partial<AppState>): void;
  subscribe(subscriber: StateSubscriber): () => void;
  dispatch(event: AppEvent): void;
}
