/**
 * Integration test: OAuth tokens are encrypted at rest and decrypted on read,
 * the v5 migration applies, and legacy plaintext rows are lazily re-encrypted.
 *
 * Uses a throwaway temp database. Env is set before the dynamic imports so the
 * config module picks up the temp DB path and the test master key.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'intentmail-crypto-'));
process.env.INTENTMAIL_DB_PATH = join(tmp, 'test.db');
process.env.INTENTMAIL_MASTER_KEY = 'c'.repeat(64);

const { initDatabase, getDatabase, closeDatabase } = await import('../database.js');
const { runMigrations } = await import('../migrations.js');
const { createAccount, getAccountById, updateTokens } = await import('./account-storage.js');
const { isEncrypted } = await import('../token-crypto.js');

beforeAll(async () => {
  await initDatabase();
  runMigrations();
});

afterAll(() => {
  closeDatabase();
  rmSync(tmp, { recursive: true, force: true });
});

describe('account token encryption at rest', () => {
  it('applied the v5 token_enc_version migration', () => {
    const cols = getDatabase()
      .prepare(`PRAGMA table_info(accounts)`)
      .all() as Array<{ name: string }>;
    expect(cols.map((c) => c.name)).toContain('token_enc_version');
  });

  it('stores tokens encrypted but returns them decrypted', () => {
    const created = createAccount({
      provider: 'gmail' as never,
      email: 'enc-test@example.com',
      tokens: {
        accessToken: 'ACCESS-PLAIN',
        refreshToken: 'REFRESH-PLAIN',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });

    // Raw row is ciphertext...
    const row = getDatabase()
      .prepare('SELECT access_token, refresh_token, token_enc_version FROM accounts WHERE id = ?')
      .get(created.id) as { access_token: string; refresh_token: string; token_enc_version: number };
    expect(isEncrypted(row.access_token)).toBe(true);
    expect(isEncrypted(row.refresh_token)).toBe(true);
    expect(row.token_enc_version).toBe(1);
    expect(row.access_token).not.toContain('ACCESS-PLAIN');

    // ...but the service decrypts on read.
    const read = getAccountById(created.id, true);
    expect(read?.tokens?.accessToken).toBe('ACCESS-PLAIN');
    expect(read?.tokens?.refreshToken).toBe('REFRESH-PLAIN');
  });

  it('encrypts on updateTokens', () => {
    const acct = createAccount({
      provider: 'outlook' as never,
      email: 'upd-test@example.com',
      tokens: {
        accessToken: 'A1',
        refreshToken: 'R1',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });

    updateTokens({
      accountId: acct.id,
      tokens: {
        accessToken: 'A2-NEW',
        refreshToken: 'R2-NEW',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });

    const row = getDatabase()
      .prepare('SELECT access_token FROM accounts WHERE id = ?')
      .get(acct.id) as { access_token: string };
    expect(isEncrypted(row.access_token)).toBe(true);
    expect(getAccountById(acct.id, true)?.tokens?.accessToken).toBe('A2-NEW');
  });

  it('lazily re-encrypts a legacy plaintext row on read', () => {
    // Simulate a legacy account written before encryption: insert plaintext
    // directly with token_enc_version = 0.
    const db = getDatabase();
    db.prepare(
      `INSERT INTO accounts (provider, email, access_token, refresh_token, token_expires_at, token_enc_version, is_active)
       VALUES ('gmail', 'legacy@example.com', 'LEGACY-ACCESS', 'LEGACY-REFRESH', ?, 0, 1)`
    ).run(new Date(Date.now() + 3_600_000).toISOString());

    const legacy = db
      .prepare(`SELECT id, access_token FROM accounts WHERE email = 'legacy@example.com'`)
      .get() as { id: number; access_token: string };
    expect(isEncrypted(legacy.access_token)).toBe(false); // plaintext before read

    // Reading with tokens triggers lazy re-encryption.
    const read = getAccountById(legacy.id, true);
    expect(read?.tokens?.accessToken).toBe('LEGACY-ACCESS');

    const after = db
      .prepare('SELECT access_token, token_enc_version FROM accounts WHERE id = ?')
      .get(legacy.id) as { access_token: string; token_enc_version: number };
    expect(isEncrypted(after.access_token)).toBe(true); // encrypted after read
    expect(after.token_enc_version).toBe(1);
  });
});
