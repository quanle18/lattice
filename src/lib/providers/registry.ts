/**
 * Provider registry + orchestration.
 *
 * Runs every enabled provider in parallel with a bounded concurrency, then
 * normalises, deduplicates and reports per-provider status. A provider that
 * fails is reported as such — it never aborts the exploration.
 */

import type { ProviderReport, SourceRecord } from "../types";
import { OpenAlexProvider, CrossrefProvider, ArxivProvider } from "./academic";
import { GdeltProvider, GuardianProvider } from "./news";
import { WikipediaProvider, WorldBankProvider } from "./reference";
import type { DataPoint, ProviderQuery, ProviderResult, SourceProvider } from "./types";

export const ALL_PROVIDERS: SourceProvider[] = [
  new OpenAlexProvider(),
  new CrossrefProvider(),
  new ArxivProvider(),
  new WikipediaProvider(),
  new WorldBankProvider(),
  new GdeltProvider(),
  new GuardianProvider(),
];

export function enabledProviders(): SourceProvider[] {
  return ALL_PROVIDERS.filter((p) => {
    try {
      return p.isEnabled();
    } catch {
      return false;
    }
  });
}

export interface DiscoveryOutcome {
  sources: SourceRecord[];
  dataPoints: DataPoint[];
  reports: ProviderReport[];
}

/** Deduplicate by DOI, then by normalised URL, then by title. */
export function dedupeSources(sources: SourceRecord[]): SourceRecord[] {
  const byDoi = new Map<string, SourceRecord>();
  const byUrl = new Map<string, SourceRecord>();
  const byTitle = new Map<string, SourceRecord>();
  const out: SourceRecord[] = [];

  for (const s of sources) {
    const doi = s.doi?.toLowerCase();
    const url = s.url?.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
    const title = s.title.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim();

    if (doi && byDoi.has(doi)) continue;
    if (url && byUrl.has(url)) continue;
    if (title && byTitle.has(title)) continue;

    if (doi) byDoi.set(doi, s);
    if (url) byUrl.set(url, s);
    if (title) byTitle.set(title, s);
    out.push(s);
  }
  return out;
}

/** Rank discovered sources by quality tier, then recency. */
const QUALITY_RANK: Record<string, number> = {
  PRIMARY: 6,
  ACADEMIC: 5,
  "HIGH-QUALITY JOURNALISM": 4,
  SECONDARY: 3,
  "GENERAL REFERENCE": 2,
  "DEBATE / PERSPECTIVE": 1,
};

export function rankSources(sources: SourceRecord[]): SourceRecord[] {
  return sources.slice().sort((a, b) => {
    const q = (QUALITY_RANK[b.quality] ?? 0) - (QUALITY_RANK[a.quality] ?? 0);
    if (q !== 0) return q;
    return (b.date ?? "").localeCompare(a.date ?? "");
  });
}

async function withLimit<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (cursor < tasks.length) {
      const i = cursor++;
      results[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return results;
}

export async function discoverSources(query: ProviderQuery): Promise<DiscoveryOutcome> {
  const providers = enabledProviders();
  const reports: ProviderReport[] = [];
  const collected: SourceRecord[] = [];
  const dataPoints: DataPoint[] = [];

  if (providers.length === 0) {
    return {
      sources: [],
      dataPoints: [],
      reports: [
        {
          id: "none",
          label: "External providers",
          status: "skipped",
          resultCount: 0,
          message: "No external providers are enabled. Lattice is running in DEMO MODE using the internal library only.",
        },
      ],
    };
  }

  const tasks = providers.map((p) => async (): Promise<{ report: ProviderReport; result?: ProviderResult }> => {
    const started = Date.now();
    try {
      const result = await p.search(query);
      const count = result.sources.length + (result.dataPoints?.length ?? 0);
      return {
        result,
        report: {
          id: p.id,
          label: p.label,
          status: count > 0 ? "ok" : "empty",
          resultCount: result.sources.length,
          message: result.note,
        },
      };
    } catch (err) {
      return {
        report: {
          id: p.id,
          label: p.label,
          status: "unavailable",
          resultCount: 0,
          message: (err as Error).message,
        },
      };
    } finally {
      void started;
    }
  });

  const outcomes = await withLimit(tasks, 4);
  for (const o of outcomes) {
    reports.push(o.report);
    if (o.result) {
      collected.push(...o.result.sources);
      if (o.result.dataPoints) dataPoints.push(...o.result.dataPoints);
    }
  }

  const deduped = rankSources(dedupeSources(collected));
  return { sources: deduped, dataPoints, reports };
}

export function providerSummary(): Array<{ id: string; label: string; enabled: boolean; keyless: boolean; kind: string }> {
  return ALL_PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    enabled: (() => {
      try {
        return p.isEnabled();
      } catch {
        return false;
      }
    })(),
    keyless: p.keyless,
    kind: p.kind,
  }));
}
