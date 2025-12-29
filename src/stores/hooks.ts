/**
 * Store Hooks
 *
 * Bridge hooks connecting Zustand stores to components.
 * These provide integrated state and actions for common UI patterns.
 *
 * E1.S1.3: State Management Bridge
 */

import { useCallback, useEffect } from 'react';
import { useEmailStore } from './email-store.js';
import { useUIStore } from './ui-store.js';
import { useAccountStore } from './account-store.js';
import type { Email } from '../types/email.js';

/**
 * Hook for inbox view with integrated state
 */
export function useInbox() {
  const emails = useEmailStore((s) => s.emails);
  const loading = useEmailStore((s) => s.listLoading);
  const error = useEmailStore((s) => s.error);
  const pagination = useEmailStore((s) => s.pagination);
  const selectedIds = useEmailStore((s) => s.selectedIds);
  const focusedId = useEmailStore((s) => s.focusedId);
  const filters = useEmailStore((s) => s.filters);
  const sort = useEmailStore((s) => s.sort);

  const actions = useEmailStore((s) => ({
    setFocused: s.setFocused,
    selectEmail: s.selectEmail,
    deselectEmail: s.deselectEmail,
    toggleSelection: s.toggleSelection,
    selectAll: s.selectAll,
    deselectAll: s.deselectAll,
    setSort: s.setSort,
    setFilters: s.setFilters,
    nextPage: s.nextPage,
    prevPage: s.prevPage,
    markAsRead: s.markAsRead,
    markAsUnread: s.markAsUnread,
    toggleFlag: s.toggleFlag,
    archive: s.archive,
    trash: s.trash,
  }));

  const navigateTo = useUIStore((s) => s.navigateTo);

  const openEmail = useCallback(
    (email: Email) => {
      useEmailStore.getState().setCurrentEmail(email);
      navigateTo('detail');
    },
    [navigateTo]
  );

  const compose = useCallback(() => {
    useUIStore.getState().clearDraft();
    navigateTo('compose');
  }, [navigateTo]);

  const search = useCallback(() => {
    navigateTo('search');
  }, [navigateTo]);

  return {
    // State
    emails,
    loading,
    error,
    pagination,
    selectedIds,
    focusedId,
    filters,
    sort,

    // Actions
    ...actions,
    openEmail,
    compose,
    search,
  };
}

/**
 * Hook for email detail view with integrated state
 */
export function useEmailDetail() {
  const email = useEmailStore((s) => s.currentEmail);
  const thread = useEmailStore((s) => s.currentThread);
  const loading = useEmailStore((s) => s.detailLoading);

  const goBack = useUIStore((s) => s.goBack);
  const navigateTo = useUIStore((s) => s.navigateTo);

  const reply = useCallback(() => {
    if (email) {
      useUIStore.getState().setDraft({
        to: [email.from.address],
        subject: `Re: ${email.subject}`,
        replyTo: email,
      });
      navigateTo('compose');
    }
  }, [email, navigateTo]);

  const replyAll = useCallback(() => {
    if (email) {
      const allRecipients = [
        email.from.address,
        ...email.to.map((t) => t.address),
        ...(email.cc?.map((c) => c.address) || []),
      ];
      // Remove duplicates
      const uniqueRecipients = [...new Set(allRecipients)];

      useUIStore.getState().setDraft({
        to: uniqueRecipients,
        subject: `Re: ${email.subject}`,
        replyTo: email,
      });
      navigateTo('compose');
    }
  }, [email, navigateTo]);

  const forward = useCallback(() => {
    if (email) {
      useUIStore.getState().setDraft({
        to: [],
        subject: `Fwd: ${email.subject}`,
        body: `\n\n---------- Forwarded message ----------\nFrom: ${email.from.name || email.from.address}\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.bodyText || ''}`,
      });
      navigateTo('compose');
    }
  }, [email, navigateTo]);

  const markAsRead = useCallback(() => {
    if (email) {
      useEmailStore.getState().markAsRead([email.providerMessageId]);
    }
  }, [email]);

  const markAsUnread = useCallback(() => {
    if (email) {
      useEmailStore.getState().markAsUnread([email.providerMessageId]);
    }
  }, [email]);

  const toggleFlag = useCallback(() => {
    if (email) {
      useEmailStore.getState().toggleFlag([email.providerMessageId]);
    }
  }, [email]);

  const archive = useCallback(() => {
    if (email) {
      useEmailStore.getState().archive([email.providerMessageId]);
      goBack();
    }
  }, [email, goBack]);

  const trash = useCallback(() => {
    if (email) {
      useEmailStore.getState().trash([email.providerMessageId]);
      goBack();
    }
  }, [email, goBack]);

  return {
    email,
    thread,
    loading,
    goBack,
    reply,
    replyAll,
    forward,
    markAsRead,
    markAsUnread,
    toggleFlag,
    archive,
    trash,
  };
}

/**
 * Hook for compose view with integrated state
 */
export function useCompose() {
  const draft = useUIStore((s) => s.draft);
  const setDraft = useUIStore((s) => s.setDraft);
  const clearDraft = useUIStore((s) => s.clearDraft);
  const saveDraft = useUIStore((s) => s.saveDraft);
  const goBack = useUIStore((s) => s.goBack);

  const connector = useAccountStore((s) => s.connector);
  const actionLoading = useEmailStore((s) => s.actionLoading);

  const updateField = useCallback(
    (field: keyof typeof draft, value: unknown) => {
      setDraft({ [field]: value });
    },
    [setDraft]
  );

  const send = useCallback(async () => {
    if (!connector) {
      useUIStore.getState().addNotification({
        message: 'No email connector available',
        severity: 'error',
      });
      return false;
    }

    useEmailStore.getState().setActionLoading('loading');

    try {
      await connector.send({
        to: draft.to.map((email) => ({ email })),
        cc: draft.cc.map((email) => ({ email })),
        bcc: draft.bcc.map((email) => ({ email })),
        subject: draft.subject,
        body: draft.body,
      });

      useEmailStore.getState().setActionLoading('success');
      clearDraft();
      goBack();

      useUIStore.getState().addNotification({
        message: 'Email sent successfully',
        severity: 'success',
      });

      return true;
    } catch (error) {
      useEmailStore.getState().setActionLoading('error');
      useUIStore.getState().addNotification({
        message: error instanceof Error ? error.message : 'Failed to send email',
        severity: 'error',
      });
      return false;
    }
  }, [connector, draft, clearDraft, goBack]);

  const discard = useCallback(() => {
    if (draft.isDirty) {
      useUIStore.getState().openModal({
        type: 'confirm',
        title: 'Discard draft?',
        message: 'You have unsaved changes. Are you sure you want to discard this draft?',
        onConfirm: () => {
          clearDraft();
          goBack();
        },
      });
    } else {
      clearDraft();
      goBack();
    }
  }, [draft.isDirty, clearDraft, goBack]);

  return {
    draft,
    loading: actionLoading,
    updateField,
    setDraft,
    saveDraft,
    send,
    discard,
    goBack,
  };
}

/**
 * Hook for search view with integrated state
 */
export function useSearch() {
  const query = useEmailStore((s) => s.searchQuery);
  const results = useEmailStore((s) => s.searchResults);
  const loading = useEmailStore((s) => s.searchLoading);

  const setQuery = useEmailStore((s) => s.setSearchQuery);
  const setResults = useEmailStore((s) => s.setSearchResults);
  const setLoading = useEmailStore((s) => s.setSearchLoading);
  const clearSearch = useEmailStore((s) => s.clearSearch);

  const goBack = useUIStore((s) => s.goBack);
  const navigateTo = useUIStore((s) => s.navigateTo);

  const connector = useAccountStore((s) => s.connector);

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!connector) {
        return;
      }

      setQuery(searchQuery);
      setLoading('loading');

      try {
        const results = await connector.search({ query: searchQuery });
        // Extract emails from search results
        setResults(results.map((r) => r.email as unknown as Email));
      } catch (error) {
        useUIStore.getState().addNotification({
          message: error instanceof Error ? error.message : 'Search failed',
          severity: 'error',
        });
        setLoading('error');
      }
    },
    [connector, setQuery, setLoading, setResults]
  );

  const openResult = useCallback(
    (email: Email) => {
      useEmailStore.getState().setCurrentEmail(email);
      navigateTo('detail');
    },
    [navigateTo]
  );

  return {
    query,
    results,
    loading,
    search: performSearch,
    setQuery,
    clearSearch,
    openResult,
    goBack,
  };
}

/**
 * Hook for keyboard navigation
 */
export function useKeyboardNavigation() {
  const keyBindings = useUIStore((s) => s.preferences.keyBindings);
  const currentView = useUIStore((s) => s.currentView);

  const handleKeyPress = useCallback(
    (key: string, modifiers: { ctrl?: boolean; alt?: boolean; shift?: boolean } = {}) => {
      const binding = keyBindings.find(
        (b) =>
          b.key.toLowerCase() === key.toLowerCase() &&
          !!b.ctrl === !!modifiers.ctrl &&
          !!b.alt === !!modifiers.alt &&
          !!b.shift === !!modifiers.shift
      );

      if (!binding) return null;

      return binding.action;
    },
    [keyBindings]
  );

  return {
    handleKeyPress,
    currentView,
  };
}

/**
 * Hook for sync status with auto-sync
 */
export function useSyncStatus() {
  const isSyncing = useAccountStore((s) => s.syncInProgress);
  const progress = useAccountStore((s) => s.syncProgress);
  const lastSync = useAccountStore((s) => s.lastSyncTime);
  const autoSyncEnabled = useAccountStore((s) => s.autoSyncEnabled);
  const syncInterval = useAccountStore((s) => s.syncInterval);
  const connector = useAccountStore((s) => s.connector);

  const startSync = useAccountStore((s) => s.startSync);
  const completeSync = useAccountStore((s) => s.completeSync);
  const failSync = useAccountStore((s) => s.failSync);

  const sync = useCallback(async () => {
    if (!connector || isSyncing) return;

    startSync();

    try {
      // Refresh emails from connector
      const emails = await connector.getEmails('inbox');
      useEmailStore.getState().setEmails(emails as unknown as Email[]);
      completeSync();

      useUIStore.getState().addNotification({
        message: 'Sync completed',
        severity: 'success',
        duration: 3000,
      });
    } catch (error) {
      failSync(error instanceof Error ? error.message : 'Sync failed');

      useUIStore.getState().addNotification({
        message: error instanceof Error ? error.message : 'Sync failed',
        severity: 'error',
      });
    }
  }, [connector, isSyncing, startSync, completeSync, failSync]);

  // Auto-sync effect
  useEffect(() => {
    if (!autoSyncEnabled || !connector) return;

    const intervalMs = syncInterval * 60 * 1000;
    const timer = setInterval(() => {
      sync();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoSyncEnabled, syncInterval, connector, sync]);

  return {
    isSyncing,
    progress,
    lastSync,
    autoSyncEnabled,
    sync,
  };
}

/**
 * Hook for notifications
 */
export function useNotificationManager() {
  const notifications = useUIStore((s) => s.notifications);
  const addNotification = useUIStore((s) => s.addNotification);
  const removeNotification = useUIStore((s) => s.removeNotification);
  const clearNotifications = useUIStore((s) => s.clearNotifications);

  const notify = useCallback(
    (
      message: string,
      severity: 'info' | 'success' | 'warning' | 'error' = 'info',
      options?: { duration?: number; action?: { label: string; handler: () => void } }
    ) => {
      addNotification({
        message,
        severity,
        duration: options?.duration,
        action: options?.action,
      });
    },
    [addNotification]
  );

  return {
    notifications,
    notify,
    dismiss: removeNotification,
    clearAll: clearNotifications,
  };
}
