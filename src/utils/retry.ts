import { RateLimitError } from "./errors";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof RateLimitError && i < maxRetries - 1) {
        const waitTime = error.retryAfter ? error.retryAfter * 1000 : delay;
        console.log(
          `Rate limited. Retrying in ${waitTime}ms... (attempt ${i + 1}/${maxRetries})`,
        );
        await sleep(waitTime);
        delay *= 2; // Exponential backoff
      } else if (i < maxRetries - 1) {
        console.log(
          `Error occurred. Retrying in ${delay}ms... (attempt ${i + 1}/${maxRetries})`,
        );
        await sleep(delay);
        delay *= 2;
      } else {
        throw error;
      }
    }
  }

  throw lastError || new Error("Max retries exceeded");
}
