/**
 * Mail Watch Status Tool
 *
 * Get push notification status for accounts.
 */

import { z } from 'zod';
import { getDatabase } from '../../storage/database.js';
import { AccountRow } from '../../types/account.js';
import {
  getWatchState,
  isWatchExpiringSoon,
  getRecentPushNotifications,
} from '../../sync/watch-manager.js';

/**
 * Input schema for mail_watch_status
 */
const MailWatchStatusInputSchema = z.object({
  accountId: z.number().int().positive().optional().describe('Specific account ID (omit for all accounts)'),
  includeNotifications: z.boolean().default(false).describe('Include recent push notification log'),
});

/**
 * Output schema for mail_watch_status
 */
const MailWatchStatusOutputSchema = z.object({
  accounts: z.array(z.object({
    accountId: z.number(),
    email: z.string(),
    provider: z.string(),
    pushEnabled: z.boolean(),
    watchExpiration: z.string().nullable(),
    watchHistoryId: z.string().nullable(),
    expiresInHours: z.number().nullable(),
    expiringSoon: z.boolean(),
    recentNotifications: z.array(z.object({
      id: z.number(),
      historyId: z.string(),
      receivedAt: z.string(),
      processedAt: z.string().nullable(),
      syncTriggered: z.boolean(),
      error: z.string().nullable(),
    })).optional(),
  })),
  summary: z.object({
    totalAccounts: z.number(),
    pushEnabled: z.number(),
    expiringSoon: z.number(),
  }),
});

/**
 * Mail watch status tool definition and handler
 */
export const mailWatchStatusTool = {
  definition: {
    name: 'mail_watch_status',
    description: `Get push notification status for email accounts.

Shows:
- Which accounts have push notifications enabled
- Watch expiration times
- Recent push notification history (optional)

Use this to monitor real-time sync health and identify watches that need renewal.`,
    inputSchema: {
      type: 'object' as const,
      properties: {
        accountId: {
          type: 'number',
          description: 'Specific account ID (omit for all accounts)',
        },
        includeNotifications: {
          type: 'boolean',
          description: 'Include recent push notification log',
          default: false,
        },
      },
    },
  },

  handler: async (args: unknown) => {
    const input = MailWatchStatusInputSchema.parse(args);
    const db = getDatabase();

    let accounts: Array<{
      accountId: number;
      email: string;
      provider: string;
      pushEnabled: boolean;
      watchExpiration: string | null;
      watchHistoryId: string | null;
      expiresInHours: number | null;
      expiringSoon: boolean;
      recentNotifications?: Array<{
        id: number;
        historyId: string;
        receivedAt: string;
        processedAt: string | null;
        syncTriggered: boolean;
        error: string | null;
      }>;
    }> = [];

    if (input.accountId) {
      // Get specific account
      const account = db.prepare('SELECT * FROM accounts WHERE id = ?')
        .get(input.accountId) as AccountRow | undefined;

      if (account) {
        const watchState = getWatchState(account.id);
        const expiringSoon = watchState ? isWatchExpiringSoon(watchState) : false;

        let expiresInHours: number | null = null;
        if (watchState?.expiration) {
          const expirationTime = new Date(watchState.expiration).getTime();
          expiresInHours = Math.round((expirationTime - Date.now()) / (60 * 60 * 1000));
        }

        const accountStatus: typeof accounts[0] = {
          accountId: account.id,
          email: account.email,
          provider: account.provider,
          pushEnabled: watchState?.pushEnabled || false,
          watchExpiration: watchState?.expiration || null,
          watchHistoryId: watchState?.historyId || null,
          expiresInHours,
          expiringSoon,
        };

        if (input.includeNotifications) {
          accountStatus.recentNotifications = getRecentPushNotifications(account.id, 10);
        }

        accounts.push(accountStatus);
      }
    } else {
      // Get all accounts
      const allAccounts = db.prepare('SELECT * FROM accounts WHERE is_active = 1')
        .all() as AccountRow[];

      for (const account of allAccounts) {
        const watchState = getWatchState(account.id);
        const expiringSoon = watchState ? isWatchExpiringSoon(watchState) : false;

        let expiresInHours: number | null = null;
        if (watchState?.expiration) {
          const expirationTime = new Date(watchState.expiration).getTime();
          expiresInHours = Math.round((expirationTime - Date.now()) / (60 * 60 * 1000));
        }

        const accountStatus: typeof accounts[0] = {
          accountId: account.id,
          email: account.email,
          provider: account.provider,
          pushEnabled: watchState?.pushEnabled || false,
          watchExpiration: watchState?.expiration || null,
          watchHistoryId: watchState?.historyId || null,
          expiresInHours,
          expiringSoon,
        };

        if (input.includeNotifications && watchState?.pushEnabled) {
          accountStatus.recentNotifications = getRecentPushNotifications(account.id, 5);
        }

        accounts.push(accountStatus);
      }
    }

    const output = {
      accounts,
      summary: {
        totalAccounts: accounts.length,
        pushEnabled: accounts.filter((a) => a.pushEnabled).length,
        expiringSoon: accounts.filter((a) => a.pushEnabled && a.expiringSoon).length,
      },
    };

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify(MailWatchStatusOutputSchema.parse(output), null, 2),
      }],
    };
  },
};

export type MailWatchStatusInput = z.infer<typeof MailWatchStatusInputSchema>;
export type MailWatchStatusOutput = z.infer<typeof MailWatchStatusOutputSchema>;
