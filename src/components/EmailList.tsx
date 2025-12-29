/**
 * EmailList - Platform-agnostic email list component
 *
 * Transforms email data into render-ready format for any platform.
 * E1.S1.2: Shared Component Layer
 */

import type { EmailListProps } from '../adapters/types.js';

/**
 * Email render data for platforms to consume
 */
export interface EmailListItem {
  id: string;
  from: string;
  subject: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  snippet: string;
  labels: string[];
}

/**
 * Complete render data for email list view
 */
export interface EmailListRenderData {
  emails: EmailListItem[];
  selectedIndex: number;
  unreadCount: number;
  totalCount: number;
  loading: boolean;
  error: string | null;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && now.getDate() === date.getDate()) {
    // Today - show time
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diff < 7 * oneDay) {
    // This week - show day name
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else if (now.getFullYear() === date.getFullYear()) {
    // This year - show month/day
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    // Other years - show full date
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  }
}

/**
 * Get sender display name
 */
function getSenderName(from: { email: string; name?: string }): string {
  return from.name || from.email.split('@')[0];
}

/**
 * Transform email list props into render-ready data
 *
 * This hook is platform-agnostic - it contains only business logic
 * and data transformation. Platform adapters consume this data
 * and handle presentation.
 */
export function useEmailList(props: EmailListProps): EmailListRenderData {
  const { emails, selectedIndex, loading, error } = props;

  // Transform emails into render-ready items
  const emailItems: EmailListItem[] = emails.map((email) => ({
    id: email.id,
    from: getSenderName(email.from),
    subject: email.subject,
    date: formatDate(new Date(email.date)),
    isRead: email.isRead,
    isStarred: email.isStarred,
    snippet: email.snippet,
    labels: email.labels,
  }));

  // Calculate metrics
  const unreadCount = emails.filter((e) => !e.isRead).length;
  const totalCount = emails.length;

  return {
    emails: emailItems,
    selectedIndex,
    unreadCount,
    totalCount,
    loading,
    error,
  };
}

/**
 * Action handlers interface
 * Platforms implement these based on their event model
 */
export interface EmailListActions {
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onPageUp: () => void;
  onPageDown: () => void;
  onGoToTop: () => void;
  onGoToBottom: () => void;
  onSelectCurrent: () => void;
  onCompose: () => void;
  onSearch: () => void;
  onRefresh: () => void;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
}
