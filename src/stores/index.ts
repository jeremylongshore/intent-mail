/**
 * State Management Layer
 *
 * Zustand-based cross-platform state management for IntentMail.
 * Works with Terminal (Ink), Discord (Reacord), and Web (React DOM).
 *
 * E1.S1.3: State Management Bridge
 */

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
  const { useUIStore } = require('./ui-store.js');
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
  const { useEmailStore } = require('./email-store.js');
  const { useUIStore } = require('./ui-store.js');
  const { useAccountStore } = require('./account-store.js');

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
  const { useAccountStore } = require('./account-store.js');

  return useAccountStore.subscribe(
    (state: { syncInProgress: boolean; syncProgress: unknown }) => ({
      isSyncing: state.syncInProgress,
      progress: state.syncProgress,
    }),
    ({ isSyncing, progress }: { isSyncing: boolean; progress: unknown }) => {
      callback(isSyncing, progress);
    },
    { equalityFn: (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b) }
  );
}
