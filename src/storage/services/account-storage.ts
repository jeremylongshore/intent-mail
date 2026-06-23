/**
 * Account Storage Service
 *
 * CRUD operations for email accounts.
 */

import { getDatabase } from '../database.js';
import { StorageError } from '../../types/storage.js';
import {
  encryptNullable,
  decryptToken,
  isEncrypted,
} from '../token-crypto.js';
import {
  Account,
  AccountRow,
  AccountWithStats,
  CreateAccountInput,
  EmailProvider,
  UpdateSyncStateInput,
  UpdateTokensInput,
} from '../../types/account.js';

/**
 * Convert database row to domain object
 */
function rowToAccount(row: AccountRow, includeTokens = false): Account {
  const account: Account = {
    id: row.id,
    provider: row.provider as EmailProvider,
    email: row.email,
    displayName: row.display_name || undefined,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  // Include tokens only if requested (privacy consideration). Tokens are
  // stored encrypted at rest; decryptToken passes plaintext (legacy) through.
  if (includeTokens && row.access_token && row.refresh_token && row.token_expires_at) {
    account.tokens = {
      accessToken: decryptToken(row.access_token),
      refreshToken: decryptToken(row.refresh_token),
      expiresAt: row.token_expires_at,
    };
  }

  // Include sync state if available
  if (row.last_history_id || row.delta_token || row.last_sync_at) {
    account.syncState = {
      lastHistoryId: row.last_history_id || undefined,
      deltaToken: row.delta_token || undefined,
      lastSyncAt: row.last_sync_at || undefined,
    };
  }

  return account;
}

/**
 * Lazily re-encrypt a legacy plaintext token row in place. No-op when the row
 * has no tokens or they are already encrypted. Called on token reads so older
 * databases migrate to encryption-at-rest without an explicit batch job.
 */
function lazyReencryptRow(row: AccountRow): void {
  if (!row.access_token || !row.refresh_token) return;
  if (isEncrypted(row.access_token) && isEncrypted(row.refresh_token)) return;

  const db = getDatabase();
  db.prepare(
    `UPDATE accounts
       SET access_token = ?, refresh_token = ?, token_enc_version = 1
     WHERE id = ?`
  ).run(
    encryptNullable(decryptToken(row.access_token)),
    encryptNullable(decryptToken(row.refresh_token)),
    row.id
  );
}

/**
 * Create new account
 */
export function createAccount(input: CreateAccountInput): Account {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO accounts (
      provider, email, display_name,
      access_token, refresh_token, token_expires_at,
      token_enc_version, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, 1, 1)
  `);

  try {
    const result = stmt.run(
      input.provider,
      input.email,
      input.displayName || null,
      encryptNullable(input.tokens.accessToken),
      encryptNullable(input.tokens.refreshToken),
      input.tokens.expiresAt
    );

    const accountId = result.lastInsertRowid as number;
    const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as AccountRow;

    return rowToAccount(row, true);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw new StorageError(
        `Account with email ${input.email} already exists`,
        'ACCOUNT_DUPLICATE_EMAIL',
        error
      );
    }
    throw new StorageError(
      `Failed to create account: ${error instanceof Error ? error.message : String(error)}`,
      'ACCOUNT_CREATE_ERROR',
      error
    );
  }
}

/**
 * Get account by ID
 */
export function getAccountById(id: number, includeTokens = false): Account | null {
  const db = getDatabase();

  const stmt = db.prepare('SELECT * FROM accounts WHERE id = ?');
  const row = stmt.get(id) as AccountRow | undefined;

  if (!row) {
    return null;
  }

  if (includeTokens) {
    lazyReencryptRow(row);
  }
  return rowToAccount(row, includeTokens);
}

/**
 * Get account by email
 */
export function getAccountByEmail(email: string, includeTokens = false): Account | null {
  const db = getDatabase();

  const stmt = db.prepare('SELECT * FROM accounts WHERE email = ?');
  const row = stmt.get(email) as AccountRow | undefined;

  if (!row) {
    return null;
  }

  if (includeTokens) {
    lazyReencryptRow(row);
  }
  return rowToAccount(row, includeTokens);
}

/**
 * List all accounts (active by default)
 */
export function listAccounts(activeOnly = true): Account[] {
  const db = getDatabase();

  const query = activeOnly
    ? 'SELECT * FROM accounts WHERE is_active = 1 ORDER BY created_at ASC'
    : 'SELECT * FROM accounts ORDER BY created_at ASC';

  const stmt = db.prepare(query);
  const rows = stmt.all() as AccountRow[];

  return rows.map((row) => rowToAccount(row, false));
}

/**
 * List accounts with email statistics
 */
export function listAccountsWithStats(activeOnly = true): AccountWithStats[] {
  const db = getDatabase();

  const query = activeOnly
    ? `
      SELECT
        a.*,
        COUNT(e.id) as email_count,
        SUM(CASE WHEN e.flags NOT LIKE '%SEEN%' THEN 1 ELSE 0 END) as unread_count
      FROM accounts a
      LEFT JOIN emails e ON e.account_id = a.id
      WHERE a.is_active = 1
      GROUP BY a.id
      ORDER BY a.created_at ASC
    `
    : `
      SELECT
        a.*,
        COUNT(e.id) as email_count,
        SUM(CASE WHEN e.flags NOT LIKE '%SEEN%' THEN 1 ELSE 0 END) as unread_count
      FROM accounts a
      LEFT JOIN emails e ON e.account_id = a.id
      GROUP BY a.id
      ORDER BY a.created_at ASC
    `;

  const stmt = db.prepare(query);
  const rows = stmt.all() as Array<AccountRow & { email_count: number; unread_count: number }>;

  return rows.map((row) => ({
    ...rowToAccount(row, false),
    emailCount: row.email_count || 0,
    unreadCount: row.unread_count || 0,
  }));
}

/**
 * Update OAuth tokens
 */
export function updateTokens(input: UpdateTokensInput): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE accounts
    SET access_token = ?,
        refresh_token = ?,
        token_expires_at = ?,
        token_enc_version = 1,
        updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(
    encryptNullable(input.tokens.accessToken),
    encryptNullable(input.tokens.refreshToken),
    input.tokens.expiresAt,
    input.accountId
  );

  if (result.changes === 0) {
    throw new StorageError(
      `Account with id ${input.accountId} not found`,
      'ACCOUNT_NOT_FOUND'
    );
  }
}

/**
 * Update sync state
 */
export function updateSyncState(input: UpdateSyncStateInput): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE accounts
    SET last_history_id = ?,
        delta_token = ?,
        last_sync_at = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(
    input.syncState.lastHistoryId || null,
    input.syncState.deltaToken || null,
    input.syncState.lastSyncAt || null,
    input.accountId
  );

  if (result.changes === 0) {
    throw new StorageError(
      `Account with id ${input.accountId} not found`,
      'ACCOUNT_NOT_FOUND'
    );
  }
}

/**
 * Deactivate account (soft delete)
 */
export function deactivateAccount(id: number): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    UPDATE accounts
    SET is_active = 0,
        updated_at = datetime('now')
    WHERE id = ?
  `);

  const result = stmt.run(id);

  if (result.changes === 0) {
    throw new StorageError(
      `Account with id ${id} not found`,
      'ACCOUNT_NOT_FOUND'
    );
  }
}

/**
 * Delete account permanently (hard delete - also deletes all emails via CASCADE)
 */
export function deleteAccount(id: number): void {
  const db = getDatabase();

  const stmt = db.prepare('DELETE FROM accounts WHERE id = ?');
  const result = stmt.run(id);

  if (result.changes === 0) {
    throw new StorageError(
      `Account with id ${id} not found`,
      'ACCOUNT_NOT_FOUND'
    );
  }
}
