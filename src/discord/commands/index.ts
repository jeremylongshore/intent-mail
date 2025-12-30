/**
 * Discord Slash Commands Index
 *
 * Registers and exports all slash commands for the Discord bot.
 *
 * E2.S2.3-S2.6: Discord Commands
 */

import type { RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { inboxCommand, executeInboxCommand } from './inbox.js';
import { readCommand, executeReadCommand } from './read.js';
import { composeCommand, executeComposeCommand } from './compose.js';
import { searchCommand, executeSearchCommand } from './search.js';

/**
 * All command definitions for registration
 */
export const commandDefinitions: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [
  inboxCommand.toJSON(),
  readCommand.toJSON(),
  composeCommand.toJSON(),
  searchCommand.toJSON(),
];

/**
 * Command name to handler mapping
 */
export const commandHandlers = {
  inbox: executeInboxCommand,
  read: executeReadCommand,
  compose: executeComposeCommand,
  search: executeSearchCommand,
} as const;

export type CommandName = keyof typeof commandHandlers;

/**
 * Check if a command name is valid
 */
export function isValidCommand(name: string): name is CommandName {
  return name in commandHandlers;
}
