/**
 * Sync Daemon
 *
 * Background service for:
 * 1. Processing push notifications from Gmail Pub/Sub
 * 2. Automatic watch renewal before expiration
 * 3. Periodic polling fallback for accounts without push
 */

import { getDatabase } from '../storage/database.js';
import { createLogger } from '../utils/logger.js';
import { AccountRow, EmailProvider } from '../types/account.js';
import { createGmailOAuth, createGmailClient, createGmailSync } from '../connectors/gmail/index.js';
import {
  startWatch,
  getAccountsWithExpiringWatches,
  getAccountsWithPushEnabled,
  logPushNotification,
  markPushNotificationProcessed,
} from './watch-manager.js';

const log = createLogger({ module: 'sync-daemon' });

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  /** Pub/Sub topic for Gmail push notifications */
  pubsubTopic: string;
  /** Interval for checking watch renewals (ms) */
  renewalCheckInterval: number;
  /** Interval for polling accounts without push (ms) */
  pollingInterval: number;
  /** Whether to enable automatic watch renewal */
  autoRenewWatches: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: DaemonConfig = {
  pubsubTopic: process.env.GMAIL_PUBSUB_TOPIC || '',
  renewalCheckInterval: 60 * 60 * 1000, // 1 hour
  pollingInterval: 5 * 60 * 1000, // 5 minutes
  autoRenewWatches: true,
};

/**
 * Daemon state
 */
let isRunning = false;
let renewalTimer: NodeJS.Timeout | null = null;
let pollingTimer: NodeJS.Timeout | null = null;

/**
 * Process a push notification from Gmail
 */
export async function processPushNotification(
  accountEmail: string,
  historyId: string,
  messageData?: string
): Promise<{ success: boolean; emailsSynced: number; error?: string }> {
  const db = getDatabase();

  log.info('Processing push notification', { accountEmail, historyId });

  // Find account by email
  const account = db.prepare('SELECT * FROM accounts WHERE email = ? AND is_active = 1')
    .get(accountEmail) as AccountRow | undefined;

  if (!account) {
    log.warn('Account not found for push notification', { accountEmail });
    return { success: false, emailsSynced: 0, error: 'Account not found' };
  }

  // Log the notification
  const logId = logPushNotification(account.id, historyId, messageData);

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
    const sync = createGmailSync(gmailClient, account.id);

    // Perform delta sync from the notification's history ID
    // Use the stored lastHistoryId if it's newer than the notification
    const startHistoryId = account.last_history_id || historyId;
    const result = await sync.deltaSync(startHistoryId);

    // Update sync state
    db.prepare(`
      UPDATE accounts
      SET last_history_id = ?,
          last_sync_at = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(result.newHistoryId, result.syncedAt, account.id);

    // Mark notification as processed
    markPushNotificationProcessed(logId, true);

    const emailsSynced = result.messagesAdded + result.labelsChanged;
    log.info('Push notification processed', {
      accountEmail,
      emailsSynced,
      newHistoryId: result.newHistoryId,
    });

    return {
      success: true,
      emailsSynced,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    markPushNotificationProcessed(logId, false, errorMessage);

    log.error('Failed to process push notification', {
      accountEmail,
      error: errorMessage,
    });

    return {
      success: false,
      emailsSynced: 0,
      error: errorMessage,
    };
  }
}

/**
 * Renew expiring watches
 */
export async function renewExpiringWatches(pubsubTopic: string): Promise<{
  renewed: number;
  failed: number;
  errors: string[];
}> {
  const expiringAccounts = getAccountsWithExpiringWatches();

  log.info('Checking for expiring watches', { count: expiringAccounts.length });

  let renewed = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const account of expiringAccounts) {
    try {
      const db = getDatabase();
      const fullAccount = db.prepare('SELECT * FROM accounts WHERE id = ?')
        .get(account.id) as AccountRow;

      if (!fullAccount.access_token || !fullAccount.refresh_token) {
        errors.push(`${account.email}: No tokens available`);
        failed++;
        continue;
      }

      // Create Gmail client
      const oauth = createGmailOAuth({
        clientId: process.env.GMAIL_CLIENT_ID || '',
        clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
        redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
        scopes: [],
      });

      oauth.setCredentials({
        accessToken: fullAccount.access_token,
        refreshToken: fullAccount.refresh_token,
        expiresAt: fullAccount.token_expires_at || '',
      });

      const gmailClient = createGmailClient(oauth);

      // Renew watch
      await startWatch(account.id, pubsubTopic, gmailClient);

      log.info('Watch renewed', { email: account.email });
      renewed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`${account.email}: ${errorMessage}`);
      failed++;

      log.error('Failed to renew watch', {
        email: account.email,
        error: errorMessage,
      });
    }
  }

  return { renewed, failed, errors };
}

/**
 * Poll accounts without push notifications
 */
export async function pollNonPushAccounts(): Promise<{
  polled: number;
  emailsSynced: number;
  errors: string[];
}> {
  const db = getDatabase();
  const pushEnabledIds = new Set(
    getAccountsWithPushEnabled().map((a) => a.id)
  );

  // Get active Gmail accounts without push
  const accounts = (db.prepare(`
    SELECT * FROM accounts
    WHERE is_active = 1 AND provider = ?
  `).all(EmailProvider.GMAIL) as AccountRow[])
    .filter((a) => !pushEnabledIds.has(a.id));

  log.info('Polling accounts without push', { count: accounts.length });

  let polled = 0;
  let emailsSynced = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    if (!account.access_token || !account.refresh_token) {
      continue;
    }

    try {
      const oauth = createGmailOAuth({
        clientId: process.env.GMAIL_CLIENT_ID || '',
        clientSecret: process.env.GMAIL_CLIENT_SECRET || '',
        redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
        scopes: [],
      });

      oauth.setCredentials({
        accessToken: account.access_token,
        refreshToken: account.refresh_token,
        expiresAt: account.token_expires_at || '',
      });

      const gmailClient = createGmailClient(oauth);
      const sync = createGmailSync(gmailClient, account.id);

      // Delta sync if we have history ID, otherwise skip (requires initial sync first)
      if (account.last_history_id) {
        const result = await sync.deltaSync(account.last_history_id);

        db.prepare(`
          UPDATE accounts
          SET last_history_id = ?,
              last_sync_at = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(result.newHistoryId, result.syncedAt, account.id);

        emailsSynced += result.messagesAdded + result.labelsChanged;
      }

      polled++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`${account.email}: ${errorMessage}`);

      log.error('Polling failed', {
        email: account.email,
        error: errorMessage,
      });
    }
  }

  return { polled, emailsSynced, errors };
}

/**
 * Start the sync daemon
 */
export function startDaemon(config: Partial<DaemonConfig> = {}): void {
  if (isRunning) {
    log.warn('Daemon already running');
    return;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  log.info('Starting sync daemon', {
    renewalCheckInterval: finalConfig.renewalCheckInterval,
    pollingInterval: finalConfig.pollingInterval,
    autoRenewWatches: finalConfig.autoRenewWatches,
  });

  isRunning = true;

  // Watch renewal timer
  if (finalConfig.autoRenewWatches && finalConfig.pubsubTopic) {
    renewalTimer = setInterval(async () => {
      try {
        await renewExpiringWatches(finalConfig.pubsubTopic);
      } catch (error) {
        log.error('Watch renewal check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, finalConfig.renewalCheckInterval);

    // Initial check
    renewExpiringWatches(finalConfig.pubsubTopic).catch((error) => {
      log.error('Initial watch renewal check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  // Polling timer for non-push accounts
  pollingTimer = setInterval(async () => {
    try {
      await pollNonPushAccounts();
    } catch (error) {
      log.error('Polling check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, finalConfig.pollingInterval);

  log.info('Sync daemon started');
}

/**
 * Stop the sync daemon
 */
export function stopDaemon(): void {
  if (!isRunning) {
    log.warn('Daemon not running');
    return;
  }

  log.info('Stopping sync daemon');

  if (renewalTimer) {
    clearInterval(renewalTimer);
    renewalTimer = null;
  }

  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }

  isRunning = false;
  log.info('Sync daemon stopped');
}

/**
 * Check if daemon is running
 */
export function isDaemonRunning(): boolean {
  return isRunning;
}
