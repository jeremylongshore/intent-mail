/**
 * Email Store
 *
 * Zustand store for email data management.
 * Platform-agnostic - works with Ink, Reacord, and React DOM.
 *
 * E1.S1.3: State Management Bridge
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Email } from '../types/email.js';
import { EmailFlag } from '../types/email.js';
import type { EmailSummary } from '../ai/summarizer.js';
import type {
  EmailWithSummary,
  LoadingState,
  PaginationState,
  SortOptions,
  FilterState,
} from './types.js';

/**
 * Email store state
 */
interface EmailState {
  // Email list
  emails: EmailWithSummary[];
  selectedIds: Set<string>;
  focusedId: string | null;

  // Current email
  currentEmail: EmailWithSummary | null;
  currentThread: EmailWithSummary[];

  // Loading states
  listLoading: LoadingState;
  detailLoading: LoadingState;
  actionLoading: LoadingState;

  // Pagination
  pagination: PaginationState;

  // Sort and filter
  sort: SortOptions;
  filters: FilterState;

  // Search
  searchQuery: string;
  searchResults: EmailWithSummary[];
  searchLoading: LoadingState;

  // Error state
  error: string | null;

  // Summary cache
  summaryCache: Map<string, EmailSummary>;
}

/**
 * Email store actions
 */
interface EmailActions {
  // List operations
  setEmails: (emails: Email[]) => void;
  appendEmails: (emails: Email[]) => void;
  updateEmail: (id: string, updates: Partial<Email>) => void;
  removeEmails: (ids: string[]) => void;

  // Selection
  selectEmail: (id: string) => void;
  deselectEmail: (id: string) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  setFocused: (id: string | null) => void;

  // Current email
  setCurrentEmail: (email: Email | null) => void;
  setCurrentThread: (emails: Email[]) => void;

  // Loading states
  setListLoading: (state: LoadingState) => void;
  setDetailLoading: (state: LoadingState) => void;
  setActionLoading: (state: LoadingState) => void;

  // Pagination
  setPagination: (pagination: Partial<PaginationState>) => void;
  nextPage: () => void;
  prevPage: () => void;
  goToPage: (page: number) => void;

  // Sort and filter
  setSort: (sort: SortOptions) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;

  // Search
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: Email[]) => void;
  setSearchLoading: (state: LoadingState) => void;
  clearSearch: () => void;

  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;

  // Summary cache
  cacheSummary: (emailId: string, summary: EmailSummary) => void;
  getSummary: (emailId: string) => EmailSummary | undefined;
  clearSummaryCache: () => void;

  // Bulk operations
  markAsRead: (ids: string[]) => void;
  markAsUnread: (ids: string[]) => void;
  toggleFlag: (ids: string[]) => void;
  archive: (ids: string[]) => void;
  trash: (ids: string[]) => void;

  // Reset
  reset: () => void;
}

/**
 * Default filter state
 */
const defaultFilters: FilterState = {
  unreadOnly: false,
  flaggedOnly: false,
  hasAttachments: false,
  labels: [],
};

/**
 * Default pagination state
 */
const defaultPagination: PaginationState = {
  page: 1,
  pageSize: 50,
  total: 0,
  hasMore: false,
};

/**
 * Initial state
 */
const initialState: EmailState = {
  emails: [],
  selectedIds: new Set(),
  focusedId: null,
  currentEmail: null,
  currentThread: [],
  listLoading: 'idle',
  detailLoading: 'idle',
  actionLoading: 'idle',
  pagination: defaultPagination,
  sort: { field: 'date', direction: 'desc' },
  filters: defaultFilters,
  searchQuery: '',
  searchResults: [],
  searchLoading: 'idle',
  error: null,
  summaryCache: new Map(),
};

/**
 * Email store
 */
export const useEmailStore = create<EmailState & EmailActions>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // List operations
    setEmails: (emails) =>
      set({
        emails: emails.map((e) => ({
          ...e,
          summary: get().summaryCache.get(e.providerMessageId),
        })),
        listLoading: 'success',
        error: null,
      }),

    appendEmails: (emails) =>
      set((state) => ({
        emails: [
          ...state.emails,
          ...emails.map((e) => ({
            ...e,
            summary: state.summaryCache.get(e.providerMessageId),
          })),
        ],
      })),

    updateEmail: (id, updates) =>
      set((state) => ({
        emails: state.emails.map((e) =>
          e.providerMessageId === id ? { ...e, ...updates } : e
        ),
        currentEmail:
          state.currentEmail?.providerMessageId === id
            ? { ...state.currentEmail, ...updates }
            : state.currentEmail,
      })),

    removeEmails: (ids) =>
      set((state) => ({
        emails: state.emails.filter((e) => !ids.includes(e.providerMessageId)),
        selectedIds: new Set(
          [...state.selectedIds].filter((id) => !ids.includes(id))
        ),
      })),

    // Selection
    selectEmail: (id) =>
      set((state) => ({
        selectedIds: new Set([...state.selectedIds, id]),
      })),

    deselectEmail: (id) =>
      set((state) => {
        const newIds = new Set(state.selectedIds);
        newIds.delete(id);
        return { selectedIds: newIds };
      }),

    toggleSelection: (id) =>
      set((state) => {
        const newIds = new Set(state.selectedIds);
        if (newIds.has(id)) {
          newIds.delete(id);
        } else {
          newIds.add(id);
        }
        return { selectedIds: newIds };
      }),

    selectAll: () =>
      set((state) => ({
        selectedIds: new Set(state.emails.map((e) => e.providerMessageId)),
      })),

    deselectAll: () => set({ selectedIds: new Set() }),

    setFocused: (id) => set({ focusedId: id }),

    // Current email
    setCurrentEmail: (email) =>
      set({
        currentEmail: email
          ? {
              ...email,
              summary: get().summaryCache.get(email.providerMessageId),
            }
          : null,
        detailLoading: email ? 'success' : 'idle',
      }),

    setCurrentThread: (emails) =>
      set({
        currentThread: emails.map((e) => ({
          ...e,
          summary: get().summaryCache.get(e.providerMessageId),
        })),
      }),

    // Loading states
    setListLoading: (state) => set({ listLoading: state }),
    setDetailLoading: (state) => set({ detailLoading: state }),
    setActionLoading: (state) => set({ actionLoading: state }),

    // Pagination
    setPagination: (pagination) =>
      set((state) => ({
        pagination: { ...state.pagination, ...pagination },
      })),

    nextPage: () =>
      set((state) => ({
        pagination: {
          ...state.pagination,
          page: state.pagination.page + 1,
        },
      })),

    prevPage: () =>
      set((state) => ({
        pagination: {
          ...state.pagination,
          page: Math.max(1, state.pagination.page - 1),
        },
      })),

    goToPage: (page) =>
      set((state) => ({
        pagination: { ...state.pagination, page },
      })),

    // Sort and filter
    setSort: (sort) => set({ sort }),

    setFilters: (filters) =>
      set((state) => ({
        filters: { ...state.filters, ...filters },
        pagination: { ...state.pagination, page: 1 }, // Reset to first page
      })),

    resetFilters: () =>
      set({
        filters: defaultFilters,
        pagination: { ...defaultPagination },
      }),

    // Search
    setSearchQuery: (query) => set({ searchQuery: query }),

    setSearchResults: (results) =>
      set({
        searchResults: results.map((e) => ({
          ...e,
          summary: get().summaryCache.get(e.providerMessageId),
        })),
        searchLoading: 'success',
      }),

    setSearchLoading: (state) => set({ searchLoading: state }),

    clearSearch: () =>
      set({
        searchQuery: '',
        searchResults: [],
        searchLoading: 'idle',
      }),

    // Error handling
    setError: (error) => set({ error, listLoading: 'error' }),
    clearError: () => set({ error: null }),

    // Summary cache
    cacheSummary: (emailId, summary) =>
      set((state) => {
        const newCache = new Map(state.summaryCache);
        newCache.set(emailId, summary);

        // Update emails with new summary
        return {
          summaryCache: newCache,
          emails: state.emails.map((e) =>
            e.providerMessageId === emailId ? { ...e, summary } : e
          ),
          currentEmail:
            state.currentEmail?.providerMessageId === emailId
              ? { ...state.currentEmail, summary }
              : state.currentEmail,
        };
      }),

    getSummary: (emailId) => get().summaryCache.get(emailId),

    clearSummaryCache: () =>
      set({
        summaryCache: new Map(),
        emails: get().emails.map((e) => ({ ...e, summary: undefined })),
      }),

    // Bulk operations (update local state - actual API calls handled by connector)
    markAsRead: (ids) =>
      set((state) => ({
        emails: state.emails.map((e) =>
          ids.includes(e.providerMessageId)
            ? { ...e, flags: [...e.flags.filter((f) => f !== EmailFlag.SEEN), EmailFlag.SEEN] }
            : e
        ),
      })),

    markAsUnread: (ids) =>
      set((state) => ({
        emails: state.emails.map((e) =>
          ids.includes(e.providerMessageId)
            ? { ...e, flags: e.flags.filter((f) => f !== EmailFlag.SEEN) }
            : e
        ),
      })),

    toggleFlag: (ids) =>
      set((state) => ({
        emails: state.emails.map((e) => {
          if (!ids.includes(e.providerMessageId)) return e;
          const hasFlag = e.flags.includes(EmailFlag.FLAGGED);
          return {
            ...e,
            flags: hasFlag
              ? e.flags.filter((f) => f !== EmailFlag.FLAGGED)
              : [...e.flags, EmailFlag.FLAGGED],
          };
        }),
      })),

    archive: (ids) =>
      set((state) => ({
        emails: state.emails.filter((e) => !ids.includes(e.providerMessageId)),
        selectedIds: new Set(
          [...state.selectedIds].filter((id) => !ids.includes(id))
        ),
      })),

    trash: (ids) =>
      set((state) => ({
        emails: state.emails.filter((e) => !ids.includes(e.providerMessageId)),
        selectedIds: new Set(
          [...state.selectedIds].filter((id) => !ids.includes(id))
        ),
      })),

    // Reset
    reset: () => set({ ...initialState, summaryCache: new Map() }),
  }))
);

/**
 * Selector hooks for common patterns
 */
export const useEmails = () => useEmailStore((state) => state.emails);
export const useCurrentEmail = () => useEmailStore((state) => state.currentEmail);
export const useSelectedIds = () => useEmailStore((state) => state.selectedIds);
export const useEmailLoading = () => useEmailStore((state) => state.listLoading);
export const useEmailError = () => useEmailStore((state) => state.error);
export const usePagination = () => useEmailStore((state) => state.pagination);
export const useSearchResults = () => useEmailStore((state) => state.searchResults);

/**
 * Get unread count
 */
export const useUnreadCount = () =>
  useEmailStore((state) =>
    state.emails.filter((e) => !e.flags.includes(EmailFlag.SEEN)).length
  );

/**
 * Get selected emails
 */
export const useSelectedEmails = () =>
  useEmailStore((state) =>
    state.emails.filter((e) => state.selectedIds.has(e.providerMessageId))
  );
