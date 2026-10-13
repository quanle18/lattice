/**
 * Rate limiting + usage/cost tracking.
 *
 * Rate limiting is in-process (per instance). For multi-instance deployments
 * put a shared store (Upstash, Redis, Supabase) behind `checkRateLimit` — the
 * interface is intentionally small.
 *
 * Cost tracking records zeros for deterministic work: the whole point is that
 * a basic exploration costs nothing, and the dashboard should show that.
 */

import { config } from "./config";
import { cacheStats, cacheHitRate } from "./cache/store";
import type { UsageRecord } from "./types";

// ── Rate limiting ────────────────────────────────────────────────────────────

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

export function checkRateLimit(key: string, limitPerMin = config.limits.rateLimitPerMin): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now > existing.resetAt) {
    const bucket = { count: 1, resetAt: now + 60_000 };
    buckets.set(key, bucket);
    return { allowed: true, remaining: limitPerMin - 1, resetAt: bucket.resetAt, limit: limitPerMin };
  }
  existing.count++;
  const allowed = existing.count <= limitPerMin;
  return {
    allowed,
    remaining: Math.max(0, limitPerMin - existing.count),
    resetAt: existing.resetAt,
    limit: limitPerMin,
  };
}

/** Opportunistic cleanup so the map cannot grow unbounded. */
export function pruneRateLimits(): void {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.resetAt) buckets.delete(k);
}

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "anonymous";
}

// ── Usage / cost tracking ────────────────────────────────────────────────────

export interface UsageInput {
  userId: string;
  feature: string;
  aiCalls?: number;
  searchCalls?: number;
  embeddingCalls?: number;
  inputTokens?: number;
  outputTokens?: number;
  processingTimeMs?: number;
  cacheHit?: boolean;
  /** Estimated cost in USD. Deterministic work is 0. */
  estimatedCost?: number;
}

export function toUsageRecord(input: UsageInput): UsageRecord {
  return {
    userId: input.userId,
    feature: input.feature,
    aiCalls: input.aiCalls ?? 0,
    searchCalls: input.searchCalls ?? 0,
    embeddingCalls: input.embeddingCalls ?? 0,
    inputTokens: input.inputTokens ?? 0,
    outputTokens: input.outputTokens ?? 0,
    estimatedCost: input.estimatedCost ?? 0,
    processingTimeMs: input.processingTimeMs ?? 0,
    cacheHit: input.cacheHit ?? false,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Rough cost model. Only AI calls carry cost; every other feature is free by
 * construction. Kept in one place so the number is auditable.
 */
export const COST_MODEL = {
  aiInputPer1kTokens: 0.0005,
  aiOutputPer1kTokens: 0.0015,
  searchPerCall: 0,
  embeddingPerCall: 0,
};

export function estimateCost(input: { inputTokens?: number; outputTokens?: number }): number {
  return (
    ((input.inputTokens ?? 0) / 1000) * COST_MODEL.aiInputPer1kTokens +
    ((input.outputTokens ?? 0) / 1000) * COST_MODEL.aiOutputPer1kTokens
  );
}

export function internalMetrics() {
  const c = cacheStats();
  return {
    cache: { ...c, hitRate: Number(cacheHitRate().toFixed(3)) },
    rateLimitBuckets: buckets.size,
    aiEnabled: config.ai.enabled,
    costModel: COST_MODEL,
  };
}
