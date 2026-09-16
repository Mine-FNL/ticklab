/**
 * Per-IP token-bucket rate limiter for API routes.
 *
 * Production note: in-memory buckets are per-instance. For a single-node
 * deployment this is sufficient. For horizontally scaled deployments use a
 * shared store (Redis / Upstash) keyed by `(ip, route)`.
 */

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitConfig {
  /** Maximum burst tokens (capacity). */
  capacity: number;
  /** Tokens added per millisecond (so capacity / refillRate = ms to refill fully). */
  refillPerMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Try to consume 1 token for the (key, route) pair.
 * Returns allowed=false with retryAfterMs when the bucket is empty.
 */
export function consume(key: string, cfg: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: cfg.capacity, lastRefillMs: now };
    buckets.set(key, bucket);
  } else {
    const elapsed = now - bucket.lastRefillMs;
    if (elapsed > 0) {
      bucket.tokens = Math.min(cfg.capacity, bucket.tokens + elapsed * cfg.refillPerMs);
      bucket.lastRefillMs = now;
    }
  }
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
  }
  const deficit = 1 - bucket.tokens;
  const retryAfterMs = Math.ceil(deficit / cfg.refillPerMs);
  return { allowed: false, remaining: 0, retryAfterMs };
}

/** Extract best-effort client IP from a NextRequest (honors x-forwarded-for). */
export function clientIp(request: { headers: Headers }): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}

/** Standard rate-limit presets. Tuned for research-tool usage. */
export const RateLimitPresets = {
  /** Read endpoints — generous, but still capped. */
  read: { capacity: 120, refillPerMs: 120 / 60_000 }, // 120/min
  /** Heavy endpoints (simulate / backtest). */
  compute: { capacity: 30, refillPerMs: 30 / 60_000 }, // 30/min
  /** Discovery endpoints — many external RPC calls. */
  discover: { capacity: 30, refillPerMs: 30 / 60_000 },
} as const satisfies Record<string, RateLimitConfig>;