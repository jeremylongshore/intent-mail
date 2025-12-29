/**
 * DOM (Web) Adapter - STUB
 *
 * Renders IntentMail to browser using React DOM.
 * This enables the Web Dashboard feature.
 *
 * E1.S1.1: Adapter Pattern Foundation
 * E4.S4.1: Full implementation (pending)
 *
 * Dependencies:
 * - react-dom ^18.0.0
 * - vite (build tool)
 */

import type { EmailConnector } from '../agents/email-connector.js';
import type {
  PlatformAdapter,
  PlatformCapabilities,
  NotificationProps,
} from './types.js';

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
 * React DOM-based web adapter (STUB)
 *
 * Full implementation will:
 * 1. Create Vite + React app scaffold
 * 2. Implement OAuth flow for browser-based auth
 * 3. Render responsive inbox/compose/search views
 * 4. Support PWA features (offline, push notifications)
 */
export class DomAdapter implements PlatformAdapter {
  readonly target = 'web' as const;
  readonly capabilities = WEB_CAPABILITIES;

  // Web rendering state
  // private root: Root | null = null;

  async initialize(): Promise<void> {
    // STUB: Will initialize React DOM root
    // Only runs in browser context (not Node.js)
    //
    // if (typeof window === 'undefined') {
    //   throw new Error('DOM adapter requires browser environment');
    // }
    //
    // const { createRoot } = await import('react-dom/client');
    // const container = document.getElementById('root');
    // this.root = createRoot(container!);

    throw new Error(
      'Web adapter not yet implemented. See E4.S4.1 in beads.'
    );
  }

  async destroy(): Promise<void> {
    // STUB: Will unmount React root
    // this.root?.unmount();
    // this.root = null;
  }

  render(_connector: EmailConnector): void {
    // STUB: Will render React app to DOM
    // Example of what E4 will implement:
    //
    // this.root.render(
    //   <React.StrictMode>
    //     <WebApp connector={connector} />
    //   </React.StrictMode>
    // );

    throw new Error(
      'Web rendering not yet implemented. See E4.S4.3 in beads.'
    );
  }

  notify(props: NotificationProps): void {
    // STUB: Will use browser Notification API
    // Example:
    //
    // if ('Notification' in window && Notification.permission === 'granted') {
    //   new Notification(`New Email: ${props.email.subject}`, {
    //     body: `From: ${props.email.from.email}`,
    //     icon: '/icon.png',
    //   });
    // }

    console.log(`[Web Notification] Would notify about: ${props.email.subject}`);
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
