/**
 * Tests for the shared connector retry utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseRetryAfter,
  backoffDelay,
  fetchWithRetry,
  DEFAULT_RETRY_POLICY,
  RetryPolicy,
} from './retry.js';

/** Build a minimal Response-like object for the retry loop. */
function makeResponse(
  status: number,
  opts: { ok?: boolean; retryAfter?: string; body?: string } = {}
): Response {
  const headers = new Headers();
  if (opts.retryAfter !== undefined) headers.set('retry-after', opts.retryAfter);
  return {
    status,
    ok: opts.ok ?? (status >= 200 && status < 300),
    headers,
    text: async () => opts.body ?? '',
  } as unknown as Response;
}

const NO_SLEEP = { sleepFn: async () => {}, random: () => 0, now: () => 0 };

describe('parseRetryAfter', () => {
  it('parses delta-seconds form', () => {
    expect(parseRetryAfter('5')).toBe(5000);
    expect(parseRetryAfter('0')).toBe(0);
  });

  it('parses HTTP-date form relative to now', () => {
    const now = Date.parse('2026-01-01T00:00:00Z');
    const future = 'Thu, 01 Jan 2026 00:00:30 GMT';
    expect(parseRetryAfter(future, now)).toBe(30_000);
  });

  it('clamps past dates to zero', () => {
    const now = Date.parse('2026-01-01T00:01:00Z');
    const past = 'Thu, 01 Jan 2026 00:00:00 GMT';
    expect(parseRetryAfter(past, now)).toBe(0);
  });

  it('returns undefined for missing or unparseable values', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter(undefined)).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
  });
});

describe('backoffDelay', () => {
  const policy: RetryPolicy = {
    maxRetries: 5,
    baseDelayMs: 100,
    maxDelayMs: 1000,
    retryableStatuses: new Set([429]),
  };

  it('grows exponentially with full jitter (random=1 hits the ceiling)', () => {
    expect(backoffDelay(0, policy, () => 1)).toBe(100);
    expect(backoffDelay(1, policy, () => 1)).toBe(200);
    expect(backoffDelay(2, policy, () => 1)).toBe(400);
  });

  it('clamps to maxDelayMs', () => {
    expect(backoffDelay(10, policy, () => 1)).toBe(1000);
  });

  it('floors at zero with random=0', () => {
    expect(backoffDelay(3, policy, () => 0)).toBe(0);
  });
});

describe('fetchWithRetry', () => {
  it('returns immediately on a 2xx', async () => {
    const doFetch = vi.fn(async () => makeResponse(200));
    const res = await fetchWithRetry(doFetch, DEFAULT_RETRY_POLICY, NO_SLEEP);
    expect(res.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-retryable 4xx', async () => {
    const doFetch = vi.fn(async () => makeResponse(404, { ok: false }));
    const res = await fetchWithRetry(doFetch, DEFAULT_RETRY_POLICY, NO_SLEEP);
    expect(res.status).toBe(404);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 then succeeds', async () => {
    const responses = [makeResponse(429, { ok: false }), makeResponse(200)];
    const doFetch = vi.fn(async () => responses.shift()!);
    const res = await fetchWithRetry(doFetch, DEFAULT_RETRY_POLICY, NO_SLEEP);
    expect(res.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  it('honors Retry-After on a 429', async () => {
    const onRetry = vi.fn();
    const responses = [makeResponse(429, { ok: false, retryAfter: '7' }), makeResponse(200)];
    const doFetch = vi.fn(async () => responses.shift()!);
    await fetchWithRetry(doFetch, DEFAULT_RETRY_POLICY, { ...NO_SLEEP, onRetry });
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ delayMs: 7000, status: 429, attempt: 0 })
    );
  });

  it('returns the last retryable response when retries are exhausted', async () => {
    const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, maxRetries: 2 };
    const doFetch = vi.fn(async () => makeResponse(503, { ok: false }));
    const res = await fetchWithRetry(doFetch, policy, NO_SLEEP);
    expect(res.status).toBe(503);
    expect(doFetch).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('retries thrown network errors then rethrows after the last attempt', async () => {
    const policy: RetryPolicy = { ...DEFAULT_RETRY_POLICY, maxRetries: 1 };
    const doFetch = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(fetchWithRetry(doFetch, policy, NO_SLEEP)).rejects.toThrow('ECONNRESET');
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  it('recovers when a network error is followed by success', async () => {
    let calls = 0;
    const doFetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('transient');
      return makeResponse(200);
    });
    const res = await fetchWithRetry(doFetch, DEFAULT_RETRY_POLICY, NO_SLEEP);
    expect(res.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(2);
  });
});
