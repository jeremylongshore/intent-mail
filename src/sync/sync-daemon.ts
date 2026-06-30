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
import { createGmailSync } from '../connectors/gmail/index.js';
import { getProviderClientForAccount } from '../connectors/provider-client.js';
import { createOutlookSync } from '../connectors/outlook/sync.js';
import { updateSyncState } from '../storage/services/account-storage.js';
import { mapWithConcurrency, prioritizeAccounts } from './sync-orchestrator.js';
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
// Reentrancy guard: a poll cycle over many accounts can outlast the interval;
// without this, setInterval would stack overlapping cycles and double-sync.
let isPolling = false;

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
    // Factory loads the account, refreshes an expired token AND persists it,
    // and returns a ready Gmail client (fixes the token-drift the old manual
    // OAuth dance had: it never wrote refreshed tokens back).
    const client = await getProviderClientForAccount(account.id);
    if (!client.gmail) {
      throw new Error(`Account ${accountEmail} is not a Gmail account`);
    }
    const sync = createGmailSync(client.gmail, account.id);

    // Perform delta sync from the notification's history ID
    // Use the stored lastHistoryId if it's newer than the notification
    const startHistoryId = account.last_history_id || historyId;
    const result = await sync.deltaSync(startHistoryId);

    // Update sync state
    updateSyncState({
      accountId: account.id,
      syncState: { lastHistoryId: result.newHistoryId, lastSyncAt: result.syncedAt },
    });

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
      // Factory refreshes + persists tokens before we renew the watch.
      const client = await getProviderClientForAccount(account.id);
      if (!client.gmail) {
        errors.push(`${account.email}: not a Gmail account`);
        failed++;
        continue;
      }

      // Renew watch
      await startWatch(account.id, pubsubTopic, client.gmail);

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

  // Active Gmail accounts without push that are authenticated and have a
  // baseline history ID (a never-synced account needs an initial mail_sync
  // first — there's nothing to delta against yet).
  const accounts = (db.prepare(`
    SELECT * FROM accounts
    WHERE is_active = 1 AND provider = ?
  `).all(EmailProvider.GMAIL) as AccountRow[])
    .filter(
      (a) =>
        !pushEnabledIds.has(a.id) &&
        a.access_token &&
        a.refresh_token &&
        a.last_history_id
    );

  // Most recently active mailboxes first, so they refresh before idle ones
  // when a cycle can't finish every account within the interval.
  const prioritized = prioritizeAccounts(accounts);

  log.info('Polling Gmail accounts without push', { count: prioritized.length });

  let polled = 0;
  let emailsSynced = 0;
  const errors: string[] = [];

  // Bounded concurrency so a large account set doesn't fan out unbounded API
  // calls; per-request 429/5xx backoff lives in the Gmail client itself.
  const results = await mapWithConcurrency(prioritized, async (account) => {
    // Factory refreshes + persists tokens (fixes the prior token drift).
    const client = await getProviderClientForAccount(account.id);
    if (!client.gmail) return 0;

    const sync = createGmailSync(client.gmail, account.id);
    const result = await sync.deltaSync(account.last_history_id!);

    updateSyncState({
      accountId: account.id,
      syncState: { lastHistoryId: result.newHistoryId, lastSyncAt: result.syncedAt },
    });

    return result.messagesAdded + result.labelsChanged;
  });

  results.forEach((r, i) => {
    if (r.ok) {
      polled++;
      emailsSynced += r.value;
    } else {
      errors.push(`${prioritized[i].email}: ${r.error.message}`);
      log.error('Polling failed', {
        email: prioritized[i].email,
        error: r.error.message,
      });
    }
  });

  return { polled, emailsSynced, errors };
}

/**
 * Poll active Outlook accounts via Graph delta queries.
 *
 * Graph change-notifications (webhooks) require a public HTTPS endpoint plus
 * 3-day subscription renewal, which is infeasible for a self-hosted MCP. So
 * the "watch" model for Outlook is delta-polling: every active Outlook account
 * that already has a stored deltaToken is delta-synced on the polling
 * interval. (A fresh account must run an initial mail_sync first to obtain its
 * first deltaToken.) This relies on the page-1+ delta fix in the Graph client.
 */
export async function pollOutlookAccounts(): Promise<{
  polled: number;
  emailsSynced: number;
  errors: string[];
}> {
  const db = getDatabase();

  // Active Outlook accounts that already have a deltaToken (without one there is
  // nothing to delta against — a fresh account needs an initial mail_sync).
  const accounts = (db
    .prepare(`SELECT * FROM accounts WHERE is_active = 1 AND provider = ?`)
    .all(EmailProvider.OUTLOOK) as AccountRow[]).filter((a) => a.delta_token);

  const prioritized = prioritizeAccounts(accounts);

  log.info('Polling Outlook accounts (delta)', { count: prioritized.length });

  let polled = 0;
  let emailsSynced = 0;
  const errors: string[] = [];

  const results = await mapWithConcurrency(prioritized, async (account) => {
    // Factory handles token refresh + persistence (incl. on-401).
    const client = await getProviderClientForAccount(account.id);
    if (!client.outlook) return 0;

    const sync = createOutlookSync(client.outlook, account.id);
    const result = await sync.deltaSync(account.delta_token!);

    updateSyncState({
      accountId: account.id,
      syncState: { deltaToken: result.deltaLink, lastSyncAt: result.syncedAt },
    });

    return result.messagesAdded + result.labelsChanged;
  });

  results.forEach((r, i) => {
    if (r.ok) {
      polled++;
      emailsSynced += r.value;
    } else {
      errors.push(`${prioritized[i].email}: ${r.error.message}`);
      log.error('Outlook poll failed', {
        email: prioritized[i].email,
        error: r.error.message,
      });
    }
  });

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

  // Polling timer for non-push accounts (Gmail without push + all Outlook).
  // Guarded against reentrancy: if a cycle is still running when the interval
  // fires, skip this tick rather than stacking overlapping syncs.
  pollingTimer = setInterval(async () => {
    if (isPolling) {
      log.warn('Skipping poll cycle — previous cycle still running');
      return;
    }
    isPolling = true;
    try {
      await pollNonPushAccounts();
    } catch (error) {
      log.error('Polling check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    try {
      await pollOutlookAccounts();
    } catch (error) {
      log.error('Outlook polling check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      isPolling = false;
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
