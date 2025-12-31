/**
 * Discord Bot Foundation
 *
 * Sets up the discord.js client with proper intents and event handling.
 *
 * E2.S2.1: Discord Bot Foundation
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  REST,
  Routes,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string; // Optional: for development (faster command registration)
}

export interface DiscordBot {
  client: Client;
  rest: REST;
  config: BotConfig;
  isReady: boolean;
}

/**
 * Create and configure the Discord client
 */
export function createDiscordClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [
      Partials.Channel, // Required for DM support
      Partials.Message,
    ],
  });
}

/**
 * Initialize the Discord bot
 */
export async function initializeBot(config: BotConfig): Promise<DiscordBot> {
  const client = createDiscordClient();
  const rest = new REST({ version: '10' }).setToken(config.token);

  const bot: DiscordBot = {
    client,
    rest,
    config,
    isReady: false,
  };

  // Set up ready handler
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`[Discord] Logged in as ${readyClient.user.tag}`);
    bot.isReady = true;
  });

  // Error handling
  client.on(Events.Error, (error) => {
    console.error('[Discord] Client error:', error);
  });

  // Login
  await client.login(config.token);

  return bot;
}

/**
 * Register slash commands with Discord
 */
export async function registerCommands(
  bot: DiscordBot,
  commands: RESTPostAPIChatInputApplicationCommandsJSONBody[]
): Promise<void> {
  try {
    console.log(`[Discord] Registering ${commands.length} slash commands...`);

    if (bot.config.guildId) {
      // Guild commands (faster for development)
      await bot.rest.put(
        Routes.applicationGuildCommands(bot.config.clientId, bot.config.guildId),
        { body: commands }
      );
      console.log(`[Discord] Registered commands for guild ${bot.config.guildId}`);
    } else {
      // Global commands (up to 1 hour to propagate)
      await bot.rest.put(
        Routes.applicationCommands(bot.config.clientId),
        { body: commands }
      );
      console.log('[Discord] Registered global commands');
    }
  } catch (error) {
    console.error('[Discord] Failed to register commands:', error);
    throw error;
  }
}

/**
 * Gracefully shutdown the bot
 */
export async function shutdownBot(bot: DiscordBot): Promise<void> {
  console.log('[Discord] Shutting down...');
  bot.isReady = false;
  await bot.client.destroy();
  console.log('[Discord] Shutdown complete');
}

/**
 * Get bot configuration from environment
 */
export function getBotConfigFromEnv(): BotConfig | null {
  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;

  if (!token || !clientId) {
    return null;
  }

  return {
    token,
    clientId,
    guildId: process.env.DISCORD_GUILD_ID, // Optional
  };
}
