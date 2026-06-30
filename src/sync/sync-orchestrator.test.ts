/**
 * Unit tests for the multi-account sync orchestrator (bead intent-mail-vql.3):
 * bounded-concurrency execution + active-account prioritization.
 *
 * mapWithConcurrency is pure; prioritizeAccounts reads the emails table, so the
 * suite stands up a throwaway temp DB (env set before the dynamic imports so
 * the config module picks up the temp path).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AccountRow } from '../types/account.js';

const tmp = mkdtempSync(join(tmpdir(), 'intentmail-sync-orch-'));
process.env.INTENTMAIL_DB_PATH = join(tmp, 'test.db');
process.env.INTENTMAIL_MASTER_KEY = 'd'.repeat(64);

const { initDatabase, getDatabase, closeDatabase } = await import('../storage/database.js');
const { runMigrations } = await import('../storage/migrations.js');
const { createAccount } = await import('../storage/services/account-storage.js');
const { mapWithConcurrency, prioritizeAccounts, DEFAULT_SYNC_CONCURRENCY } = await import(
  './sync-orchestrator.js'
);

beforeAll(async () => {
  await initDatabase();
  runMigrations();
});

afterAll(() => {
  closeDatabase();
  rmSync(tmp, { recursive: true, force: true });
});

describe('mapWithConcurrency', () => {
  it('preserves input order in the results', async () => {
    const out = await mapWithConcurrency([10, 20, 30], async (n) => n * 2, 2);
    expect(out.map((r) => (r.ok ? r.value : null))).toEqual([20, 40, 60]);
  });

  it('never exceeds the concurrency ceiling but does run in parallel', async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 12 }, (_, i) => i);
    await mapWithConcurrency(
      items,
      async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
        return null;
      },
      3
    );
    expect(maxActive).toBeLessThanOrEqual(3);
    expect(maxActive).toBeGreaterThan(1);
  });

  it('isolates a failing item without aborting the batch', async () => {
    const out = await mapWithConcurrency(
      [1, 2, 3],
      async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      },
      2
    );
    expect(out[0]).toEqual({ ok: true, value: 1 });
    expect(out[1].ok).toBe(false);
    expect(out[1].ok === false && out[1].error.message).toBe('boom');
    expect(out[2]).toEqual({ ok: true, value: 3 });
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], async () => 1)).toEqual([]);
  });

  it('exports a sane default concurrency', () => {
    expect(DEFAULT_SYNC_CONCURRENCY).toBeGreaterThanOrEqual(1);
  });
});

describe('prioritizeAccounts', () => {
  function seedAccount(email: string): number {
    const a = createAccount({
      provider: 'gmail' as never,
      email,
      tokens: {
        accessToken: 'x',
        refreshToken: 'y',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      },
    });
    return a.id;
  }

  function seedEmail(accountId: number, date: string, n: number): void {
    getDatabase()
      .prepare(
        `INSERT INTO emails (account_id, provider_message_id, from_address, to_addresses, subject, date)
         VALUES (?, ?, 'x@y.com', '[]', 'subj', ?)`
      )
      .run(accountId, `msg-${accountId}-${n}`, date);
  }

  function rowsFor(...ids: number[]): AccountRow[] {
    const placeholders = ids.map(() => '?').join(',');
    return getDatabase()
      .prepare(`SELECT * FROM accounts WHERE id IN (${placeholders})`)
      .all(...ids) as AccountRow[];
  }

  it('orders most recently active mailboxes first; idle (no mail) last', () => {
    const idA = seedAccount('a@ex.com');
    const idB = seedAccount('b@ex.com');
    const idC = seedAccount('c@ex.com'); // no mail at all

    seedEmail(idA, '2026-06-28T10:00:00Z', 1);
    seedEmail(idB, '2026-06-20T10:00:00Z', 1);
    seedEmail(idA, '2026-06-29T10:00:00Z', 2); // A's newest is the 29th → A wins

    const rows = rowsFor(idA, idB, idC);
    const byId = (id: number) => rows.find((r) => r.id === id)!;

    // Pass in deliberately reversed order to prove it actually sorts.
    const ordered = prioritizeAccounts([byId(idC), byId(idB), byId(idA)]);
    expect(ordered.map((a) => a.id)).toEqual([idA, idB, idC]);
  });

  it('returns a copy (not the same array) for a single account', () => {
    const rows = getDatabase().prepare('SELECT * FROM accounts LIMIT 1').all() as AccountRow[];
    const out = prioritizeAccounts(rows);
    expect(out.map((a) => a.id)).toEqual(rows.map((a) => a.id));
    expect(out).not.toBe(rows);
  });
});
