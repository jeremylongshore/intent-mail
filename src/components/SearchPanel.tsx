/**
 * SearchPanel - Platform-agnostic search interface
 *
 * Search state management and result formatting.
 * E1.S1.2: Shared Component Layer
 */

import type { SearchProps } from '../adapters/types.js';

/**
 * Search result item for rendering
 */
export interface SearchResultItem {
  id: string;
  from: string;
  subject: string;
  date: string;
  score: number;
  scorePercent: number;
  snippet: string;
  matchedFields: string[];
  isRead: boolean;
  isStarred: boolean;
}

/**
 * Complete render data for search view
 */
export interface SearchPanelRenderData {
  query: string;
  results: SearchResultItem[];
  selectedIndex: number;
  searching: boolean;
  hasSearched: boolean;
  hasResults: boolean;
  resultCount: number;
}

/**
 * Get sender display name
 */
function getSenderName(from: { email: string; name?: string }): string {
  return from.name || from.email.split('@')[0];
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const oneDay = 24 * 60 * 60 * 1000;

  if (diff < oneDay && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } else if (diff < 7 * oneDay) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else if (now.getFullYear() === date.getFullYear()) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  }
}

/**
 * Transform search props into render-ready data
 *
 * Platform-agnostic search logic and result formatting.
 */
export function useSearchPanel(props: SearchProps): SearchPanelRenderData {
  const { query, results, selectedIndex, searching } = props;

  // Track if user has performed a search
  const hasSearched = query.trim().length > 0 && !searching;

  // Format results into render-ready items
  // Note: SearchProps provides Email[] directly, not EmailSearchResult[]
  // For now we use a default score since the interface doesn't include it
  const resultItems: SearchResultItem[] = results.map((email) => ({
    id: email.id,
    from: getSenderName(email.from),
    subject: email.subject,
    date: formatDate(new Date(email.date)),
    score: 5.0, // Default score since not provided in Email type
    scorePercent: 100, // Default to 100% since actual score not available
    snippet: email.snippet,
    matchedFields: [], // Not available in Email type
    isRead: email.isRead,
    isStarred: email.isStarred,
  }));

  return {
    query,
    results: resultItems,
    selectedIndex,
    searching,
    hasSearched,
    hasResults: resultItems.length > 0,
    resultCount: resultItems.length,
  };
}

/**
 * Action handlers interface
 */
export interface SearchPanelActions {
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  onSelectResult: (index: number) => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onBack: () => void;
  onFocusInput: () => void;
}

/**
 * Search query validation
 */
export function validateSearchQuery(query: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = query.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Query cannot be empty' };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: 'Query must be at least 2 characters' };
  }

  if (trimmed.length > 500) {
    return { valid: false, error: 'Query is too long (max 500 characters)' };
  }

  return { valid: true };
}
