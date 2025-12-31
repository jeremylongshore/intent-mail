/**
 * /search Slash Command
 *
 * Search emails with keyword or semantic (AI) search.
 *
 * E2.S2.6: Search Command (/search)
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { EmailConnector } from '../../agents/email-connector.js';
import { semanticSearch, type SemanticSearchResult } from '../../ai/semantic-search.js';

const RESULTS_PER_PAGE = 10;

export const searchCommand = new SlashCommandBuilder()
  .setName('search')
  .setDescription('Search your emails')
  .addSubcommand(subcommand =>
    subcommand
      .setName('keyword')
      .setDescription('Search by keywords')
      .addStringOption(option =>
        option
          .setName('query')
          .setDescription('Search query')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Maximum results (default: 10)')
          .setMinValue(1)
          .setMaxValue(50)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('semantic')
      .setDescription('AI-powered semantic search')
      .addStringOption(option =>
        option
          .setName('query')
          .setDescription('Natural language query')
          .setRequired(true)
      )
      .addIntegerOption(option =>
        option
          .setName('limit')
          .setDescription('Maximum results (default: 10)')
          .setMinValue(1)
          .setMaxValue(20)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('help')
      .setDescription('Learn about search options')
  );

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export async function executeSearchCommand(
  interaction: ChatInputCommandInteraction,
  emailConnector: EmailConnector
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'help') {
    const helpEmbed = new EmbedBuilder()
      .setTitle('🔍 Search Help')
      .setColor(0x5865f2)
      .addFields(
        {
          name: 'Keyword Search',
          value: [
            '`/search keyword "project deadline"`',
            '`/search keyword "from:boss@company.com"`',
            '`/search keyword "subject:meeting"`',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Semantic Search (AI)',
          value: [
            '`/search semantic "emails about project deadlines"`',
            '`/search semantic "messages asking for help"`',
            '`/search semantic "anything about vacation"`',
          ].join('\n'),
          inline: false,
        },
        {
          name: 'Tips',
          value: [
            '• Keyword search: Best for exact matches',
            '• Semantic search: Best for natural language queries',
            '• Use quotes for phrases',
          ].join('\n'),
          inline: false,
        },
      );

    await interaction.reply({ embeds: [helpEmbed] });
    return;
  }

  await interaction.deferReply();

  try {
    const query = interaction.options.getString('query', true);
    const limit = interaction.options.getInteger('limit') ?? RESULTS_PER_PAGE;

    if (subcommand === 'keyword') {
      await handleKeywordSearch(interaction, emailConnector, query, limit);
    } else if (subcommand === 'semantic') {
      await handleSemanticSearch(interaction, emailConnector, query, limit);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Search Failed')
      .setDescription(errorMessage)
      .setColor(0xed4245);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

async function handleKeywordSearch(
  interaction: ChatInputCommandInteraction,
  emailConnector: EmailConnector,
  query: string,
  limit: number
): Promise<void> {
  const results = await emailConnector.search({
    query,
    limit,
  });

  if (results.length === 0) {
    const noResultsEmbed = new EmbedBuilder()
      .setTitle('🔍 No Results')
      .setDescription(`No emails found matching "${query}"`)
      .setColor(0xfee75c)
      .addFields({
        name: 'Suggestions',
        value: [
          '• Try different keywords',
          '• Use broader terms',
          '• Try semantic search for natural language',
        ].join('\n'),
        inline: false,
      });

    await interaction.editReply({ embeds: [noResultsEmbed] });
    return;
  }

  const resultList = results.map((result, index) => {
    const email = result.email;
    const sender = email.from.name || email.from.email;
    const subject = truncate(email.subject || '(no subject)', 40);
    const snippet = truncate(result.snippet, 60);
    const date = email.date.toLocaleDateString();

    return `**${index + 1}.** ${sender}\n${subject}\n_${snippet}_ - ${date}`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle('🔍 Search Results')
    .setDescription(resultList)
    .setColor(0x5865f2)
    .addFields(
      { name: 'Query', value: `"${query}"`, inline: true },
      { name: 'Type', value: 'Keyword', inline: true },
      { name: 'Found', value: `${results.length} emails`, inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('search_new')
        .setLabel('🔍 New Search')
        .setStyle(ButtonStyle.Primary),
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleSemanticSearch(
  interaction: ChatInputCommandInteraction,
  _emailConnector: EmailConnector,
  query: string,
  limit: number
): Promise<void> {
  // Perform semantic search (fetches from database internally)
  const searchResults = await semanticSearch(query, { limit });

  if (searchResults.results.length === 0) {
    const noResultsEmbed = new EmbedBuilder()
      .setTitle('🧠 No Results')
      .setDescription(`No emails found matching "${query}"`)
      .setColor(0xfee75c)
      .addFields({
        name: 'Suggestions',
        value: searchResults.suggestions?.join('\n• ') || [
          '• Try rephrasing your question',
          '• Use more specific terms',
          '• Try keyword search for exact matches',
        ].join('\n'),
        inline: false,
      });

    await interaction.editReply({ embeds: [noResultsEmbed] });
    return;
  }

  // Format results from semantic search
  const resultList = searchResults.results.map((result: SemanticSearchResult, index: number) => {
    const email = result.email;
    const fromData = typeof email.from === 'string'
      ? { name: undefined, email: email.from }
      : { name: email.from.name, email: email.from.address };
    const sender = fromData.name || fromData.email;
    const subject = truncate(email.subject || '(no subject)', 40);
    const snippet = truncate(result.snippet || '', 60);
    const emailDate = new Date(email.date);
    const dateStr = emailDate.toLocaleDateString();
    const score = Math.round(result.relevanceScore * 100);

    return `**${index + 1}.** ${sender} (${score}%)\n${subject}\n_${snippet}_ - ${dateStr}`;
  }).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle('🧠 Semantic Search Results')
    .setDescription(resultList)
    .setColor(0x5865f2)
    .addFields(
      { name: 'Query', value: `"${query}"`, inline: true },
      { name: 'Type', value: 'AI Semantic', inline: true },
      { name: 'Found', value: `${searchResults.results.length} emails`, inline: true },
    )
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('search_new')
        .setLabel('🔍 New Search')
        .setStyle(ButtonStyle.Primary),
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}
