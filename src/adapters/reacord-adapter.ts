/**
 * Reacord (Discord) Adapter - STUB
 *
 * Renders IntentMail to Discord using Reacord (React for Discord).
 * This enables the Discord UI (DUI) feature.
 *
 * E1.S1.1: Adapter Pattern Foundation
 * E2.S2.2: Full implementation (pending)
 *
 * Dependencies:
 * - discord.js ^14.0.0
 * - reacord ^0.6.0
 */

import type { EmailConnector } from '../agents/email-connector.js';
import type {
  PlatformAdapter,
  PlatformCapabilities,
  NotificationProps,
} from './types.js';

/**
 * Discord capabilities
 */
const DISCORD_CAPABILITIES: PlatformCapabilities = {
  keyboard: false,
  clickable: true,
  embeds: true,
  modals: true,
  realtime: true,
  maxLength: 2000, // Discord message limit
  attachments: true,
};

/**
 * Reacord-based Discord adapter (STUB)
 *
 * Full implementation will:
 * 1. Initialize discord.js client with bot token
 * 2. Create Reacord instance for JSX rendering
 * 3. Register slash commands (/inbox, /read, /compose, /search)
 * 4. Render React components as Discord embeds/buttons
 */
export class ReacordAdapter implements PlatformAdapter {
  readonly target = 'discord' as const;
  readonly capabilities = DISCORD_CAPABILITIES;

  // These will be real in E2.S2.2
  // private client: Client | null = null;
  // private reacord: Reacord | null = null;

  async initialize(): Promise<void> {
    // STUB: Will initialize Discord client and Reacord
    // const { Client, GatewayIntentBits } = await import('discord.js');
    // const { Reacord } = await import('reacord');
    //
    // this.client = new Client({
    //   intents: [
    //     GatewayIntentBits.Guilds,
    //     GatewayIntentBits.GuildMessages,
    //     GatewayIntentBits.DirectMessages,
    //   ],
    // });
    //
    // await this.client.login(process.env.DISCORD_BOT_TOKEN);
    // this.reacord = new Reacord({ client: this.client });

    throw new Error(
      'Discord adapter not yet implemented. See E2.S2.1 and E2.S2.2 in beads.'
    );
  }

  async destroy(): Promise<void> {
    // STUB: Will cleanup Discord client
    // this.reacord?.destroy();
    // await this.client?.destroy();
  }

  render(_connector: EmailConnector): void {
    // STUB: Will render slash commands using Reacord
    // Example of what E2 will implement:
    //
    // this.reacord.createInteractionReply(interaction, {
    //   content: <InboxEmbed emails={emails} onSelect={handleSelect} />
    // });

    throw new Error(
      'Discord rendering not yet implemented. See E2.S2.3 in beads.'
    );
  }

  notify(props: NotificationProps): void {
    // STUB: Will send DM notification
    // Example:
    //
    // const dmChannel = await user.createDM();
    // this.reacord.send(dmChannel, {
    //   content: <EmailNotification email={props.email} />
    // });

    console.log(`[Discord Notification] Would notify about: ${props.email.subject}`);
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
 * (requires bot token and dependencies)
 */
export function isDiscordAvailable(): boolean {
  return !!(
    process.env.DISCORD_BOT_TOKEN &&
    // Would also check for reacord/discord.js packages
    false // Disabled until E2 implementation
  );
}
