/**
 * Mail Watch Stop Tool
 *
 * Stop Gmail push notifications for an account.
 */

import { z } from 'zod';
import { getDatabase } from '../../storage/database.js';
import { AccountRow, EmailProvider } from '../../types/account.js';
import { createGmailOAuth, createGmailClient } from '../../connectors/gmail/index.js';
import { stopWatch, getWatchState } from '../../sync/watch-manager.js';

/**
 * Input schema for mail_watch_stop
 */
const MailWatchStopInputSchema = z.object({
  accountId: z.number().int().positive().describe('Account ID to stop watching'),
});

/**
 * Output schema for mail_watch_stop
 */
const MailWatchStopOutputSchema = z.object({
  success: z.boolean(),
  accountId: z.number(),
  email: z.string(),
  wasPushEnabled: z.boolean(),
  error: z.string().optional(),
});

/**
 * Mail watch stop tool definition and handler
 */
export const mailWatchStopTool = {
  definition: {
    name: 'mail_watch_stop',
    description: `Stop Gmail push notifications for an account.

This disables real-time updates. The account will fall back to polling-based sync.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: {
          type: 'number',
          description: 'Account ID to stop watching',
        },
      },
      required: ['accountId'],
    },
  },

  handler: async (args: unknown) => {
    const input = MailWatchStopInputSchema.parse(args);
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
            wasPushEnabled: false,
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
            wasPushEnabled: false,
            error: 'Push notifications only supported for Gmail accounts',
          }, null, 2),
        }],
      };
    }

    // Check current watch state
    const watchState = getWatchState(input.accountId);
    const wasPushEnabled = watchState?.pushEnabled || false;

    if (!wasPushEnabled) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            accountId: input.accountId,
            email: account.email,
            wasPushEnabled: false,
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
        scopes: [],
      });

      oauth.setCredentials({
        accessToken: account.access_token!,
        refreshToken: account.refresh_token!,
        expiresAt: account.token_expires_at || '',
      });

      const gmailClient = createGmailClient(oauth);

      // Stop watch
      await stopWatch(input.accountId, gmailClient);

      const output = {
        success: true,
        accountId: input.accountId,
        email: account.email,
        wasPushEnabled: true,
      };

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(MailWatchStopOutputSchema.parse(output), null, 2),
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
            wasPushEnabled,
            error: error instanceof Error ? error.message : String(error),
          }, null, 2),
        }],
      };
    }
  },
};

export type MailWatchStopInput = z.infer<typeof MailWatchStopInputSchema>;
export type MailWatchStopOutput = z.infer<typeof MailWatchStopOutputSchema>;
