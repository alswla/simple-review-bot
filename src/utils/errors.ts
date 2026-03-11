export class PRLensError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
    this.name = "PRLensError";
  }
}

export class ProviderError extends PRLensError {
  constructor(provider: string, message: string) {
    super(`[${provider}] ${message}`, "PROVIDER_ERROR");
  }
}

export class RateLimitError extends PRLensError {
  constructor(public retryAfter?: number) {
    super(
      `Rate limit exceeded.${retryAfter ? ` Retry after ${retryAfter}s` : ""}`,
      "RATE_LIMIT",
    );
  }
}
