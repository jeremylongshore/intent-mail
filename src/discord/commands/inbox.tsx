/**
 * /inbox Slash Command
 *
 * Displays the user's email inbox with pagination and actions.
 *
 * E2.S2.3: Inbox Command (/inbox)
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

const EMAILS_PER_PAGE = 10;

export const inboxCommand = new SlashCommandBuilder()
  .setName('inbox')
  .setDescription('View your email inbox')
  .addIntegerOption(option =>
    option
      .setName('page')
      .setDescription('Page number')
      .setMinValue(1)
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('filter')
      .setDescription('Filter emails')
      .setRequired(false)
      .addChoices(
        { name: 'Unread only', value: 'unread' },
        { name: 'Starred', value: 'starred' },
        { name: 'All', value: 'all' },
      )
  );

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

export async function executeInboxCommand(
  interaction: ChatInputCommandInteraction,
  emailConnector: EmailConnector
): Promise<void> {
  const page = interaction.options.getInteger('page') ?? 1;
  const filter = interaction.options.getString('filter') ?? 'all';

  await interaction.deferReply();

  try {
    // Build search options based on filter
    const searchOptions = {
      query: filter === 'all' ? 'inbox' : '',
      folder: 'inbox',
      isRead: filter === 'unread' ? false : undefined,
      isStarred: filter === 'starred' ? true : undefined,
      limit: EMAILS_PER_PAGE,
      offset: (page - 1) * EMAILS_PER_PAGE,
    };

    const results = await emailConnector.search(searchOptions);
    const emails = results.map(r => r.email);

    if (emails.length === 0) {
      const emptyEmbed = new EmbedBuilder()
        .setTitle('📥 Inbox')
        .setDescription('Your inbox is empty! 🎉')
        .setColor(0x57f287);

      await interaction.editReply({ embeds: [emptyEmbed] });
      return;
    }

    // Build email list
    const emailList = emails.map((email, index) => {
      const unreadIndicator = !email.isRead ? '**' : '';
      const starIndicator = email.isStarred ? ' ⭐' : '';
      const sender = truncate(email.from.name || email.from.email, 20);
      const subject = truncate(email.subject || '(no subject)', 35);
      const time = formatRelativeTime(email.date);

      return `${index + 1}. ${unreadIndicator}${sender}${unreadIndicator}${starIndicator}\n   ${subject} - ${time}`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
      .setTitle('📥 Inbox')
      .setDescription(emailList)
      .setColor(0x5865f2)
      .setFooter({ text: `Page ${page}` })
      .setTimestamp();

    // Create buttons for navigation
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('inbox_prev')
          .setLabel('◀ Prev')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page <= 1),
        new ButtonBuilder()
          .setCustomId('inbox_next')
          .setLabel('Next ▶')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(emails.length < EMAILS_PER_PAGE),
        new ButtonBuilder()
          .setCustomId('inbox_refresh')
          .setLabel('🔄 Refresh')
          .setStyle(ButtonStyle.Primary),
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(errorMessage)
      .setColor(0xed4245);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
