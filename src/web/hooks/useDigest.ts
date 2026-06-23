/**
 * useDigest — load the daily-review digest from /api and apply actions with
 * optimistic row updates. The single state hook behind the DailyReview view.
 */

import { useCallback, useEffect, useState } from 'react';
import { api, DigestParams } from '../api/client.js';
import type { Digest, DigestAction } from '../types.js';

export interface UseDigest {
  digest: Digest | null;
  loading: boolean;
  error: string | null;
  /** IDs of emails removed from view by an action (archived/deleted/etc.). */
  doneIds: Set<number>;
  reload: () => void;
  act: (emailId: number, op: DigestAction, extra?: Record<string, unknown>) => Promise<void>;
}

export function useDigest(params: DigestParams = {}): UseDigest {
  const [digest, setDigest] = useState<Digest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<number>>(() => new Set());

  // Stable params key so the effect only refires on meaningful change.
  const key = JSON.stringify(params);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .digest(params)
      .then((d) => setDigest(d))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (emailId: number, op: DigestAction, extra?: Record<string, unknown>) => {
      // Optimistically remove the row for ops that take it out of view.
      const removes = op !== 'flag';
      if (removes) {
        setDoneIds((prev) => {
          const next = new Set(prev);
          next.add(emailId);
          return next;
        });
      }
      try {
        await api.action(emailId, op, extra);
      } catch (e) {
        // Roll back the optimistic removal on failure.
        if (removes) {
          setDoneIds((prev) => {
            const next = new Set(prev);
            next.delete(emailId);
            return next;
          });
        }
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    []
  );

  return { digest, loading, error, doneIds, reload: load, act };
}
