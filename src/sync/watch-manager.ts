/**
 * Gmail Watch Manager
 *
 * Manages Gmail push notification watches for real-time sync.
 * Watches expire after ~7 days and need periodic renewal.
 */

import { getDatabase } from '../storage/database.js';
import { createLogger } from '../utils/logger.js';
import { AccountRow, WatchState } from '../types/account.js';

const log = createLogger({ module: 'watch-manager' });

/**
 * Watch expiration buffer - renew 1 hour before expiry
 */
const EXPIRATION_BUFFER_MS = 60 * 60 * 1000;

/**
 * Default labels to watch (INBOX for new messages)
 */
const DEFAULT_WATCH_LABELS = ['INBOX'];

/**
 * Watch result from Gmail API
 */
export interface WatchResult {
  accountId: number;
  historyId: string;
  expiration: string;
  expiresIn: number; // milliseconds until expiry
}

/**
 * Start watching an account for push notifications
 */
export async function startWatch(
  accountId: number,
  topicName: string,
  gmailClient: { watch: (topic: string, labels?: string[]) => Promise<{ historyId: string; expiration: string }> },
  labelIds: string[] = DEFAULT_WATCH_LABELS
): Promise<WatchResult> {
  const db = getDatabase();

  log.info('Starting watch', { accountId, topicName, labelIds });

  // Call Gmail API to set up watch
  const result = await gmailClient.watch(topicName, labelIds);

  // Parse expiration (Gmail returns epoch milliseconds)
  const expirationMs = parseInt(result.expiration, 10);
  const expirationDate = new Date(expirationMs).toISOString();
  const expiresIn = expirationMs - Date.now();

  // Update database
  db.prepare(`
    UPDATE accounts
    SET watch_expiration = ?,
        watch_history_id = ?,
        push_enabled = 1,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(expirationDate, result.historyId, accountId);

  log.info('Watch started', {
    accountId,
    historyId: result.historyId,
    expiration: expirationDate,
    expiresInHours: Math.round(expiresIn / (60 * 60 * 1000)),
  });

  return {
    accountId,
    historyId: result.historyId,
    expiration: expirationDate,
    expiresIn,
  };
}

/**
 * Stop watching an account
 */
export async function stopWatch(
  accountId: number,
  gmailClient: { stopWatch: () => Promise<void> }
): Promise<void> {
  const db = getDatabase();

  log.info('Stopping watch', { accountId });

  // Call Gmail API to stop watch
  await gmailClient.stopWatch();

  // Update database
  db.prepare(`
    UPDATE accounts
    SET watch_expiration = NULL,
        watch_history_id = NULL,
        push_enabled = 0,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(accountId);

  log.info('Watch stopped', { accountId });
}

/**
 * Get watch state for an account
 */
export function getWatchState(accountId: number): WatchState | null {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT watch_expiration, watch_history_id, push_enabled
    FROM accounts WHERE id = ?
  `).get(accountId) as Pick<AccountRow, 'watch_expiration' | 'watch_history_id' | 'push_enabled'> | undefined;

  if (!row) return null;

  return {
    expiration: row.watch_expiration || undefined,
    historyId: row.watch_history_id || undefined,
    pushEnabled: row.push_enabled === 1,
  };
}

/**
 * Check if a watch is expiring soon (within buffer period)
 */
export function isWatchExpiringSoon(watchState: WatchState): boolean {
  if (!watchState.expiration) return true;

  const expirationTime = new Date(watchState.expiration).getTime();
  const bufferTime = Date.now() + EXPIRATION_BUFFER_MS;

  return expirationTime <= bufferTime;
}

/**
 * Get all accounts with expiring watches
 */
export function getAccountsWithExpiringWatches(): Array<{
  id: number;
  email: string;
  watchExpiration: string;
}> {
  const db = getDatabase();
  const bufferTime = new Date(Date.now() + EXPIRATION_BUFFER_MS).toISOString();

  const rows = db.prepare(`
    SELECT id, email, watch_expiration
    FROM accounts
    WHERE push_enabled = 1
      AND watch_expiration IS NOT NULL
      AND watch_expiration < ?
  `).all(bufferTime) as Array<{
    id: number;
    email: string;
    watch_expiration: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    watchExpiration: row.watch_expiration,
  }));
}

/**
 * Get all accounts with push enabled
 */
export function getAccountsWithPushEnabled(): Array<{
  id: number;
  email: string;
  provider: string;
  watchExpiration: string | null;
}> {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT id, email, provider, watch_expiration
    FROM accounts
    WHERE push_enabled = 1
  `).all() as Array<{
    id: number;
    email: string;
    provider: string;
    watch_expiration: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    provider: row.provider,
    watchExpiration: row.watch_expiration,
  }));
}

/**
 * Log a push notification
 */
export function logPushNotification(
  accountId: number,
  historyId: string,
  messageData?: string
): number {
  const db = getDatabase();

  const result = db.prepare(`
    INSERT INTO push_notification_log (account_id, history_id, message_data)
    VALUES (?, ?, ?)
  `).run(accountId, historyId, messageData || null);

  return Number(result.lastInsertRowid);
}

/**
 * Mark a push notification as processed
 */
export function markPushNotificationProcessed(
  logId: number,
  syncTriggered: boolean,
  error?: string
): void {
  const db = getDatabase();

  db.prepare(`
    UPDATE push_notification_log
    SET processed_at = datetime('now'),
        sync_triggered = ?,
        error = ?
    WHERE id = ?
  `).run(syncTriggered ? 1 : 0, error || null, logId);
}

/**
 * Get recent push notifications for an account
 */
export function getRecentPushNotifications(
  accountId: number,
  limit: number = 20
): Array<{
  id: number;
  historyId: string;
  receivedAt: string;
  processedAt: string | null;
  syncTriggered: boolean;
  error: string | null;
}> {
  const db = getDatabase();

  const rows = db.prepare(`
    SELECT id, history_id, received_at, processed_at, sync_triggered, error
    FROM push_notification_log
    WHERE account_id = ?
    ORDER BY received_at DESC
    LIMIT ?
  `).all(accountId, limit) as Array<{
    id: number;
    history_id: string;
    received_at: string;
    processed_at: string | null;
    sync_triggered: number;
    error: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    historyId: row.history_id,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
    syncTriggered: row.sync_triggered === 1,
    error: row.error,
  }));
}
