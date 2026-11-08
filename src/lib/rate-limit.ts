/**
 * Sliding-window rate limiter.
 *
 * In-memory, so it limits per server instance. That's enough to stop one
 * client from running up the AI bill on a single-instance deploy. For multiple
 * instances, swap the Map for Redis (e.g. a sorted set per key).
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the next request is allowed (0 when allowed). */
  retryAfter: number;
}

export function createRateLimiter({
  limit,
  windowMs,
  now = () => Date.now(),
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const hits = new Map<string, number[]>();

  return function check(key: string): RateLimitResult {
    const t = now();
    const recent = (hits.get(key) ?? []).filter((ts) => t - ts < windowMs);

    if (recent.length >= limit) {
      hits.set(key, recent);
      const retryAfter = Math.ceil((recent[0] + windowMs - t) / 1000);
      return { allowed: false, remaining: 0, retryAfter };
    }

    recent.push(t);
    hits.set(key, recent);

    // Opportunistic cleanup so the map doesn't grow forever.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) {
        if (v.every((ts) => t - ts >= windowMs)) hits.delete(k);
      }
    }

    return { allowed: true, remaining: limit - recent.length, retryAfter: 0 };
  };
}

/** Best-effort client IP from common proxy headers. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
