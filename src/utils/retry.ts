export type RetryOptions = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
};

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs = 30000 } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isRetryable(error)) {
        throw error;
      }

      const delay = Math.min(baseDelayMs * 2 ** attempt + jitter(), maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("429") || msg.includes("rate limit")) return true;
    if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504"))
      return true;
    if (msg.includes("econnreset") || msg.includes("timeout")) return true;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code: number }).code;
    if (code === 429 || (code >= 500 && code < 600)) return true;
  }

  return false;
}

function jitter(): number {
  return Math.random() * 200;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
