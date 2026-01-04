/**
 * UI Store
 *
 * Zustand store for UI state management.
 * Handles navigation, modals, notifications, and preferences.
 *
 * E1.S1.3: State Management Bridge
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  View,
  Notification,
  ModalState,
  DraftState,
  UserPreferences,
  Theme,
  KeyBinding,
} from './types.js';
import { useEmailStore } from './email-store.js';

/**
 * Default key bindings
 */
const defaultKeyBindings: KeyBinding[] = [
  { key: 'j', action: 'next', description: 'Next email' },
  { key: 'k', action: 'prev', description: 'Previous email' },
  { key: 'o', action: 'open', description: 'Open email' },
  { key: 'u', action: 'back', description: 'Go back' },
  { key: 'c', action: 'compose', description: 'Compose new' },
  { key: 'r', action: 'reply', description: 'Reply' },
  { key: 'a', action: 'replyAll', description: 'Reply all' },
  { key: 'f', action: 'forward', description: 'Forward' },
  { key: 's', action: 'star', description: 'Star/unstar' },
  { key: 'e', action: 'archive', description: 'Archive' },
  { key: '#', action: 'trash', description: 'Move to trash' },
  { key: '/', action: 'search', description: 'Search' },
  { key: 'x', action: 'select', description: 'Select email' },
  { key: '*', ctrl: true, action: 'selectAll', description: 'Select all' },
  { key: 'Escape', action: 'cancel', description: 'Cancel/close' },
  { key: 'Enter', action: 'confirm', description: 'Confirm' },
  { key: '?', action: 'help', description: 'Show shortcuts' },
  { key: 'q', action: 'quit', description: 'Quit' },
];

/**
 * Default user preferences
 */
const defaultPreferences: UserPreferences = {
  theme: 'system',
  pageSize: 50,
  compactView: false,
  showPreview: true,
  keyBindings: defaultKeyBindings,
  notifications: true,
  autoSync: true,
  syncInterval: 5,
};

/**
 * Empty draft
 */
const emptyDraft: DraftState = {
  to: [],
  cc: [],
  bcc: [],
  subject: '',
  body: '',
  attachments: [],
  isDirty: false,
};

/**
 * UI state
 */
interface UIState {
  // Navigation
  currentView: View;
  previousView: View | null;
  viewStack: View[];

  // Modals
  modal: ModalState;

  // Notifications
  notifications: Notification[];

  // Compose draft
  draft: DraftState;

  // Sidebar/panel state
  sidebarOpen: boolean;
  previewPanelOpen: boolean;

  // Command palette
  commandPaletteOpen: boolean;

  // Help modal
  helpOpen: boolean;

  // User preferences (persisted)
  preferences: UserPreferences;

  // Platform detection
  platform: 'terminal' | 'discord' | 'web' | 'unknown';

  // Focus management
  focusedElement: string | null;
}

/**
 * UI actions
 */
interface UIActions {
  // Navigation
  navigateTo: (view: View) => void;
  goBack: () => void;
  pushView: (view: View) => void;
  popView: () => void;

  // Modals
  openModal: (modal: Omit<ModalState, 'isOpen'>) => void;
  closeModal: () => void;
  confirmModal: () => void;

  // Notifications
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Compose
  setDraft: (draft: Partial<DraftState>) => void;
  clearDraft: () => void;
  saveDraft: () => void;
  startReply: (emailId: string, all?: boolean) => void;
  startForward: (emailId: string) => void;

  // Panel toggles
  toggleSidebar: () => void;
  togglePreviewPanel: () => void;
  setSidebarOpen: (open: boolean) => void;
  setPreviewPanelOpen: (open: boolean) => void;

  // Command palette
  toggleCommandPalette: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  // Help
  toggleHelp: () => void;

  // Preferences
  setPreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => void;
  setTheme: (theme: Theme) => void;
  resetPreferences: () => void;

  // Platform
  setPlatform: (platform: UIState['platform']) => void;

  // Focus
  setFocusedElement: (element: string | null) => void;

  // Reset
  reset: () => void;
}

/**
 * Initial UI state
 */
const initialState: UIState = {
  currentView: 'inbox',
  previousView: null,
  viewStack: ['inbox'],
  modal: { isOpen: false },
  notifications: [],
  draft: emptyDraft,
  sidebarOpen: true,
  previewPanelOpen: true,
  commandPaletteOpen: false,
  helpOpen: false,
  preferences: defaultPreferences,
  platform: 'unknown',
  focusedElement: null,
};

/**
 * Generate unique notification ID
 */
const generateId = () => `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/**
 * UI store with persistence for preferences
 */
export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Navigation
      navigateTo: (view) =>
        set((state) => ({
          currentView: view,
          previousView: state.currentView,
          viewStack: [...state.viewStack, view],
        })),

      goBack: () =>
        set((state) => {
          const newStack = state.viewStack.slice(0, -1);
          return {
            currentView: newStack[newStack.length - 1] || 'inbox',
            previousView: state.currentView,
            viewStack: newStack.length > 0 ? newStack : ['inbox'],
          };
        }),

      pushView: (view) =>
        set((state) => ({
          viewStack: [...state.viewStack, view],
          currentView: view,
          previousView: state.currentView,
        })),

      popView: () => {
        const state = get();
        if (state.viewStack.length <= 1) return;
        const newStack = state.viewStack.slice(0, -1);
        set({
          viewStack: newStack,
          currentView: newStack[newStack.length - 1] || 'inbox',
          previousView: state.currentView,
        });
      },

      // Modals
      openModal: (modal) =>
        set({
          modal: { ...modal, isOpen: true },
        }),

      closeModal: () =>
        set({
          modal: { isOpen: false },
        }),

      confirmModal: () => {
        const { modal } = get();
        if (modal.onConfirm) {
          modal.onConfirm();
        }
        set({ modal: { isOpen: false } });
      },

      // Notifications
      addNotification: (notification) => {
        const id = generateId();
        const fullNotification: Notification = {
          ...notification,
          id,
          dismissible: notification.dismissible ?? true,
        };

        set((state) => ({
          notifications: [...state.notifications, fullNotification],
        }));

        // Auto-dismiss after duration (default 5s)
        if (fullNotification.duration !== 0) {
          setTimeout(() => {
            get().removeNotification(id);
          }, fullNotification.duration ?? 5000);
        }
      },

      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),

      clearNotifications: () => set({ notifications: [] }),

      // Compose
      setDraft: (draft) =>
        set((state) => ({
          draft: { ...state.draft, ...draft, isDirty: true },
        })),

      clearDraft: () => set({ draft: emptyDraft }),

      saveDraft: () =>
        set((state) => ({
          draft: { ...state.draft, isDirty: false, lastSaved: new Date().toISOString() },
        })),

      startReply: (emailId, all = false) => {
        // Get email from email store
        const emailState = useEmailStore.getState();
        const email = emailState.emails.find(e => e.providerMessageId === emailId)
          || emailState.currentEmail;

        if (!email) {
          // Fallback to empty compose if email not found
          set({
            currentView: 'compose',
            draft: { ...emptyDraft, isDirty: false },
          });
          return;
        }

        // Build recipient list
        const fromAddress = typeof email.from === 'string'
          ? email.from
          : email.from.address;

        let toAddresses = [fromAddress];

        // For reply-all, include all original recipients (except self)
        if (all && email.to) {
          const additionalRecipients = email.to
            .map(t => typeof t === 'string' ? t : t.address)
            .filter(addr => addr !== fromAddress);
          toAddresses = [...toAddresses, ...additionalRecipients];
        }

        // Build subject with Re: prefix
        const subject = email.subject.startsWith('Re: ')
          ? email.subject
          : `Re: ${email.subject}`;

        set({
          currentView: 'compose',
          draft: {
            ...emptyDraft,
            to: toAddresses,
            cc: all && email.cc ? email.cc.map(c => typeof c === 'string' ? c : c.address) : [],
            subject,
            replyTo: email,
            isDirty: false,
          },
        });
      },

      startForward: (emailId) => {
        // Get email from email store
        const emailState = useEmailStore.getState();
        const email = emailState.emails.find(e => e.providerMessageId === emailId)
          || emailState.currentEmail;

        if (!email) {
          // Fallback to empty compose if email not found
          set({
            currentView: 'compose',
            draft: { ...emptyDraft, isDirty: false },
          });
          return;
        }

        // Build subject with Fwd: prefix
        const subject = email.subject.startsWith('Fwd: ')
          ? email.subject
          : `Fwd: ${email.subject}`;

        // Build forwarded message body
        const fromStr = typeof email.from === 'string'
          ? email.from
          : email.from.name
            ? `${email.from.name} <${email.from.address}>`
            : email.from.address;

        const forwardedBody = `
---------- Forwarded message ---------
From: ${fromStr}
Date: ${email.date}
Subject: ${email.subject}
To: ${email.to.map(t => typeof t === 'string' ? t : t.address).join(', ')}

${email.bodyText || email.snippet || ''}
`;

        set({
          currentView: 'compose',
          draft: {
            ...emptyDraft,
            subject,
            body: forwardedBody,
            isDirty: false,
          },
        });
      },

      // Panel toggles
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      togglePreviewPanel: () =>
        set((state) => ({ previewPanelOpen: !state.previewPanelOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setPreviewPanelOpen: (open) => set({ previewPanelOpen: open }),

      // Command palette
      toggleCommandPalette: () =>
        set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
      openCommandPalette: () => set({ commandPaletteOpen: true }),
      closeCommandPalette: () => set({ commandPaletteOpen: false }),

      // Help
      toggleHelp: () => set((state) => ({ helpOpen: !state.helpOpen })),

      // Preferences
      setPreference: (key, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        })),

      setTheme: (theme) =>
        set((state) => ({
          preferences: { ...state.preferences, theme },
        })),

      resetPreferences: () =>
        set({ preferences: defaultPreferences }),

      // Platform
      setPlatform: (platform) => set({ platform }),

      // Focus
      setFocusedElement: (element) => set({ focusedElement: element }),

      // Reset
      reset: () => set({ ...initialState, preferences: get().preferences }),
    }),
    {
      name: 'intentmail-ui',
      storage: createJSONStorage(() => {
        // In-memory storage for all environments (cross-platform)
        // LocalStorage will be used via platform-specific adapters if needed
        const memoryStorage: Record<string, string> = {};
        return {
          getItem: (name: string) => memoryStorage[name] || null,
          setItem: (name: string, value: string) => { memoryStorage[name] = value; },
          removeItem: (name: string) => { delete memoryStorage[name]; },
        };
      }),
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);

/**
 * Selector hooks
 */
export const useCurrentView = () => useUIStore((state) => state.currentView);
export const useModal = () => useUIStore((state) => state.modal);
export const useNotifications = () => useUIStore((state) => state.notifications);
export const useDraft = () => useUIStore((state) => state.draft);
export const usePreferences = () => useUIStore((state) => state.preferences);
export const useTheme = () => useUIStore((state) => state.preferences.theme);
export const usePlatform = () => useUIStore((state) => state.platform);
export const useKeyBindings = () => useUIStore((state) => state.preferences.keyBindings);

/**
 * Check if navigation can go back
 */
export const useCanGoBack = () => useUIStore((state) => state.viewStack.length > 1);
