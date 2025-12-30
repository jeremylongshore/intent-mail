/**
 * /compose Slash Command
 *
 * Compose and send emails with AI assistance.
 *
 * E2.S2.5: Compose Command (/compose)
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { EmailConnector, EmailDraft } from '../../agents/email-connector.js';
import { generateDraft, type DraftOptions, type DraftTone, type DraftIntent } from '../../ai/draft-generator.js';

export const composeCommand = new SlashCommandBuilder()
  .setName('compose')
  .setDescription('Compose a new email')
  .addSubcommand(subcommand =>
    subcommand
      .setName('new')
      .setDescription('Start a new email')
      .addStringOption(option =>
        option
          .setName('to')
          .setDescription('Recipient email address')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('subject')
          .setDescription('Email subject')
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('reply')
      .setDescription('Reply to an email')
      .addStringOption(option =>
        option
          .setName('email_id')
          .setDescription('ID of the email to reply to')
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('ai')
      .setDescription('Use AI to draft an email')
      .addStringOption(option =>
        option
          .setName('prompt')
          .setDescription('Describe the email you want to write')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('tone')
          .setDescription('Writing tone')
          .setRequired(false)
          .addChoices(
            { name: 'Professional', value: 'professional' },
            { name: 'Friendly', value: 'friendly' },
            { name: 'Casual', value: 'casual' },
            { name: 'Formal', value: 'formal' },
          )
      )
      .addStringOption(option =>
        option
          .setName('to')
          .setDescription('Recipient email address')
          .setRequired(false)
      )
  );

// In-memory draft storage
const userDrafts = new Map<string, EmailDraft>();

export async function executeComposeCommand(
  interaction: ChatInputCommandInteraction,
  emailConnector: EmailConnector
): Promise<void> {
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'new':
        await handleNewCompose(interaction, emailConnector);
        break;
      case 'reply':
        await handleReply(interaction, emailConnector);
        break;
      case 'ai':
        await handleAiCompose(interaction, emailConnector);
        break;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorEmbed = new EmbedBuilder()
      .setTitle('❌ Error')
      .setDescription(errorMessage)
      .setColor(0xed4245);

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

async function handleNewCompose(
  interaction: ChatInputCommandInteraction,
  _emailConnector: EmailConnector
): Promise<void> {
  const to = interaction.options.getString('to') ?? '';
  const subject = interaction.options.getString('subject') ?? '';
  const userId = interaction.user.id;

  const draft: EmailDraft = {
    to: to ? [{ email: to }] : [],
    subject,
    body: '',
  };

  userDrafts.set(userId, draft);

  const embed = new EmbedBuilder()
    .setTitle('✏️ Compose Email')
    .setColor(0x57f287)
    .addFields(
      { name: 'To', value: to || '(not set)', inline: true },
      { name: 'Subject', value: subject || '(no subject)', inline: true },
      { name: 'Message', value: '(empty)', inline: false },
    )
    .setFooter({ text: 'Click "Edit" to write your message' });

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('compose_edit')
        .setLabel('✏️ Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('compose_send')
        .setLabel('📤 Send')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!to),
      new ButtonBuilder()
        .setCustomId('compose_discard')
        .setLabel('🗑️ Discard')
        .setStyle(ButtonStyle.Danger),
    );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleReply(
  interaction: ChatInputCommandInteraction,
  emailConnector: EmailConnector
): Promise<void> {
  const emailId = interaction.options.getString('email_id', true);
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  const email = await emailConnector.getEmail(emailId);
  if (!email) {
    const notFoundEmbed = new EmbedBuilder()
      .setTitle('❌ Email Not Found')
      .setDescription(`Could not find email with ID: ${emailId}`)
      .setColor(0xed4245);

    await interaction.editReply({ embeds: [notFoundEmbed] });
    return;
  }

  const draft: EmailDraft = {
    to: [email.from],
    subject: `Re: ${email.subject}`,
    body: '',
    replyToMessageId: emailId,
    threadId: email.threadId,
  };

  userDrafts.set(userId, draft);

  const embed = new EmbedBuilder()
    .setTitle('↩️ Reply')
    .setColor(0x5865f2)
    .addFields(
      { name: 'To', value: email.from.email, inline: true },
      { name: 'Subject', value: `Re: ${email.subject}`, inline: true },
      { name: 'Original From', value: email.from.name || email.from.email, inline: true },
    )
    .setFooter({ text: 'Click "Edit" to write your reply' });

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('compose_edit')
        .setLabel('✏️ Edit Reply')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('compose_send')
        .setLabel('📤 Send')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('compose_discard')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Secondary),
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleAiCompose(
  interaction: ChatInputCommandInteraction,
  _emailConnector: EmailConnector
): Promise<void> {
  const prompt = interaction.options.getString('prompt', true);
  const tone = (interaction.options.getString('tone') ?? 'professional') as DraftTone;
  const to = interaction.options.getString('to') ?? '';
  const userId = interaction.user.id;

  await interaction.deferReply({ ephemeral: true });

  // Generate draft using AI
  const draftOptions: DraftOptions = {
    intent: 'inform' as DraftIntent,
    tone,
    to: to || undefined,
    context: prompt,
  };

  const aiResult = await generateDraft(draftOptions);

  const draft: EmailDraft = {
    to: to ? [{ email: to }] : [],
    subject: aiResult.suggestedSubject || 'Untitled',
    body: aiResult.body,
  };

  userDrafts.set(userId, draft);

  const truncatedBody = draft.body.length > 500 ? draft.body.slice(0, 500) + '...' : draft.body;

  const embed = new EmbedBuilder()
    .setTitle('🤖 AI-Generated Draft')
    .setColor(0x5865f2)
    .addFields(
      { name: 'To', value: to || '(not set)', inline: true },
      { name: 'Subject', value: draft.subject, inline: true },
      { name: 'Tone', value: tone, inline: true },
      { name: 'Message', value: truncatedBody || '(empty)', inline: false },
    )
    .setFooter({ text: 'Review and edit as needed before sending' });

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('compose_edit')
        .setLabel('✏️ Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('compose_send')
        .setLabel('📤 Send')
        .setStyle(ButtonStyle.Success)
        .setDisabled(!to),
      new ButtonBuilder()
        .setCustomId('compose_regenerate')
        .setLabel('🔄 Regenerate')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('compose_discard')
        .setLabel('🗑️ Discard')
        .setStyle(ButtonStyle.Danger),
    );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/**
 * Get a user's current draft
 */
export function getUserDraft(userId: string): EmailDraft | undefined {
  return userDrafts.get(userId);
}

/**
 * Update a user's draft
 */
export function updateUserDraft(userId: string, updates: Partial<EmailDraft>): void {
  const draft = userDrafts.get(userId);
  if (draft) {
    Object.assign(draft, updates);
  }
}

/**
 * Clear a user's draft
 */
export function clearUserDraft(userId: string): void {
  userDrafts.delete(userId);
}

/**
 * Send a user's draft
 */
export async function sendUserDraft(
  userId: string,
  emailConnector: EmailConnector
): Promise<string> {
  const draft = userDrafts.get(userId);
  if (!draft) {
    throw new Error('No draft to send');
  }

  const messageId = await emailConnector.send(draft);
  userDrafts.delete(userId);
  return messageId;
}
