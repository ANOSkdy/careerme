const buckets = new Map<string, number[]>();

export type RateLimitCheck = {
  allowed: boolean;
  remaining: number;
  reset: number;
};

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export function checkRateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitCheck {
  const now = Date.now();
  const windowStart = now - windowMs;
  const timestamps = buckets.get(key) ?? [];
  const filtered = timestamps.filter((timestamp) => timestamp > windowStart);

  if (filtered.length >= limit) {
    const reset = filtered[0] + windowMs;
    buckets.set(key, filtered);
    return {
      allowed: false,
      remaining: 0,
      reset,
    };
  }

  filtered.push(now);
  buckets.set(key, filtered);

  return {
    allowed: true,
    remaining: Math.max(0, limit - filtered.length),
    reset: filtered[0] + windowMs,
  };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}
