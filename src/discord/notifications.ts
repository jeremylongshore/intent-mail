/**
 * Discord Notification System
 *
 * Sends email notifications via Discord DMs.
 *
 * E2.S2.7: Notification System
 */

import { Client, EmbedBuilder, type DMChannel } from 'discord.js';

export interface EmailNotification {
  id: string;
  from: { name?: string; email: string };
  subject: string;
  snippet: string;
  date: Date;
  accountEmail: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface NotificationPreferences {
  enabled: boolean;
  quietHoursStart?: number;
  quietHoursEnd?: number;
  priorityOnly?: boolean;
  keywords?: string[];
  excludeSenders?: string[];
}

// In-memory storage for user notification preferences
const userPreferences = new Map<string, NotificationPreferences>();
const userDMChannels = new Map<string, DMChannel>();

/**
 * Notification Manager
 */
export class NotificationManager {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /**
   * Register a user for notifications
   */
  async registerUser(
    discordUserId: string,
    preferences: NotificationPreferences = { enabled: true }
  ): Promise<void> {
    userPreferences.set(discordUserId, preferences);

    try {
      const user = await this.client.users.fetch(discordUserId);
      const dmChannel = await user.createDM();
      userDMChannels.set(discordUserId, dmChannel);
    } catch (error) {
      console.error(`[Notifications] Failed to create DM channel for ${discordUserId}:`, error);
    }
  }

  /**
   * Unregister a user from notifications
   */
  unregisterUser(discordUserId: string): void {
    userPreferences.delete(discordUserId);
    userDMChannels.delete(discordUserId);
  }

  /**
   * Update user preferences
   */
  updatePreferences(discordUserId: string, preferences: Partial<NotificationPreferences>): void {
    const current = userPreferences.get(discordUserId) ?? { enabled: true };
    userPreferences.set(discordUserId, { ...current, ...preferences });
  }

  /**
   * Get user preferences
   */
  getPreferences(discordUserId: string): NotificationPreferences | undefined {
    return userPreferences.get(discordUserId);
  }

  /**
   * Check if notification should be sent based on preferences
   */
  shouldNotify(discordUserId: string, notification: EmailNotification): boolean {
    const prefs = userPreferences.get(discordUserId);

    if (!prefs || !prefs.enabled) {
      return false;
    }

    // Check quiet hours
    if (prefs.quietHoursStart !== undefined && prefs.quietHoursEnd !== undefined) {
      const currentHour = new Date().getHours();
      if (prefs.quietHoursStart <= prefs.quietHoursEnd) {
        if (currentHour >= prefs.quietHoursStart && currentHour < prefs.quietHoursEnd) {
          return false;
        }
      } else {
        if (currentHour >= prefs.quietHoursStart || currentHour < prefs.quietHoursEnd) {
          return false;
        }
      }
    }

    // Check priority filter
    if (prefs.priorityOnly && notification.priority !== 'high') {
      return false;
    }

    // Check excluded senders
    if (prefs.excludeSenders?.some(sender =>
      notification.from.email.toLowerCase().includes(sender.toLowerCase())
    )) {
      return false;
    }

    // Check keyword filter
    if (prefs.keywords && prefs.keywords.length > 0) {
      const content = `${notification.subject} ${notification.snippet}`.toLowerCase();
      if (!prefs.keywords.some(keyword => content.includes(keyword.toLowerCase()))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Send a notification to a user
   */
  async notify(discordUserId: string, notification: EmailNotification): Promise<boolean> {
    if (!this.shouldNotify(discordUserId, notification)) {
      return false;
    }

    const dmChannel = userDMChannels.get(discordUserId);
    if (!dmChannel) {
      console.warn(`[Notifications] No DM channel for user ${discordUserId}`);
      return false;
    }

    try {
      const embed = this.createNotificationEmbed(notification);
      await dmChannel.send({ embeds: [embed] });
      return true;
    } catch (error) {
      console.error(`[Notifications] Failed to send notification to ${discordUserId}:`, error);
      return false;
    }
  }

  /**
   * Create notification embed
   */
  private createNotificationEmbed(notification: EmailNotification): EmbedBuilder {
    const priorityColor = notification.priority === 'high' ? 0xed4245 : 0x5865f2;

    return new EmbedBuilder()
      .setTitle('📧 New Email')
      .setColor(priorityColor)
      .addFields(
        {
          name: 'From',
          value: notification.from.name || notification.from.email,
          inline: true,
        },
        {
          name: 'Subject',
          value: notification.subject || '(no subject)',
          inline: false,
        },
        {
          name: 'Preview',
          value: notification.snippet.slice(0, 200) || '...',
          inline: false,
        }
      )
      .setFooter({ text: notification.accountEmail })
      .setTimestamp(notification.date);
  }

  /**
   * Broadcast notification to multiple users
   */
  async broadcast(
    notification: EmailNotification,
    userIds: string[]
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const userId of userIds) {
      const success = await this.notify(userId, notification);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }
}

/**
 * Create a notification manager instance
 */
export function createNotificationManager(client: Client): NotificationManager {
  return new NotificationManager(client);
}
