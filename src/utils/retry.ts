/**
 * Retry utility with exponential backoff
 *
 * Handles transient network failures automatically.
 * Use this wrapper for API calls that may fail due to temporary issues.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms between retries (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in ms (default: 10000) */
  maxDelay?: number;
  /** Multiplier for exponential backoff (default: 2) */
  backoffMultiplier?: number;
  /** HTTP status codes that should trigger retry (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatuses?: number[];
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: Error, nextDelay: number) => void;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'signal'>> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

/**
 * Checks if an error is retryable based on HTTP status
 */
function isRetryableError(error: unknown, retryableStatuses: number[]): boolean {
  if (error instanceof Error) {
    // Network errors (fetch failed)
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return true;
    }

    // HTTP status errors
    const statusMatch = error.message.match(/status:\s*(\d+)/i);
    if (statusMatch) {
      const status = parseInt(statusMatch[1], 10);
      return retryableStatuses.includes(status);
    }
  }

  return false;
}

/**
 * Calculates delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const exponentialDelay = baseDelay * Math.pow(multiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  // Add jitter (±20%) to prevent thundering herd
  const jitter = cappedDelay * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}

/**
 * Sleeps for specified duration, respecting abort signal
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/**
 * Wraps an async function with retry logic
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetch('/api/data'),
 *   { maxRetries: 3, onRetry: (attempt, error) => console.log(`Retry ${attempt}`) }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries,
    baseDelay,
    maxDelay,
    backoffMultiplier,
    retryableStatuses,
  } = { ...DEFAULT_OPTIONS, ...options };

  const { onRetry, signal } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    // Check if aborted before each attempt
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if aborted
      if (lastError.name === 'AbortError') {
        throw lastError;
      }

      // Don't retry if we've exhausted attempts
      if (attempt > maxRetries) {
        break;
      }

      // Don't retry non-retryable errors
      if (!isRetryableError(lastError, retryableStatuses)) {
        break;
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, baseDelay, maxDelay, backoffMultiplier);

      // Notify about retry
      onRetry?.(attempt, lastError, delay);

      // Wait before retrying
      await sleep(delay, signal);
    }
  }

  throw lastError ?? new Error('Retry failed with unknown error');
}

/**
 * Creates a retry-wrapped fetch function
 *
 * @example
 * ```ts
 * const fetchWithRetry = createRetryFetch({ maxRetries: 3 });
 * const response = await fetchWithRetry('/api/data');
 * ```
 */
export function createRetryFetch(
  defaultOptions: RetryOptions = {}
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    return withRetry(
      async () => {
        const response = await fetch(input, init);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
      },
      {
        ...defaultOptions,
        signal: init?.signal ?? defaultOptions.signal,
      }
    );
  };
}

/**
 * Wraps a fetch call with retry, checking response.ok
 *
 * @example
 * ```ts
 * const response = await fetchWithRetry('/api/data', { method: 'POST' });
 * ```
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: RetryOptions = {}
): Promise<Response> {
  return withRetry(
    async () => {
      const response = await fetch(input, init);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    },
    {
      ...options,
      signal: init?.signal ?? options.signal,
    }
  );
}
