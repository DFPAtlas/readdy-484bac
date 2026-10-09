const DEFAULT_RETRY_DELAYS_MS = [250, 1000];
const DEFAULT_RETRY_STATUSES = new Set([404, 429, 500, 502, 503, 504]);

interface RetryOptions {
  delaysMs?: number[];
  retryStatuses?: Set<number>;
  fetcher?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
}

/**
 * Retries short-lived Edge Function gateway failures without duplicating
 * successful requests. Callers must use an idempotent destination workflow.
 */
export async function fetchWithTransientRetry(
  input: string | URL | Request,
  init?: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const delaysMs = options.delaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES;
  const fetcher = options.fetcher ?? fetch;
  const sleep = options.sleep ?? ((delayMs: number) => new Promise((resolve) => setTimeout(resolve, delayMs)));

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    try {
      const response = await fetcher(input, init);
      if (!retryStatuses.has(response.status) || attempt === delaysMs.length) return response;
    } catch (error) {
      lastError = error;
      if (attempt === delaysMs.length) throw error;
    }

    await sleep(delaysMs[attempt]);
  }

  throw lastError instanceof Error ? lastError : new Error('Edge Function request failed');
}
