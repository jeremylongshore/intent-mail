/**
 * Discord Adapter
 *
 * Renders IntentMail to Discord using discord.js.
 * This enables the Discord UI (DUI) feature.
 *
 * E1.S1.1: Adapter Pattern Foundation
 * E2.S2.1-S2.7: Full Discord Integration
 */

// Type declarations for Node.js globals
declare const console: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

import type { EmailConnector } from '../agents/email-connector.js';
import type {
  PlatformAdapter,
  PlatformCapabilities,
  NotificationProps,
} from './types.js';
import {
  initializeDiscord,
  isDiscordConfigured,
  type DiscordIntegration,
} from '../discord/index.js';

/**
 * Discord capabilities
 */
const DISCORD_CAPABILITIES: PlatformCapabilities = {
  keyboard: false,
  clickable: true,
  embeds: true,
  modals: true,
  realtime: true,
  maxLength: 2000,
  attachments: true,
};

/**
 * Discord adapter using discord.js
 */
export class ReacordAdapter implements PlatformAdapter {
  readonly target = 'discord' as const;
  readonly capabilities = DISCORD_CAPABILITIES;

  private integration: DiscordIntegration | null = null;

  async initialize(): Promise<void> {
    if (!isDiscordConfigured()) {
      throw new Error(
        'Discord not configured. Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID environment variables.'
      );
    }
    console.log('[DiscordAdapter] Initialized - waiting for email connector');
  }

  async destroy(): Promise<void> {
    if (this.integration) {
      await this.integration.shutdown();
      this.integration = null;
    }
  }

  async render(connector: EmailConnector): Promise<void> {
    this.integration = await initializeDiscord(connector);
    console.log('[DiscordAdapter] Discord bot is running and listening for commands');
  }

  async notify(props: NotificationProps): Promise<void> {
    if (!this.integration) {
      console.warn('[DiscordAdapter] Cannot notify - integration not initialized');
      return;
    }

    const userId = (props as { userId?: string }).userId;
    if (!userId) {
      console.log(`[DiscordAdapter] No user ID for notification: ${props.email.subject}`);
      return;
    }

    await this.integration.notificationManager.notify(userId, {
      id: props.email.id,
      from: props.email.from,
      subject: props.email.subject,
      snippet: props.email.snippet || '',
      date: props.email.date,
      accountEmail: (props as { accountEmail?: string }).accountEmail || '',
      priority: (props as { priority?: 'high' | 'normal' | 'low' }).priority,
    });
  }

  getNotificationManager() {
    return this.integration?.notificationManager ?? null;
  }

  isReady(): boolean {
    return this.integration?.bot.isReady ?? false;
  }
}

/**
 * Factory function for creating Discord adapter
 */
export function createReacordAdapter(): PlatformAdapter {
  return new ReacordAdapter();
}

/**
 * Check if Discord adapter can be used
 */
export function isDiscordAvailable(): boolean {
  return isDiscordConfigured();
}
