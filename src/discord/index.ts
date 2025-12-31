/**
 * Discord Integration Module
 *
 * Main entry point for Discord bot functionality.
 * Enables IntentMail to work as a Discord bot with slash commands.
 *
 * E2: Discord Integration (DUI)
 */

import { Events, type ChatInputCommandInteraction } from 'discord.js';
import {
  initializeBot,
  registerCommands,
  shutdownBot,
  getBotConfigFromEnv,
  type DiscordBot,
  type BotConfig,
} from './bot.js';
import { commandDefinitions, commandHandlers, isValidCommand } from './commands/index.js';
import { createNotificationManager, type NotificationManager } from './notifications.js';
import type { EmailConnector } from '../agents/email-connector.js';

export interface DiscordIntegration {
  bot: DiscordBot;
  notificationManager: NotificationManager;
  shutdown: () => Promise<void>;
}

/**
 * Initialize the complete Discord integration
 */
export async function initializeDiscord(
  emailConnector: EmailConnector,
  config?: BotConfig
): Promise<DiscordIntegration> {
  const botConfig = config ?? getBotConfigFromEnv();
  if (!botConfig) {
    throw new Error(
      'Discord bot configuration missing. Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID environment variables.'
    );
  }

  console.log('[Discord] Initializing bot...');

  // Initialize bot
  const bot = await initializeBot(botConfig);

  // Create notification manager
  const notificationManager = createNotificationManager(bot.client);

  // Register slash commands
  await registerCommands(bot, commandDefinitions);

  // Set up interaction handler
  bot.client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const commandName = interaction.commandName;

    if (!isValidCommand(commandName)) {
      console.warn(`[Discord] Unknown command: ${commandName}`);
      await interaction.reply({
        content: 'Unknown command.',
        ephemeral: true,
      });
      return;
    }

    try {
      const handler = commandHandlers[commandName];
      await handler(
        interaction as ChatInputCommandInteraction,
        emailConnector
      );
    } catch (error) {
      console.error(`[Discord] Error handling command ${commandName}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({
          content: `❌ Error: ${errorMessage}`,
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: `❌ Error: ${errorMessage}`,
          ephemeral: true,
        });
      }
    }
  });

  console.log('[Discord] Bot ready!');

  return {
    bot,
    notificationManager,
    shutdown: async () => {
      await shutdownBot(bot);
    },
  };
}

/**
 * Check if Discord integration is available
 */
export function isDiscordConfigured(): boolean {
  return getBotConfigFromEnv() !== null;
}

// Re-export types and utilities
export type { DiscordBot, BotConfig } from './bot.js';
export type { NotificationManager, EmailNotification, NotificationPreferences } from './notifications.js';
export { commandDefinitions, commandHandlers } from './commands/index.js';
