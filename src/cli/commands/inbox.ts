/**
 * Inbox Command
 *
 * Launches the IntentMail TUI using the appropriate platform adapter.
 * Supports terminal (default), with Discord and Web adapters coming soon.
 */

import { initEmailConnector } from '../../agents/email-connector.js';
import {
  initializeAdapters,
  detectBestTarget,
} from '../../adapters/index.js';

export async function runInboxCommand(): Promise<void> {
  // Initialize email connector
  const connector = await initEmailConnector();

  // Initialize adapters and detect best platform
  const registry = await initializeAdapters();
  const target = detectBestTarget();

  // Set active adapter
  registry.setActive(target);
  const adapter = registry.active();

  if (!adapter) {
    console.error('No suitable platform adapter found');
    process.exit(1);
  }

  // Initialize and render
  await adapter.initialize();
  adapter.render(connector);
}
