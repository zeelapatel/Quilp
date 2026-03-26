export interface RetryConfig {
  maxAttempts: number;
  backoffBase: number; // ms
}

export const RETRY_CONFIGS = {
  rate_limited: {
    maxAttempts: 5,
    backoffBase: 30_000
  },
  token_expired: {
    maxAttempts: 2,
    backoffBase: 0
  },
  server_error: {
    maxAttempts: 3,
    backoffBase: 10_000
  }
} as const satisfies Record<string, RetryConfig>;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === config.maxAttempts) break;

      // Exponential backoff with jitter.
      const delay =
        config.backoffBase *
        Math.pow(2, attempt - 1) *
        (0.5 + Math.random() * 0.5);

      console.warn(
        `Attempt ${attempt} failed — retrying in ${Math.round(
          delay / 1000
        )}s`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

