/**
 * Shared HTTP helper for providers: timeout, bounded retry, JSON/XML parsing
 * and consistent error classification. Every provider goes through this so a
 * failing upstream degrades gracefully instead of hanging a request.
 */

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  /** Label used in error messages. */
  label?: string;
}

const DEFAULT_TIMEOUT = 8000;

export async function fetchWithTimeout(url: string, opts: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT, retries = 1, headers = {}, label = "request" } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          // Identify the client politely; several free APIs ask for this.
          "User-Agent": "Lattice/0.1 (knowledge-exploration; +https://github.com/)",
          Accept: "application/json, application/xml, text/xml, */*",
          ...headers,
        },
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        throw new ProviderError(`${label} returned HTTP ${res.status}`, res.status, retryable);
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      const retryable =
        (err as ProviderError).retryable ||
        (err as Error).name === "AbortError" ||
        (err as Error).name === "TypeError"; // network-level failure
      if (!retryable || attempt === retries) break;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }

  if (lastError instanceof ProviderError) throw lastError;
  const msg = (lastError as Error)?.name === "AbortError"
    ? `${label} timed out`
    : `${label} failed: ${(lastError as Error)?.message ?? "unknown error"}`;
  throw new ProviderError(msg, undefined, false);
}

export async function fetchJson<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const res = await fetchWithTimeout(url, opts);
  return (await res.json()) as T;
}

export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const res = await fetchWithTimeout(url, opts);
  return await res.text();
}

/** Bound a string for safe display. */
export function clip(s: string | undefined, n = 400): string | undefined {
  if (!s) return undefined;
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length <= n ? clean : `${clean.slice(0, n - 1)}…`;
}

/** Stable id from a provider + a natural key. */
export function providerId(provider: string, key: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${provider}-${(h >>> 0).toString(36)}`;
}
