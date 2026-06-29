/**
 * State Management Layer
 *
 * Zustand-based cross-platform state management for IntentMail.
 * Works with Terminal (Ink), Discord (Reacord), and Web (React DOM).
 *
 * E1.S1.3: State Management Bridge
 */

// Direct store handles for the initialization/reset helpers below. These are
// statically imported (no circular dependency: the store modules never import
// back from this barrel) instead of lazy `require()` calls.
import { useEmailStore } from './email-store.js';
import { useUIStore } from './ui-store.js';
import { useAccountStore } from './account-store.js';

// Types
export * from './types.js';

// Email Store
export {
  useEmailStore,
  useEmails,
  useCurrentEmail,
  useSelectedIds,
  useEmailLoading,
  useEmailError,
  usePagination,
  useSearchResults,
  useUnreadCount,
  useSelectedEmails,
} from './email-store.js';

// UI Store
export {
  useUIStore,
  useCurrentView,
  useModal,
  useNotifications,
  useDraft,
  usePreferences,
  useTheme,
  usePlatform,
  useKeyBindings,
  useCanGoBack,
} from './ui-store.js';

// Account Store
export {
  useAccountStore,
  useAccounts,
  useActiveAccount,
  useConnector,
  useConnectorLoading,
  useSyncProgress,
  useIsSyncing,
  useLastSyncTime,
  useHasAccountError,
  useConnectedAccountsCount,
  type SyncProgress,
} from './account-store.js';

// Bridge Hooks
export {
  useInbox,
  useEmailDetail,
  useCompose,
  useSearch,
  useKeyboardNavigation,
  useSyncStatus,
  useNotificationManager,
} from './hooks.js';

/**
 * Store initialization helper
 *
 * Call this on app startup to initialize stores with platform-specific settings.
 */
export function initializeStores(options: {
  platform: 'terminal' | 'discord' | 'web';
  theme?: 'light' | 'dark' | 'system';
}) {
  const uiStore = useUIStore.getState();

  uiStore.setPlatform(options.platform);

  if (options.theme) {
    uiStore.setTheme(options.theme);
  }

  // Platform-specific defaults
  switch (options.platform) {
    case 'terminal':
      uiStore.setSidebarOpen(false);
      uiStore.setPreviewPanelOpen(false);
      break;
    case 'discord':
      uiStore.setSidebarOpen(false);
      uiStore.setPreviewPanelOpen(false);
      break;
    case 'web':
      uiStore.setSidebarOpen(true);
      uiStore.setPreviewPanelOpen(true);
      break;
  }
}

/**
 * Reset all stores
 *
 * Use when switching accounts or logging out.
 */
export function resetAllStores() {
  useEmailStore.getState().reset();
  useUIStore.getState().reset();
  useAccountStore.getState().resetConnector();
}

/**
 * Create a store subscriber for sync operations
 *
 * Returns an unsubscribe function.
 */
export function subscribeToSyncChanges(
  callback: (isSyncing: boolean, progress: unknown) => void
): () => void {
  // Base zustand `subscribe(listener)` fires on every state change with
  // (state, prevState). Select the sync slice ourselves and only invoke the
  // callback when it actually changes (the store has no subscribeWithSelector
  // middleware, so the 3-arg selector form is unavailable).
  const select = (state: { syncInProgress: boolean; syncProgress: unknown }) => ({
    isSyncing: state.syncInProgress,
    progress: state.syncProgress,
  });

  let prev = select(useAccountStore.getState());

  return useAccountStore.subscribe((state) => {
    const next = select(state);
    if (JSON.stringify(next) !== JSON.stringify(prev)) {
      prev = next;
      callback(next.isSyncing, next.progress);
    }
  });
}
