/**
 * Shared HTTP retry utilities for connector clients.
 *
 * Provides exponential backoff with full jitter, honoring Retry-After
 * headers on 429/503 throttling responses. Used by the Outlook Graph
 * client and (selectively) the Gmail client where the underlying transport
 * does not auto-retry transient failures.
 *
 * Every source of nondeterminism (sleep, randomness, clock) is injectable so
 * the policy can be unit-tested without real timers or wall-clock reads.
 */

/**
 * Retry policy: how many attempts, backoff bounds, and which HTTP statuses
 * are considered transient/retryable.
 */
export interface RetryPolicy {
  /** Maximum number of *retries* after the initial attempt. */
  maxRetries: number;
  /** Base delay for exponential backoff, in milliseconds. */
  baseDelayMs: number;
  /** Upper bound on any single backoff delay, in milliseconds. */
  maxDelayMs: number;
  /** HTTP status codes that trigger a retry. */
  retryableStatuses: ReadonlySet<number>;
}

/**
 * Default policy: 4 retries, 500ms base, 30s ceiling, retry on 429 + 5xx.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 4,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
  retryableStatuses: new Set([429, 500, 502, 503, 504]),
};

/**
 * Promise-based sleep.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse a `Retry-After` header value into a delay in milliseconds.
 *
 * Per RFC 7231 the value is either a non-negative integer number of seconds
 * or an HTTP-date. Returns `undefined` when the header is absent or
 * unparseable so the caller can fall back to computed backoff.
 */
export function parseRetryAfter(
  value: string | null | undefined,
  nowMs: number = Date.now()
): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();

  // delta-seconds form
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }

  // HTTP-date form
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - nowMs);
  }

  return undefined;
}

/**
 * Exponential backoff with full jitter (AWS "Exponential Backoff And Jitter").
 *
 * The delay for a given 0-based attempt is a uniform random value in
 * `[0, min(maxDelayMs, baseDelayMs * 2^attempt)]`. Full jitter avoids
 * thundering-herd retry storms.
 */
export function backoffDelay(
  attempt: number,
  policy: RetryPolicy,
  random: () => number = Math.random
): number {
  const ceiling = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** attempt);
  return Math.floor(random() * ceiling);
}

/**
 * Injectable hooks for observability + testability.
 */
export interface RetryHooks {
  /** Invoked before each scheduled retry sleep. */
  onRetry?: (info: {
    attempt: number;
    delayMs: number;
    status?: number;
    error?: unknown;
  }) => void;
  /** Override the sleep implementation (tests pass a no-op). */
  sleepFn?: (ms: number) => Promise<void>;
  /** Override the RNG used for jitter. */
  random?: () => number;
  /** Override the clock used for Retry-After date math. */
  now?: () => number;
}

/**
 * Execute an HTTP request thunk with retry on transient failures.
 *
 * Retries on:
 *   - retryable HTTP status codes (429 / 5xx) — honoring `Retry-After`
 *   - thrown network errors (the fetch promise rejecting)
 *
 * Returns the final `Response` once retries are exhausted; the caller is
 * responsible for inspecting `response.ok`. A persistent network error after
 * the last attempt is re-thrown.
 */
export async function fetchWithRetry(
  doFetch: () => Promise<Response>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  hooks: RetryHooks = {}
): Promise<Response> {
  const sleepFn = hooks.sleepFn ?? sleep;
  const random = hooks.random ?? Math.random;
  const now = hooks.now ?? Date.now;

  let lastError: unknown;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    try {
      const response = await doFetch();

      // Success or a non-retryable status: hand back to the caller.
      if (response.ok || !policy.retryableStatuses.has(response.status)) {
        return response;
      }

      // Retryable status but no attempts left: return for caller to throw.
      if (attempt === policy.maxRetries) {
        return response;
      }

      const retryAfter = parseRetryAfter(response.headers.get('retry-after'), now());
      const delayMs = retryAfter ?? backoffDelay(attempt, policy, random);
      hooks.onRetry?.({ attempt, delayMs, status: response.status });
      await sleepFn(delayMs);
    } catch (error) {
      lastError = error;
      if (attempt === policy.maxRetries) {
        throw error;
      }
      const delayMs = backoffDelay(attempt, policy, random);
      hooks.onRetry?.({ attempt, delayMs, error });
      await sleepFn(delayMs);
    }
  }

  // Loop always returns or throws above; this satisfies the type checker.
  throw lastError ?? new Error('fetchWithRetry: retries exhausted');
}
