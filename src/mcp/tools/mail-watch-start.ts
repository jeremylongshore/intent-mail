/**
 * Mail Watch Start Tool
 *
 * Start Gmail push notifications for real-time email updates.
 * Requires a Google Cloud Pub/Sub topic configured for Gmail API.
 */

import { z } from 'zod';
import { getDatabase } from '../../storage/database.js';
import { AccountRow, EmailProvider } from '../../types/account.js';
import { createGmailOAuth, createGmailClient } from '../../connectors/gmail/index.js';
import { startWatch } from '../../sync/watch-manager.js';

/**
 * Input schema for mail_watch_start
 */
const MailWatchStartInputSchema = z.object({
  accountId: z.number().int().positive().describe('Account ID to start watching'),
  topicName: z.string().min(1).describe('Google Cloud Pub/Sub topic name (e.g., projects/my-project/topics/gmail-push)'),
  labelIds: z.array(z.string()).optional().describe('Labels to watch (default: INBOX)'),
});

/**
 * Output schema for mail_watch_start
 */
const MailWatchStartOutputSchema = z.object({
  success: z.boolean(),
  accountId: z.number(),
  email: z.string(),
  historyId: z.string().optional(),
  expiration: z.string().optional(),
  expiresInHours: z.number().optional(),
  error: z.string().optional(),
});

/**
 * Mail watch start tool definition and handler
 */
export const mailWatchStartTool = {
  definition: {
    name: 'mail_watch_start',
    description: `Start Gmail push notifications for real-time email updates.

Prerequisites:
1. Create a Google Cloud Pub/Sub topic
2. Grant Gmail API publish permissions to the topic
3. Set up a webhook endpoint to receive notifications

The watch expires after ~7 days and needs periodic renewal.
Use mail_watch_status to check expiration and mail_watch_stop to disable.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: {
          type: 'number',
          description: 'Account ID to start watching',
        },
        topicName: {
          type: 'string',
          description: 'Google Cloud Pub/Sub topic name (e.g., projects/my-project/topics/gmail-push)',
        },
        labelIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to watch (default: INBOX)',
        },
      },
      required: ['accountId', 'topicName'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailWatchStartInputSchema.parse(args);
    const db = getDatabase();

    // Get account
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?')
      .get(input.accountId) as AccountRow | undefined;

    if (!account) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            accountId: input.accountId,
            email: '',
            error: 'Account not found',
          }, null, 2),
        }],
      };
    }

    if (account.provider !== EmailProvider.GMAIL) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            accountId: input.accountId,
            email: account.email,
            error: 'Push notifications only supported for Gmail accounts',
          }, null, 2),
        }],
      };
    }

    if (!account.access_token || !account.refresh_token) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            accountId: input.accountId,
            email: account.email,
            error: 'Account not authenticated. Run mail_auth_start first.',
          }, null, 2),
        }],
      };
    }

    try {
      // Create Gmail client
      const oauth = createGmailOAuth({
        clientId: process.env.GMAIL_CLIENT_ID || '',
        clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
        redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
        scopes: [], // Scopes not needed for API calls with existing tokens
      });

      oauth.setCredentials({
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        expiresAt: account.token_expires_at || '',
      });

      const gmailClient = createGmailClient(oauth);

      // Start watch
      const result = await startWatch(
        input.accountId,
        input.topicName,
        gmailClient,
        input.labelIds
      );

      const output = {
        success: true,
        accountId: input.accountId,
        email: account.email,
        historyId: result.historyId,
        expiration: result.expiration,
        expiresInHours: Math.round(result.expiresIn / (60 * 60 * 1000)),
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(MailWatchStartOutputSchema.parse(output), null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: false,
            accountId: input.accountId,
            email: account.email,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        }],
      };
    }
  },
};

export type MailWatchStartInput = z.infer<typeof MailWatchStartInputSchema>;
export type MailWatchStartOutput = z.infer<typeof MailWatchStartOutputSchema>;
