/**
 * Multi-account sync orchestration.
 *
 * Coordinates background sync across many accounts with the two concerns the
 * naive sequential loop ignored (bead intent-mail-vql.3):
 *
 *  1. Rate limiting — a bounded-concurrency ceiling so a large account set
 *     doesn't fan out unbounded provider API calls. Per-request 429/5xx backoff
 *     already lives in the provider clients (Gmail's gaxios `retryConfig`,
 *     Outlook's `fetchWithRetry`); this adds the cross-account ceiling on top.
 *  2. Active-account prioritization — accounts with the most recent mail
 *     activity sync first, so the mailboxes the user actually watches refresh
 *     before idle ones. This matters when a poll cycle can't finish every
 *     account within the polling interval.
 */

import { getDatabase } from '../storage/database.js';
import type { AccountRow } from '../types/account.js';

/** Max accounts syncing concurrently within a single poll cycle. */
export const DEFAULT_SYNC_CONCURRENCY = 3;

/** Per-item outcome — success carries the value, failure carries the error. */
export type SettledResult<R> =
  | { ok: true; value: R }
  | { ok: false; error: Error };

/**
 * Run `worker` over `items` with at most `concurrency` in flight at once.
 *
 * Results are returned in input order. A worker rejection is captured as that
 * item's `{ ok: false, error }` rather than aborting the batch — one bad
 * account must never stop the others (the whole point of orchestrating).
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency: number = DEFAULT_SYNC_CONCURRENCY
): Promise<Array<SettledResult<R>>> {
  const results: Array<SettledResult<R>> = new Array(items.length);
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  let next = 0;

  async function runner(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await worker(items[i], i) };
      } catch (err) {
        results[i] = {
          ok: false,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runner()));
  return results;
}

/**
 * Order accounts so the most recently active mailboxes sync first.
 *
 * "Active" = the timestamp of the newest email already stored for the account
 * (`emails.date`, which is indexed by `idx_emails_account_date`). Accounts with
 * no stored mail yet fall back to `last_sync_at`; accounts with neither sort
 * last. The sort is stable — ties preserve the input order.
 */
export function prioritizeAccounts(accounts: AccountRow[]): AccountRow[] {
  if (accounts.length <= 1) return [...accounts];

  const db = getDatabase();
  const ids = accounts.map((a) => a.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT account_id, MAX(date) AS last_activity
         FROM emails
        WHERE account_id IN (${placeholders})
        GROUP BY account_id`
    )
    .all(...ids) as Array<{ account_id: number; last_activity: string | null }>;

  const activity = new Map<number, string>();
  for (const r of rows) {
    if (r.last_activity) activity.set(r.account_id, r.last_activity);
  }

  // Decorate–sort–undecorate so the comparator stays a pure string compare and
  // the sort is stable on ties (via the original index).
  return accounts
    .map((account, index) => ({
      account,
      index,
      key: activity.get(account.id) ?? account.last_sync_at ?? '',
    }))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key < b.key ? 1 : -1; // most recent first
      return a.index - b.index; // stable tiebreak
    })
    .map((d) => d.account);
}
