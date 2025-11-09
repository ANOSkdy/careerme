const WINDOW_MS = 60 * 60 * 1000;

export type RateLimitResult = {
  limited: boolean;
  remaining: number;
  limit: number;
  retryAfterMs: number | null;
};

const buckets = new Map<string, number[]>();

function prune(now: number, timestamps: number[], windowMs: number): number[] {
  if (!timestamps.length) return timestamps;
  const threshold = now - windowMs;
  let firstValidIndex = 0;
  for (; firstValidIndex < timestamps.length; firstValidIndex += 1) {
    if (timestamps[firstValidIndex] > threshold) {
      break;
    }
  }
  if (firstValidIndex === 0) return timestamps;
  return timestamps.slice(firstValidIndex);
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number = WINDOW_MS
): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key) ?? [];
  const pruned = prune(now, existing, windowMs);

  if (pruned.length >= limit) {
    const retryAfterMs = Math.max(pruned[0] + windowMs - now, 0);
    buckets.set(key, pruned);
    return {
      limited: true,
      remaining: 0,
      limit,
      retryAfterMs,
    };
  }

  pruned.push(now);
  buckets.set(key, pruned);

  return {
    limited: false,
    remaining: Math.max(limit - pruned.length, 0),
    limit,
    retryAfterMs: null,
  };
}

export function getRateLimitState(key: string): number {
  return buckets.get(key)?.length ?? 0;
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}
