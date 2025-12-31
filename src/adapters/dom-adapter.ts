/**
 * DOM (Web) Adapter
 *
 * Renders IntentMail to browser using React DOM.
 * This enables the Web Dashboard feature.
 *
 * E1.S1.1: Adapter Pattern Foundation
 * E4.S4.1-S4.5: Full implementation
 *
 * Dependencies:
 * - react ^18.0.0
 * - react-dom ^18.0.0
 * - vite (build tool)
 *
 * Note: This adapter is for browser environments only.
 * The web app is built separately using Vite (see vite.config.ts).
 */

import type { EmailConnector } from '../agents/email-connector.js';
import type {
  PlatformAdapter,
  PlatformCapabilities,
  NotificationProps,
} from './types.js';

// Type declarations for browser globals (avoids needing lib: dom)
declare const window: {
  focus: () => void;
  location: { origin: string };
} | undefined;
declare const document: {
  getElementById: (id: string) => unknown;
} | undefined;
declare const Notification: {
  permission: 'default' | 'granted' | 'denied';
  requestPermission: () => Promise<'default' | 'granted' | 'denied'>;
  new (title: string, options?: { body?: string; icon?: string; tag?: string }): {
    onclick: (() => void) | null;
  };
} | undefined;

/**
 * Web browser capabilities
 */
const WEB_CAPABILITIES: PlatformCapabilities = {
  keyboard: true,
  clickable: true,
  embeds: false,
  modals: true,
  realtime: true,
  maxLength: Infinity,
  attachments: true,
};

/**
 * React DOM-based web adapter
 *
 * Renders the IntentMail web dashboard to the browser.
 * Full implementation includes:
 * 1. Vite + React app scaffold (src/web/)
 * 2. OAuth flow for browser-based auth
 * 3. Responsive inbox/compose/search views
 * 4. PWA features (offline, push notifications)
 */
export class DomAdapter implements PlatformAdapter {
  readonly target = 'web' as const;
  readonly capabilities = WEB_CAPABILITIES;

  private root: { unmount: () => void; render: (element: unknown) => void } | null = null;

  async initialize(): Promise<void> {
    // Only runs in browser context
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('DOM adapter requires browser environment');
    }

    // Request notification permissions for PWA
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission();
    }

    console.log('[DomAdapter] Initialized in browser environment');
  }

  async destroy(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    console.log('[DomAdapter] Destroyed');
  }

  async render(_connector: EmailConnector): Promise<void> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      throw new Error('DOM adapter render requires browser environment');
    }

    // Web rendering is handled by Vite/React in src/web/
    // This method is a placeholder for the adapter interface
    // In production, the web app is served as a separate SPA

    console.log('[DomAdapter] Web rendering delegated to Vite build (src/web/)');
    console.log('[DomAdapter] Run "npm run dev:web" to start the web development server');
  }

  notify(props: NotificationProps): void {
    if (typeof window === 'undefined') return;

    // Use browser Notification API
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      const notification = new Notification(`New Email: ${props.email.subject}`, {
        body: `From: ${props.email.from.email}`,
        icon: '/icons/icon-192.png',
        tag: props.email.id,
      });

      notification.onclick = () => {
        window?.focus();
        props.onRead();
      };
    } else {
      console.log(`[Web Notification] ${props.email.subject}`);
    }
  }
}

/**
 * Factory function for creating web adapter
 */
export function createDomAdapter(): PlatformAdapter {
  return new DomAdapter();
}

/**
 * Check if web adapter can be used
 * (requires browser environment)
 */
export function isWebAvailable(): boolean {
  // Use globalThis for cross-platform compatibility
  return typeof globalThis !== 'undefined' &&
    'window' in globalThis &&
    'document' in globalThis;
}
