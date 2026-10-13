/**
 * Keyless reference + official-statistics providers: Wikipedia and World Bank.
 *
 * Wikipedia gives general-reference context and concept relationships; the
 * World Bank gives primary statistical evidence. Both are free and keyless.
 */

import type { SourceRecord } from "../types";
import { config } from "../config";
import { cached } from "../cache/store";
import { clip, fetchJson, providerId } from "./http";
import type { DataPoint, ProviderQuery, ProviderResult, SourceProvider } from "./types";

// ── Wikipedia ────────────────────────────────────────────────────────────────

interface WikiSearchResponse {
  query?: { search?: Array<{ title: string; snippet?: string; pageid: number }> };
}

interface WikiSummary {
  title?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
  timestamp?: string;
}

export class WikipediaProvider implements SourceProvider {
  readonly id = "wikipedia";
  readonly label = "Wikipedia";
  readonly kind = "reference" as const;
  readonly keyless = true;

  isEnabled() {
    return config.providers.wikipedia;
  }

  async search(query: ProviderQuery): Promise<ProviderResult> {
    const q = query.queries[0] ?? query.topic;
    if (!q) return { sources: [] };
    const limit = query.limit ?? 5;

    const { value, cached: wasCached } = await cached(`wikipedia:${q}:${limit}`, 86400, async () => {
      const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${limit}&format=json&origin=*`;
      const search = await fetchJson<WikiSearchResponse>(searchUrl, { label: "Wikipedia" });
      const hits = search.query?.search ?? [];
      const out: Array<{ title: string; summary?: WikiSummary }> = [];
      for (const hit of hits.slice(0, 3)) {
        try {
          const s = await fetchJson<WikiSummary>(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`,
            { label: "Wikipedia" },
          );
          out.push({ title: hit.title, summary: s });
        } catch {
          out.push({ title: hit.title });
        }
      }
      return out;
    });

    const sources: SourceRecord[] = value.map((r) => ({
      id: providerId("wikipedia", r.title),
      title: r.title,
      publisher: "Wikipedia",
      date: r.summary?.timestamp?.slice(0, 10),
      url: r.summary?.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, "_"))}`,
      kind: "reference",
      quality: "GENERAL REFERENCE",
      topics: query.queries.slice(0, 3),
      tags: ["encyclopedia"],
      description: clip(r.summary?.extract, 400),
      origin: "provider",
      provider: "wikipedia",
      retrievedAt: new Date().toISOString(),
      verification: "verified",
    }));

    return { sources, note: wasCached ? "Served from cache." : undefined };
  }
}

// ── World Bank ───────────────────────────────────────────────────────────────

interface IndicatorSpec {
  code: string;
  label: string;
  unit?: string;
  /** Terms that activate this indicator. */
  triggers: string[];
}

/**
 * A small, extensible map from concepts to official indicators. We only query
 * indicators we can actually map — we never invent a statistic.
 */
const INDICATORS: IndicatorSpec[] = [
  { code: "NY.GDP.MKTP.CD", label: "GDP (current US$)", unit: "USD", triggers: ["gdp", "economic growth", "output", "economy"] },
  { code: "NY.GDP.PCAP.CD", label: "GDP per capita (current US$)", unit: "USD", triggers: ["income", "living standards", "development", "wealth"] },
  { code: "FP.CPI.TOTL.ZG", label: "Inflation, consumer prices (annual %)", unit: "%", triggers: ["inflation", "cost of living", "prices", "monetary"] },
  { code: "SL.UEM.TOTL.ZS", label: "Unemployment, total (% of labour force)", unit: "%", triggers: ["unemployment", "employment", "labour market", "labor market", "jobs"] },
  { code: "SL.TLF.CACT.ZS", label: "Labour force participation rate (%)", unit: "%", triggers: ["labour force", "labor force", "participation", "workforce"] },
  { code: "SI.DST.10TH.10", label: "Income share held by highest 10%", unit: "%", triggers: ["inequality", "income share", "distribution", "gini"] },
  { code: "EN.ATM.CO2E.PC", label: "CO2 emissions (metric tons per capita)", unit: "t", triggers: ["carbon emissions", "co2", "emissions", "climate change", "global warming"] },
  { code: "EG.ELC.RNEW.ZS", label: "Renewable electricity output (% of total)", unit: "%", triggers: ["renewable energy", "decarbonisation", "decarbonization", "clean energy", "solar", "wind"] },
  { code: "SP.POP.TOTL", label: "Population, total", unit: "people", triggers: ["population", "demographics", "demography"] },
  { code: "SE.XPD.TOTL.GD.ZS", label: "Government expenditure on education (% of GDP)", unit: "%", triggers: ["education", "schooling", "learning"] },
  { code: "SH.XPD.CHEX.GD.ZS", label: "Current health expenditure (% of GDP)", unit: "%", triggers: ["health", "healthcare", "medicine", "public health"] },
  { code: "NE.EXP.GNFS.ZS", label: "Exports of goods and services (% of GDP)", unit: "%", triggers: ["trade", "exports", "globalisation", "globalization", "comparative advantage"] },
  { code: "GB.XPD.RSDV.GD.ZS", label: "Research and development expenditure (% of GDP)", unit: "%", triggers: ["research and development", "r&d", "innovation", "technology"] },
];

const COUNTRY_ALIASES: Record<string, string> = {
  "united states": "USA", "united kingdom": "GBR", vietnam: "VNM", china: "CHN",
  india: "IND", japan: "JPN", germany: "DEU", france: "FRA", brazil: "BRA",
  "south korea": "KOR", indonesia: "IDN", nigeria: "NGA", "south africa": "ZAF",
  canada: "CAN", australia: "AUS", mexico: "MEX", russia: "RUS", turkey: "TUR",
  egypt: "EGY", thailand: "THA", philippines: "PHL", malaysia: "MYS",
};

interface WorldBankResponse extends Array<unknown> {
  0?: { page: number; pages: number; total: number };
  1?: Array<{ date: string; value: number | null; indicator?: { value?: string }; country?: { value?: string } }>;
}

export class WorldBankProvider implements SourceProvider {
  readonly id = "worldbank";
  readonly label = "World Bank Open Data";
  readonly kind = "data" as const;
  readonly keyless = true;

  isEnabled() {
    return config.providers.worldbank;
  }

  async search(query: ProviderQuery): Promise<ProviderResult> {
    const haystack = [...query.queries, query.topic].join(" ").toLowerCase();
    const matched = INDICATORS.filter((i) => i.triggers.some((t) => haystack.includes(t))).slice(0, 3);
    if (matched.length === 0) {
      return {
        sources: [],
        note: "No official indicator was mapped to these concepts. Lattice only queries statistics it can map honestly.",
      };
    }

    const location = query.locations.find((l) => COUNTRY_ALIASES[l.toLowerCase()]);
    const countryCode = location ? COUNTRY_ALIASES[location.toLowerCase()] : "WLD";
    const countryLabel = location ?? "World";

    const dataPoints: DataPoint[] = [];
    const sources: SourceRecord[] = [];

    for (const ind of matched) {
      try {
        const { value } = await cached(
          `worldbank:${countryCode}:${ind.code}`,
          86400,
          async () =>
            fetchJson<WorldBankResponse>(
              `https://api.worldbank.org/v2/country/${countryCode}/indicator/${ind.code}?format=json&per_page=10&date=2014:2024`,
              { label: "World Bank" },
            ),
        );
        const rows = (value?.[1] ?? []).filter((r) => r.value !== null);
        if (rows.length === 0) continue;
        const latest = rows[0];
        dataPoints.push({
          label: ind.label,
          value: formatNumber(latest.value as number),
          unit: ind.unit,
          year: Number(latest.date),
          country: countryLabel,
        });
        sources.push({
          id: providerId("worldbank", `${countryCode}:${ind.code}`),
          title: `${ind.label} — ${countryLabel}`,
          publisher: "World Bank Open Data",
          date: String(latest.date),
          url: `https://data.worldbank.org/indicator/${ind.code}?locations=${countryCode}`,
          kind: "data",
          quality: "PRIMARY",
          topics: query.queries.slice(0, 3),
          tags: ["official statistics", ind.code],
          description: `Official World Bank indicator for ${countryLabel}, most recent value ${formatNumber(latest.value as number)}${ind.unit ? ` ${ind.unit}` : ""} (${latest.date}).`,
          origin: "provider",
          provider: "worldbank",
          retrievedAt: new Date().toISOString(),
          verification: "verified",
        });
      } catch {
        /* one indicator failing must not fail the provider */
      }
    }

    return {
      sources,
      dataPoints,
      note: sources.length === 0 ? "The World Bank API returned no values for the mapped indicators." : undefined,
    };
  }
}

function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "n/a";
  if (Math.abs(n) >= 1_000_000_000_000) return `${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
