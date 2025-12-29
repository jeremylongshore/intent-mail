/**
 * Account Store
 *
 * Zustand store for account and connector state management.
 * Handles email provider connections and sync state.
 *
 * E1.S1.3: State Management Bridge
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AccountState, LoadingState } from './types.js';
import type { EmailConnector } from '../agents/email-connector.js';

/**
 * Sync progress info
 */
export interface SyncProgress {
  current: number;
  total: number;
  phase: 'connecting' | 'fetching' | 'processing' | 'complete';
  message?: string;
}

/**
 * Account store state
 */
interface AccountStoreState {
  // Accounts list
  accounts: AccountState[];
  activeAccountId: number | null;

  // Connector (not persisted)
  connector: EmailConnector | null;
  connectorLoading: LoadingState;
  connectorError: string | null;

  // Sync state
  syncInProgress: boolean;
  syncProgress: SyncProgress | null;
  lastSyncTime: string | null;
  autoSyncEnabled: boolean;
  syncInterval: number; // in minutes
}

/**
 * Account store actions
 */
interface AccountActions {
  // Account management
  addAccount: (account: Omit<AccountState, 'status'>) => void;
  removeAccount: (id: number) => void;
  updateAccount: (id: number, updates: Partial<AccountState>) => void;
  setActiveAccount: (id: number | null) => void;

  // Connector management
  setConnector: (connector: EmailConnector | null) => void;
  setConnectorLoading: (state: LoadingState) => void;
  setConnectorError: (error: string | null) => void;

  // Sync operations
  startSync: () => void;
  updateSyncProgress: (progress: SyncProgress) => void;
  completeSync: () => void;
  failSync: (error: string) => void;
  setAutoSync: (enabled: boolean) => void;
  setSyncInterval: (minutes: number) => void;

  // Account status
  setAccountConnected: (id: number) => void;
  setAccountDisconnected: (id: number) => void;
  setAccountError: (id: number, error: string) => void;
  setAccountSyncing: (id: number) => void;

  // Reset
  reset: () => void;
  resetConnector: () => void;
}

/**
 * Initial state
 */
const initialState: AccountStoreState = {
  accounts: [],
  activeAccountId: null,
  connector: null,
  connectorLoading: 'idle',
  connectorError: null,
  syncInProgress: false,
  syncProgress: null,
  lastSyncTime: null,
  autoSyncEnabled: true,
  syncInterval: 5,
};

/**
 * Account store with persistence
 */
export const useAccountStore = create<AccountStoreState & AccountActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Account management
      addAccount: (account) =>
        set((state) => ({
          accounts: [
            ...state.accounts,
            { ...account, status: 'disconnected' as const },
          ],
        })),

      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((a) => a.id !== id),
          activeAccountId:
            state.activeAccountId === id ? null : state.activeAccountId,
        })),

      updateAccount: (id, updates) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          ),
        })),

      setActiveAccount: (id) =>
        set({
          activeAccountId: id,
          connector: null, // Reset connector when switching accounts
          connectorLoading: 'idle',
          connectorError: null,
        }),

      // Connector management
      setConnector: (connector) =>
        set({
          connector,
          connectorLoading: connector ? 'success' : 'idle',
          connectorError: null,
        }),

      setConnectorLoading: (state) => set({ connectorLoading: state }),

      setConnectorError: (error) =>
        set({
          connectorError: error,
          connectorLoading: 'error',
          connector: null,
        }),

      // Sync operations
      startSync: () => {
        const activeId = get().activeAccountId;
        if (activeId) {
          set((state) => ({
            syncInProgress: true,
            syncProgress: {
              current: 0,
              total: 0,
              phase: 'connecting',
              message: 'Starting sync...',
            },
            accounts: state.accounts.map((a) =>
              a.id === activeId ? { ...a, status: 'syncing' as const } : a
            ),
          }));
        }
      },

      updateSyncProgress: (progress) =>
        set({
          syncProgress: progress,
        }),

      completeSync: () => {
        const activeId = get().activeAccountId;
        const now = new Date().toISOString();
        set((state) => ({
          syncInProgress: false,
          syncProgress: null,
          lastSyncTime: now,
          accounts: state.accounts.map((a) =>
            a.id === activeId
              ? { ...a, status: 'connected' as const, lastSync: now, error: undefined }
              : a
          ),
        }));
      },

      failSync: (error) => {
        const activeId = get().activeAccountId;
        set((state) => ({
          syncInProgress: false,
          syncProgress: null,
          accounts: state.accounts.map((a) =>
            a.id === activeId
              ? { ...a, status: 'error' as const, error }
              : a
          ),
        }));
      },

      setAutoSync: (enabled) => set({ autoSyncEnabled: enabled }),

      setSyncInterval: (minutes) => set({ syncInterval: minutes }),

      // Account status
      setAccountConnected: (id) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === id
              ? { ...a, status: 'connected' as const, error: undefined }
              : a
          ),
        })),

      setAccountDisconnected: (id) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === id ? { ...a, status: 'disconnected' as const } : a
          ),
        })),

      setAccountError: (id, error) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === id ? { ...a, status: 'error' as const, error } : a
          ),
        })),

      setAccountSyncing: (id) =>
        set((state) => ({
          accounts: state.accounts.map((a) =>
            a.id === id ? { ...a, status: 'syncing' as const } : a
          ),
        })),

      // Reset
      reset: () => set(initialState),

      resetConnector: () =>
        set({
          connector: null,
          connectorLoading: 'idle',
          connectorError: null,
        }),
    }),
    {
      name: 'intentmail-accounts',
      storage: createJSONStorage(() => {
        // In-memory storage for all environments (cross-platform)
        const memoryStorage: Record<string, string> = {};
        return {
          getItem: (name: string) => memoryStorage[name] || null,
          setItem: (name: string, value: string) => { memoryStorage[name] = value; },
          removeItem: (name: string) => { delete memoryStorage[name]; },
        };
      }),
      partialize: (state) => ({
        accounts: state.accounts,
        activeAccountId: state.activeAccountId,
        autoSyncEnabled: state.autoSyncEnabled,
        syncInterval: state.syncInterval,
        lastSyncTime: state.lastSyncTime,
      }),
    }
  )
);

/**
 * Selector hooks
 */
export const useAccounts = () => useAccountStore((state) => state.accounts);
export const useActiveAccount = () =>
  useAccountStore((state) =>
    state.accounts.find((a) => a.id === state.activeAccountId) || null
  );
export const useConnector = () => useAccountStore((state) => state.connector);
export const useConnectorLoading = () =>
  useAccountStore((state) => state.connectorLoading);
export const useSyncProgress = () =>
  useAccountStore((state) => state.syncProgress);
export const useIsSyncing = () =>
  useAccountStore((state) => state.syncInProgress);
export const useLastSyncTime = () =>
  useAccountStore((state) => state.lastSyncTime);

/**
 * Check if any account is in error state
 */
export const useHasAccountError = () =>
  useAccountStore((state) =>
    state.accounts.some((a) => a.status === 'error')
  );

/**
 * Get connected accounts count
 */
export const useConnectedAccountsCount = () =>
  useAccountStore((state) =>
    state.accounts.filter((a) => a.status === 'connected').length
  );
