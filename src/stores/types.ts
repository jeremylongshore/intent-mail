/**
 * Store Types
 *
 * Shared type definitions for Zustand stores.
 * Platform-agnostic state management layer.
 *
 * E1.S1.3: State Management Bridge
 */

import type { Email } from '../types/email.js';
import type { EmailSummary } from '../ai/summarizer.js';

/**
 * View types for navigation
 */
export type View = 'inbox' | 'detail' | 'compose' | 'search' | 'settings';

/**
 * Loading states for async operations
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Notification severity levels
 */
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

/**
 * Notification type
 */
export interface Notification {
  id: string;
  message: string;
  severity: NotificationSeverity;
  duration?: number;
  dismissible?: boolean;
  action?: {
    label: string;
    handler: () => void;
  };
}

/**
 * Email with optional summary (cached)
 */
export interface EmailWithSummary extends Email {
  summary?: EmailSummary;
}

/**
 * Pagination state
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

/**
 * Sort options for email list
 */
export interface SortOptions {
  field: 'date' | 'from' | 'subject';
  direction: 'asc' | 'desc';
}

/**
 * Filter state
 */
export interface FilterState {
  unreadOnly: boolean;
  flaggedOnly: boolean;
  hasAttachments: boolean;
  labels: string[];
  dateRange?: {
    from: string;
    to: string;
  };
}

/**
 * Compose draft state
 */
export interface DraftState {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  replyTo?: Email;
  attachments: Array<{
    name: string;
    size: number;
    type: string;
  }>;
  isDirty: boolean;
  lastSaved?: string;
}

/**
 * Account connection state
 */
export interface AccountState {
  id: number;
  email: string;
  provider: 'gmail' | 'outlook' | 'imap';
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync?: string;
  error?: string;
}

/**
 * Modal state
 */
export interface ModalState {
  isOpen: boolean;
  type?: 'confirm' | 'alert' | 'prompt' | 'compose' | 'settings';
  title?: string;
  message?: string;
  data?: unknown;
  onConfirm?: () => void;
  onCancel?: () => void;
}

/**
 * Keyboard shortcut binding
 */
export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  action: string;
  description: string;
}

/**
 * Theme preference
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * User preferences (persisted)
 */
export interface UserPreferences {
  theme: Theme;
  pageSize: number;
  compactView: boolean;
  showPreview: boolean;
  keyBindings: KeyBinding[];
  notifications: boolean;
  autoSync: boolean;
  syncInterval: number; // minutes
}
