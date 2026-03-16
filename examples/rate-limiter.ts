/**
 * Simple token-bucket rate limiter for API endpoints
 */

interface RateLimitConfig {
  maxTokens: number;
  refillRate: number; // tokens per second
  refillInterval: number; // ms
}

interface BucketState {
  tokens: number;
  lastRefill: number;
}

const buckets: Map<string, BucketState> = new Map();

const DEFAULT_CONFIG: RateLimitConfig = {
  maxTokens: 100,
  refillRate: 10,
  refillInterval: 1000,
};

/**
 * Refill tokens based on elapsed time
 */
function refillBucket(bucket: BucketState, config: RateLimitConfig): void {
  const now = Date.now();
  const elapsed = now - bucket.lastRefill;
  const tokensToAdd = Math.floor(elapsed / config.refillInterval) * config.refillRate;

  if (tokensToAdd > 0) {
    bucket.tokens = Math.min(config.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }
}

/**
 * Check if request is allowed and consume a token
 */
export function isAllowed(
  clientId: string,
  config: RateLimitConfig = DEFAULT_CONFIG,
): boolean {
  let bucket = buckets.get(clientId);

  if (!bucket) {
    bucket = { tokens: config.maxTokens, lastRefill: Date.now() };
    buckets.set(clientId, bucket);
  }

  refillBucket(bucket, config);

  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }

  return false;
}

/**
 * Get remaining tokens for a client
 */
export function getRemainingTokens(clientId: string): number {
  const bucket = buckets.get(clientId);
  return bucket ? bucket.tokens : DEFAULT_CONFIG.maxTokens;
}

/**
 * Reset rate limit for a client
 */
export function resetLimit(clientId: string): void {
  buckets.delete(clientId);
}

/**
 * Express-style middleware
 */
export function rateLimitMiddleware(config?: Partial<RateLimitConfig>) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  return (req: any, res: any, next: any) => {
    const clientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';

    if (isAllowed(clientId, mergedConfig)) {
      res.setHeader('X-RateLimit-Remaining', getRemainingTokens(clientId));
      next();
    } else {
      res.status(429).json({
        error: 'Too Many Requests',
        retryAfter: Math.ceil(mergedConfig.refillInterval / 1000),
      });
    }
  };
}
