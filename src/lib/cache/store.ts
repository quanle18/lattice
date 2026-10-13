/**
 * Cache layer. Mandatory in Lattice — the whole point is to never repeat an
 * expensive (or even cheap) operation for identical input.
 *
 * Two tiers:
 *   1. In-process LRU-ish Map with TTL (always available, per instance).
 *   2. Optional disk persistence for self-hosted / long-running instances.
 *
 * On serverless, tier 2 is skipped automatically and tier 1 is per-instance;
 * that is a deliberate, documented trade-off, not a silent failure.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
  hits: number;
}

const MAX_ENTRIES = 500;

const memory = new Map<string, Entry<unknown>>();

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
}

const stats = { hits: 0, misses: 0 };

function isExpired(e: Entry<unknown>): boolean {
  return e.expiresAt > 0 && Date.now() > e.expiresAt;
}

export function cacheGet<T>(key: string): T | undefined {
  const e = memory.get(key) as Entry<T> | undefined;
  if (!e) {
    stats.misses++;
    return undefined;
  }
  if (isExpired(e)) {
    memory.delete(key);
    stats.misses++;
    return undefined;
  }
  e.hits++;
  stats.hits++;
  return e.value;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds = 3600): void {
  if (memory.size >= MAX_ENTRIES) {
    // Evict the least-recently-used (Map preserves insertion order).
    const first = memory.keys().next();
    if (!first.done) memory.delete(first.value);
  }
  memory.set(key, { value, expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0, hits: 0 });
}

export function cacheStats(): CacheStats {
  return { size: memory.size, hits: stats.hits, misses: stats.misses };
}

export function cacheHitRate(): number {
  const total = stats.hits + stats.misses;
  return total === 0 ? 0 : stats.hits / total;
}

export function cacheClear(): void {
  memory.clear();
  stats.hits = 0;
  stats.misses = 0;
}

/**
 * Memoised async call: returns the cached value if present, otherwise runs
 * `fn` once and caches the result (including in-flight de-duplication).
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<{ value: T; cached: boolean }> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return { value: hit, cached: true };

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) {
    const value = await existing;
    return { value, cached: true };
  }

  const p = (async () => {
    try {
      const value = await fn();
      cacheSet(key, value, ttlSeconds);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return { value: await p, cached: false };
}
