/**
 * Ink (Terminal) Adapter
 *
 * Renders IntentMail to the terminal using Ink (React for CLI).
 * This is the primary interface for `intentmail` CLI command.
 *
 * E1.S1.1: Adapter Pattern Foundation
 */

// Type declarations for Node.js globals (makes file self-contained)
declare const process: {
  stdout: { isTTY: boolean };
  exit: (code: number) => never;
};
declare const console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

import { render } from 'ink';
import React from 'react';
import type { EmailConnector } from '../agents/email-connector.js';
import type {
  PlatformAdapter,
  PlatformCapabilities,
  NotificationProps,
} from './types.js';

// Import existing TUI app
import { App } from '../cli/tui/App.js';

/**
 * Terminal capabilities
 */
const TERMINAL_CAPABILITIES: PlatformCapabilities = {
  keyboard: true,
  clickable: false,
  embeds: false,
  modals: false,
  realtime: true,
  maxLength: Infinity,
  attachments: false,
};

/**
 * Ink-based terminal adapter
 */
export class InkAdapter implements PlatformAdapter {
  readonly target = 'terminal' as const;
  readonly capabilities = TERMINAL_CAPABILITIES;

  private instance: ReturnType<typeof render> | null = null;

  async initialize(): Promise<void> {
    // Terminal doesn't need async initialization
    // Could check for TTY support here if needed
    if (!process.stdout.isTTY) {
      console.error('Warning: Terminal does not support TTY mode');
    }
  }

  async destroy(): Promise<void> {
    if (this.instance) {
      this.instance.unmount();
      this.instance = null;
    }
  }

  render(connector: EmailConnector): void {

    // Render the React app to terminal using Ink
    this.instance = render(
      React.createElement(App, { connector })
    );

    // Wait for app to exit
    this.instance.waitUntilExit().catch((err) => {
      console.error('App error:', err);
      process.exit(1);
    });
  }

  notify(props: NotificationProps): void {
    // Terminal notifications via console
    // In a full implementation, could use node-notifier
    console.log(`\n[New Email] ${props.email.subject}`);
    console.log(`From: ${props.email.from.email}`);
  }
}

/**
 * Factory function for creating terminal adapter
 */
export function createInkAdapter(): PlatformAdapter {
  return new InkAdapter();
}
