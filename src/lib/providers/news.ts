/**
 * News providers: GDELT (keyless global news index) and The Guardian
 * (free developer key, optional).
 *
 * Only metadata and short snippets are stored — never full article text —
 * and every record links to the publisher's own page.
 */

import type { SourceRecord } from "../types";
import { config } from "../config";
import { cached } from "../cache/store";
import { clip, fetchJson, fetchText, providerId } from "./http";
import type { ProviderQuery, ProviderResult, SourceProvider } from "./types";

// ── GDELT ────────────────────────────────────────────────────────────────────

interface GdeltArticle {
  url: string;
  title: string;
  seendate?: string;
  domain?: string;
  sourcecountry?: string;
  language?: string;
}

/**
 * GDELT permits roughly one query every 5 seconds and answers excess calls
 * with a plain-text notice. Space our own calls out so a burst of explores
 * cannot poison the cache with failures.
 */
let gdeltLastCall = 0;
async function gdeltThrottle(): Promise<void> {
  const wait = 5000 - (Date.now() - gdeltLastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  gdeltLastCall = Date.now();
}

export class GdeltProvider implements SourceProvider {
  readonly id = "gdelt";
  readonly label = "GDELT Global News";
  readonly kind = "news" as const;
  readonly keyless = true;

  isEnabled() {
    return config.providers.gdelt;
  }

  async search(query: ProviderQuery): Promise<ProviderResult> {
    const q = query.queries[0] ?? query.topic;
    if (!q) return { sources: [] };
    const limit = query.limit ?? 8;
    // GDELT ANDs bare terms together, so stop-words like "and"/"in" make the
    // expression unsatisfiable. Use the concept phrases, OR'd instead.
    const terms = (query.queries.length ? query.queries : [q])
      .map((t) => t.trim())
      .filter((t) => t.length > 2)
      .slice(0, 4);
    const expr = terms.map((t) => `"${t}"`).join(" OR ");
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(expr)}&mode=artlist&format=json&maxrecords=${limit}&timespan=3m&sort=datedesc`;

    const { value, cached: wasCached } = await cached(`gdelt:${expr}:${limit}`, 3600, async () => {
      await gdeltThrottle();
      // GDELT answers rate-limit and error conditions with PLAIN TEXT, not
      // JSON. Surface that honestly instead of reporting "no articles".
      const body = (await fetchText(url, { label: "GDELT" })).trim();
      if (!body.startsWith("{") && !body.startsWith("[")) {
        throw new Error(
          /limit requests/i.test(body)
            ? "GDELT rate-limited this request (it permits one query every 5 seconds)."
            : `GDELT returned a non-JSON response: ${clip(body, 120) ?? ""}`,
        );
      }
      const data = JSON.parse(body) as { articles?: GdeltArticle[] };
      return data.articles ?? [];
    });

    const sources: SourceRecord[] = value
      .filter((a) => a.title && a.url)
      .map((a) => ({
        id: providerId("gdelt", a.url),
        title: a.title.trim(),
        publisher: a.domain ?? "Unknown publisher",
        date: a.seendate ? formatGdeltDate(a.seendate) : undefined,
        url: a.url,
        kind: "news",
        quality: "HIGH-QUALITY JOURNALISM",
        topics: query.queries.slice(0, 3),
        tags: a.sourcecountry ? [a.sourcecountry.toLowerCase()] : [],
        description: clip(`${a.title} — ${a.domain ?? "news"}. Metadata indexed by GDELT; open the original article for full content.`, 300),
        origin: "provider",
        provider: "gdelt",
        retrievedAt: new Date().toISOString(),
        verification: "metadata-only",
      }));

    return {
      sources,
      note: wasCached
        ? "Served from cache."
        : sources.length === 0
          ? "GDELT returned no recent articles for this query."
          : undefined,
    };
  }
}

function formatGdeltDate(s: string): string | undefined {
  // GDELT uses YYYYMMDDHHMMSS
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

// ── The Guardian ─────────────────────────────────────────────────────────────

interface GuardianItem {
  id: string;
  webTitle: string;
  webUrl: string;
  sectionName?: string;
  webPublicationDate?: string;
  fields?: { trailText?: string; byline?: string };
}

export class GuardianProvider implements SourceProvider {
  readonly id = "guardian";
  readonly label = "The Guardian";
  readonly kind = "news" as const;
  readonly keyless = false;

  isEnabled() {
    return config.providers.guardianKey !== "";
  }

  async search(query: ProviderQuery): Promise<ProviderResult> {
    const key = config.providers.guardianKey;
    if (!key) {
      return {
        sources: [],
        note: "The Guardian requires a free API key (GUARDIAN_API_KEY). Without it, this provider is skipped.",
      };
    }
    const q = query.queries[0] ?? query.topic;
    if (!q) return { sources: [] };
    const limit = query.limit ?? 8;
    const url = `https://content.guardianapis.com/search?q=${encodeURIComponent(q)}&page-size=${limit}&show-fields=trailText,byline&api-key=${encodeURIComponent(key)}`;

    const { value, cached: wasCached } = await cached(`guardian:${q}:${limit}`, 3600, async () => {
      const data = await fetchJson<{ response?: { results?: GuardianItem[] } }>(url, { label: "The Guardian" });
      return data.response?.results ?? [];
    });

    const sources: SourceRecord[] = value.map((a) => ({
      id: providerId("guardian", a.id),
      title: a.webTitle,
      publisher: "The Guardian",
      author: a.fields?.byline,
      date: a.webPublicationDate?.slice(0, 10),
      url: a.webUrl,
      kind: "news",
      quality: "HIGH-QUALITY JOURNALISM",
      topics: query.queries.slice(0, 3),
      tags: a.sectionName ? [a.sectionName.toLowerCase()] : [],
      description: clip(a.fields?.trailText?.replace(/<[^>]+>/g, " "), 300),
      origin: "provider",
      provider: "guardian",
      retrievedAt: new Date().toISOString(),
      verification: "metadata-only",
    }));

    return { sources, note: wasCached ? "Served from cache." : undefined };
  }
}
