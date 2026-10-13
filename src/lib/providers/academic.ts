/**
 * Keyless academic providers: OpenAlex, Crossref, arXiv.
 * All three are free and require no API key — the backbone of LIVE MODE at $0.
 */

import type { SourceRecord } from "../types";
import { config } from "../config";
import { cached } from "../cache/store";
import { clip, fetchJson, fetchText, providerId } from "./http";
import type { ProviderQuery, ProviderResult, SourceProvider } from "./types";
import { XMLParser } from "fast-xml-parser";

// ── OpenAlex ─────────────────────────────────────────────────────────────────

interface OpenAlexWork {
  id: string;
  display_name?: string;
  title?: string;
  publication_year?: number;
  doi?: string;
  type?: string;
  authorships?: Array<{ author?: { display_name?: string } }>;
  primary_location?: { source?: { display_name?: string } };
  abstract_inverted_index?: Record<string, number[]> | null;
}

function reconstructAbstract(idx?: Record<string, number[]> | null): string | undefined {
  if (!idx) return undefined;
  const slots: Array<{ pos: number; word: string }> = [];
  for (const [word, positions] of Object.entries(idx)) {
    for (const p of positions) slots.push({ pos: p, word });
  }
  slots.sort((a, b) => a.pos - b.pos);
  return clip(slots.map((s) => s.word).join(" "), 400);
}

export class OpenAlexProvider implements SourceProvider {
  readonly id = "openalex";
  readonly label = "OpenAlex";
  readonly kind = "academic" as const;
  readonly keyless = true;

  isEnabled() {
    return config.providers.openalex;
  }

  async search(query: ProviderQuery): Promise<ProviderResult> {
    const q = query.queries[0] ?? query.topic;
    if (!q) return { sources: [] };
    const limit = query.limit ?? 8;
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${limit}&sort=relevance_score:desc&mailto=lattice-demo@example.com`;

    const { value, cached: wasCached } = await cached(`openalex:${q}:${limit}`, 86400, async () => {
      const data = await fetchJson<{ results?: OpenAlexWork[] }>(url, { label: "OpenAlex" });
      return data.results ?? [];
    });

    const sources: SourceRecord[] = value
      .filter((w) => w.display_name || w.title)
      .map((w) => ({
        id: providerId("openalex", w.id ?? w.doi ?? w.display_name ?? ""),
        title: (w.display_name ?? w.title ?? "Untitled work").trim(),
        publisher: w.primary_location?.source?.display_name ?? "OpenAlex record",
        author: w.authorships?.[0]?.author?.display_name,
        date: w.publication_year ? String(w.publication_year) : undefined,
        url: w.doi ? (w.doi.startsWith("http") ? w.doi : `https://doi.org/${w.doi}`) : `https://openalex.org/${(w.id ?? "").replace("https://openalex.org/", "")}`,
        kind: "academic",
        quality: "ACADEMIC",
        topics: query.queries.slice(0, 3),
        tags: w.type ? [w.type] : [],
        description: reconstructAbstract(w.abstract_inverted_index),
        doi: w.doi,
        origin: "provider",
        provider: "openalex",
        retrievedAt: new Date().toISOString(),
        verification: "verified",
      }));

    return { sources, note: wasCached ? "Served from cache." : undefined };
  }
}

// ── Crossref ─────────────────────────────────────────────────────────────────

interface CrossrefItem {
  DOI?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  "container-title"?: string[];
  publisher?: string;
  issued?: { "date-parts"?: number[][] };
  abstract?: string;
  type?: string;
}

export class CrossrefProvider implements SourceProvider {
  readonly id = "crossref";
  readonly label = "Crossref";
  readonly kind = "academic" as const;
  readonly keyless = true;

  isEnabled() {
    return config.providers.crossref;
  }

  async search(query: ProviderQuery): Promise<ProviderResult> {
    const q = query.queries[0] ?? query.topic;
    if (!q) return { sources: [] };
    const limit = query.limit ?? 8;
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${limit}&select=DOI,title,author,container-title,publisher,issued,abstract,type&mailto=lattice-demo@example.com`;

    const { value, cached: wasCached } = await cached(`crossref:${q}:${limit}`, 86400, async () => {
      const data = await fetchJson<{ message?: { items?: CrossrefItem[] } }>(url, { label: "Crossref" });
      return data.message?.items ?? [];
    });

    const sources: SourceRecord[] = value
      .filter((i) => i.title?.[0])
      .map((i) => {
        const year = i.issued?.["date-parts"]?.[0]?.[0];
        return {
          id: providerId("crossref", i.DOI ?? i.title?.[0] ?? ""),
          title: (i.title?.[0] ?? "Untitled").trim(),
          publisher: i["container-title"]?.[0] ?? i.publisher ?? "Crossref record",
          author: i.author?.[0]
            ? [i.author[0].given, i.author[0].family].filter(Boolean).join(" ")
            : undefined,
          date: year ? String(year) : undefined,
          url: i.DOI ? `https://doi.org/${i.DOI}` : "",
          kind: "academic",
          quality: "ACADEMIC",
          topics: query.queries.slice(0, 3),
          tags: i.type ? [i.type] : [],
          description: clip(i.abstract?.replace(/<[^>]+>/g, " "), 400),
          doi: i.DOI,
          origin: "provider",
          provider: "crossref",
          retrievedAt: new Date().toISOString(),
          verification: "verified",
        };
      });

    return { sources, note: wasCached ? "Served from cache." : undefined };
  }
}

// ── arXiv ────────────────────────────────────────────────────────────────────

export class ArxivProvider implements SourceProvider {
  readonly id = "arxiv";
  readonly label = "arXiv";
  readonly kind = "academic" as const;
  readonly keyless = true;

  isEnabled() {
    return config.providers.arxiv;
  }

  async search(query: ProviderQuery): Promise<ProviderResult> {
    const q = query.queries[0] ?? query.topic;
    if (!q) return { sources: [] };
    const limit = query.limit ?? 6;
    // arXiv reads `all:"a b c"` as an exact phrase, so a multi-word topic
    // matches nothing at all. Search the concept phrases individually instead.
    const terms = (query.queries.length ? query.queries : [q])
      .map((t) => t.trim())
      .filter((t) => t.length > 2)
      .slice(0, 3);
    const searchExpr = terms.length
      ? terms.map((t) => `all:"${t}"`).join(" OR ")
      : `all:"${q}"`;
    const url = `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchExpr)}&start=0&max_results=${limit}&sortBy=relevance`;

    const { value, cached: wasCached } = await cached(`arxiv:${q}:${limit}`, 86400, async () => {
      const xml = await fetchText(url, { label: "arXiv" });
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@" });
      const parsed = parser.parse(xml) as {
        feed?: { entry?: unknown | unknown[] };
      };
      const entries = parsed.feed?.entry;
      if (!entries) return [];
      return Array.isArray(entries) ? entries : [entries];
    });

    const sources: SourceRecord[] = value
      .map((raw): SourceRecord | null => {
        const e = raw as Record<string, unknown>;
        const title = typeof e.title === "string" ? e.title.replace(/\s+/g, " ").trim() : "";
        if (!title) return null;
        const links = e.link as unknown;
        const linkArr = Array.isArray(links) ? links : links ? [links] : [];
        const abs = linkArr.find((l) => (l as Record<string, string>)["@rel"] === "alternate");
        const url = (abs as Record<string, string> | undefined)?.["@href"] ?? "";
        const authorRaw = e.author as unknown;
        const authors = Array.isArray(authorRaw) ? authorRaw : authorRaw ? [authorRaw] : [];
        const firstAuthor = (authors[0] as { name?: string } | undefined)?.name;
        const published = typeof e.published === "string" ? e.published.slice(0, 10) : undefined;
        const summary = typeof e.summary === "string" ? clip(e.summary.replace(/\s+/g, " "), 400) : undefined;
        const record: SourceRecord = {
          id: providerId("arxiv", url || title),
          title,
          publisher: "arXiv (preprint)",
          author: firstAuthor,
          date: published,
          url,
          kind: "academic" as const,
          quality: "ACADEMIC" as const,
          topics: query.queries.slice(0, 3),
          tags: ["preprint"],
          description: summary,
          origin: "provider" as const,
          provider: "arxiv",
          retrievedAt: new Date().toISOString(),
          verification: "verified",
        };
        return record;
      })
      .filter((s): s is SourceRecord => s !== null);

    return { sources, note: wasCached ? "Served from cache." : undefined };
  }
}
