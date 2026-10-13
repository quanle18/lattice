/**
 * Exploration orchestrator — the single entry point used by every API route.
 *
 * Pipeline:
 *   text → analyze (local) → recommend (deterministic) → discover (providers)
 *        → perspectives → knowledge map → next steps
 *
 * Everything is cached by content hash + provider configuration, so repeating
 * the same exploration is free and instant.
 */

import { cached } from "../cache/store";
import { runtimeMode } from "../config";
import { loadLibrary } from "../kb/repository";
import { analyzeText, type KnowledgeContext } from "../nlp/analyze";
import { buildTfIdf } from "../nlp/keywords";
import { hashEmbed } from "../nlp/embed";
import { buildKnowledgeMap } from "../recommend/map";
import { buildNextExplorations } from "../recommend/next";
import { buildPerspectives } from "../recommend/perspectives";
import { recommend, DEFAULT_WEIGHTS } from "../recommend/engine";
import { discoverSources } from "../providers/registry";
import type {
  CaseRecord,
  ExplorationResult,
  IdeaRecord,
  ProviderReport,
  SourceRecord,
} from "../types";

export interface ExploreInput {
  text: string;
  kind: "topic" | "text" | "file" | "url";
  label: string;
  documentTitle?: string;
  documentType?: string;
  sourceName?: string;
  url?: string;
  /** Skip external discovery (used for instant previews). */
  offline?: boolean;
}

let counter = 0;
function explorationId(): string {
  counter = (counter + 1) % 1_000_000;
  return `exp_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function knowledgeContext(): KnowledgeContext {
  const lib = loadLibrary();
  return {
    knownConcepts: lib.knownConcepts,
    kbRelations: lib.conceptRelations,
    idfModel: buildTfIdf(lib.corpus.length > 0 ? lib.corpus : ["lattice"]),
  };
}

/**
 * For a short topic/query (rather than a document) we still run the full
 * pipeline — the query text itself is the material. This keeps behaviour
 * uniform: a topic is just a very short document.
 */
export async function explore(input: ExploreInput): Promise<ExplorationResult> {
  const lib = loadLibrary();
  const mode = runtimeMode();

  const analysis = analyzeText(input.text, {
    ...knowledgeContext(),
    documentTitle: input.documentTitle ?? input.label,
    documentType: input.documentType ?? (input.kind === "topic" ? "topic" : "text"),
    inputKind: input.kind,
  });

  const queryVector = hashEmbed(
    `${analysis.mainTopic} ${analysis.topics.join(" ")} ${analysis.concepts.slice(0, 12).map((c) => c.label).join(" ")}`,
  );

  const scoreCtx = {
    analysis,
    weights: DEFAULT_WEIGHTS,
    queryVector,
    embed: hashEmbed,
  };

  const cases = recommend<CaseRecord>(
    lib.cases.map((c) => ({ ...c, text: [c.title, c.shortDescription, c.longDescription, c.topics, c.tags, c.relatedConcepts].flat().filter(Boolean).join(" ") })),
    scoreCtx,
    { limit: 6 },
  );

  const ideas = recommend<IdeaRecord>(
    lib.ideas.map((i) => ({ ...i, text: [i.title, i.description, i.topics, i.tags].flat().filter(Boolean).join(" ") })),
    scoreCtx,
    { limit: 6 },
  );

  // Internal library sources are scored the same way as cases and ideas.
  const librarySources = recommend<SourceRecord>(
    lib.sources.map((s) => ({
      ...s,
      quality: s.quality,
      text: [s.title, s.description, s.topics, s.tags].flat().filter(Boolean).join(" "),
    })),
    scoreCtx,
    { limit: 5, minScore: 0.5 },
  );

  // ── External discovery ────────────────────────────────────────────────────
  const providers: ProviderReport[] = [];
  let externalSources: SourceRecord[] = [];
  let dataPoints: import("../types").DataPoint[] = [];

  if (!input.offline && mode === "live") {
    const queries = analysis.queries.length > 0 ? analysis.queries : [analysis.mainTopic];
    try {
      const outcome = await discoverSources({
        queries,
        topic: analysis.mainTopic,
        locations: analysis.entities.LOCATION.slice(0, 3),
        limit: 8,
      });
      externalSources = outcome.sources;
      dataPoints = outcome.dataPoints;
      providers.push(...outcome.reports);
    } catch (err) {
      providers.push({
        id: "discovery",
        label: "Source discovery",
        status: "error",
        resultCount: 0,
        message: (err as Error).message,
      });
    }
  } else if (input.offline) {
    providers.push({
      id: "discovery",
      label: "Source discovery",
      status: "skipped",
      resultCount: 0,
      message: "External discovery was skipped for this request.",
    });
  }

  // Score external sources against the document so the strongest come first.
  const scoredExternal = externalSources.length
    ? recommend<SourceRecord>(
        externalSources.map((s) => ({
          ...s,
          quality: s.quality,
          text: [s.title, s.description, s.topics, s.tags].flat().filter(Boolean).join(" "),
        })),
        scoreCtx,
        { limit: 12, minScore: 0 },
      )
    : [];

  const allSources = [
    ...librarySources.map((r) => ({ ...r, reasons: [...r.reasons, "From the internal library."] })),
    ...scoredExternal.map((r) => ({ ...r, reasons: [...r.reasons, `Retrieved live from ${r.item.provider ?? "an external provider"}.`] })),
  ];

  // ── Perspectives, map, next steps ─────────────────────────────────────────
  const perspectives = buildPerspectives(analysis);
  const map = buildKnowledgeMap(analysis);
  const next = buildNextExplorations({ analysis, ideas, cases, perspectiveGroups: perspectives.groups });

  const warnings = [...analysis.warnings];
  if (mode === "demo") {
    warnings.push(
      "Running in DEMO MODE: results come from the internal demonstration library only. No external sources were contacted.",
    );
  }
  if (externalSources.length === 0 && mode === "live") {
    warnings.push(
      "No external sources were retrieved for this material. This does not mean the topic is unsupported — it means the configured providers returned nothing for these queries.",
    );
  }

  return {
    id: explorationId(),
    createdAt: new Date().toISOString(),
    input: {
      kind: input.kind,
      label: input.label,
      sourceName: input.sourceName,
      url: input.url,
    },
    analysis,
    cases,
    ideas,
    sources: allSources,
    perspectives: perspectives.groups.flatMap((g) => [...g.supporting, ...g.challenging]),
    map,
    next,
    dataPoints,
    providers,
    mode,
    warnings,
  };
}

/**
 * Cached exploration keyed on content + mode. Used by the API route so a
 * repeated upload costs nothing.
 */
export async function exploreCached(input: ExploreInput): Promise<{ result: ExplorationResult; cached: boolean }> {
  const key = `explore:${runtimeMode()}:${hashText(input.text)}:${input.kind}:${input.offline ? "offline" : "online"}`;
  const { value, cached: wasCached } = await cached(key, 3600, () => explore(input));
  return { result: value, cached: wasCached };
}

function hashText(s: string): string {
  let h = 0x811c9dc5;
  const sample = s.length > 50_000 ? s.slice(0, 50_000) : s;
  for (let i = 0; i < sample.length; i++) {
    h ^= sample.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/**
 * Re-run the exploration for a single concept (used when a user clicks a
 * knowledge-map node or a "next step"). Pure database + provider lookup.
 */
export async function exploreConcept(concept: string, offline = false): Promise<ExplorationResult> {
  return explore({
    text: concept,
    kind: "topic",
    label: concept,
    documentTitle: concept,
    documentType: "topic",
    offline,
  });
}
