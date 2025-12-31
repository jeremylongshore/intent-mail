/**
 * /read Slash Command
 *
 * Displays a specific email or thread with actions.
 *
 * E2.S2.4: Read Command (/read)
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

export const readCommand = new SlashCommandBuilder()
  .setName('read')
  .setDescription('Read an email or thread')
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('Email or thread ID')
      .setRequired(true)
  )
  .addBooleanOption(option =>
    option
      .setName('thread')
      .setDescription('View as thread (show all emails in conversation)')
      .setRequired(false)
  );

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function truncateBody(body: string, maxLength: number = 1800): string {
  if (body.length <= maxLength) return body;
  return body.slice(0, maxLength - 50) + '\n\n*... (message truncated)*';
}

export async function executeReadCommand(
  interaction: ChatInputCommandInteraction,
  emailConnector: EmailConnector
): Promise<void> {
  const emailId = interaction.options.getString('id', true);
  const viewAsThread = interaction.options.getBoolean('thread') ?? false;

  await interaction.deferReply();

  try {
    if (viewAsThread) {
      const thread = await emailConnector.getThread(emailId);

      if (!thread) {
        const notFoundEmbed = new EmbedBuilder()
          .setTitle('❌ Thread Not Found')
          .setDescription(`Could not find thread with ID: ${emailId}`)
          .setColor(0xed4245);

        await interaction.editReply({ embeds: [notFoundEmbed] });
        return;
      }

      const threadList = thread.messages.map((email, index) => {
        const sender = email.from.name || email.from.email;
        const time = email.date.toLocaleDateString();
        return `**${index + 1}.** ${sender} - ${time}\n${email.snippet}`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`🧵 ${thread.subject}`)
        .setDescription(threadList)
        .setColor(0x5865f2)
        .setFooter({ text: `Thread ID: ${thread.id} | ${thread.messages.length} messages` });

      await interaction.editReply({ embeds: [embed] });
    } else {
      const email = await emailConnector.getEmail(emailId);

      if (!email) {
        const notFoundEmbed = new EmbedBuilder()
          .setTitle('❌ Email Not Found')
          .setDescription(`Could not find email with ID: ${emailId}`)
          .setColor(0xed4245);

        await interaction.editReply({ embeds: [notFoundEmbed] });
        return;
      }

      // Mark as read
      await emailConnector.markAsRead([emailId]);

      const body = truncateBody(email.body || '(no content)');
      const fromField = email.from.name ? `${email.from.name} <${email.from.email}>` : email.from.email;
      const toField = email.to.map(addr => addr.name ? `${addr.name} <${addr.email}>` : addr.email).join(', ');

      const embed = new EmbedBuilder()
        .setTitle(email.subject || '(no subject)')
        .setDescription(body)
        .setColor(email.isRead ? 0x99aab5 : 0x5865f2)
        .addFields(
          { name: 'From', value: fromField, inline: true },
          { name: 'To', value: toField, inline: true },
          { name: 'Date', value: email.date.toLocaleString(), inline: true },
        )
        .setTimestamp(email.date);

      if (email.cc && email.cc.length > 0) {
        const ccField = email.cc.map(addr => addr.email).join(', ');
        embed.addFields({ name: 'Cc', value: ccField, inline: true });
      }

      if (email.attachments.length > 0) {
        const attachmentList = email.attachments.map(a => `${a.filename} (${formatSize(a.size)})`).join('\n');
        embed.addFields({ name: `📎 Attachments (${email.attachments.length})`, value: attachmentList, inline: false });
      }

      // Create action buttons
      const row1 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`reply_${emailId}`)
            .setLabel('↩️ Reply')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`forward_${emailId}`)
            .setLabel('➡️ Forward')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`star_${emailId}`)
            .setLabel(email.isStarred ? '⭐ Unstar' : '☆ Star')
            .setStyle(ButtonStyle.Secondary),
        );

      const row2 = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder()
            .setCustomId(`archive_${emailId}`)
            .setLabel('📁 Archive')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`delete_${emailId}`)
            .setLabel('🗑️ Delete')
            .setStyle(ButtonStyle.Danger),
        );

      await interaction.editReply({ embeds: [embed], components: [row1, row2] });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(errorMessage)
      .setColor(0xed4245);

    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
