/**
 * Knowledge base access layer.
 *
 * The library is loaded from versioned JSON in src/data and indexed once per
 * process. It is intentionally read-mostly and provider-agnostic: swapping in
 * a database-backed library only requires re-implementing `loadLibrary()`.
 *
 * Crucially, the library is an ENRICHMENT source. Its absence of a concept
 * must never be read as "the document has no concepts".
 */

import casesJson from "@/data/cases.json";
import ideasJson from "@/data/ideas.json";
import perspectivesJson from "@/data/perspectives.json";
import sourcesJson from "@/data/sources.json";
import type {
  CaseRecord,
  IdeaRecord,
  PerspectiveRecord,
  SourceRecord,
  TopicRelationRecord,
} from "../types";
import { conceptKey } from "../nlp/concepts";

export interface Library {
  sources: SourceRecord[];
  cases: CaseRecord[];
  ideas: IdeaRecord[];
  perspectives: PerspectiveRecord[];
  relations: TopicRelationRecord[];
  /** Lowercased concept keys present in the library. */
  knownConcepts: Set<string>;
  /** conceptKey -> related concept keys. */
  conceptRelations: Map<string, string[]>;
  /** Full corpus text for IDF construction. */
  corpus: string[];
}

let cached: Library | null = null;

function recordText(parts: (string | string[] | undefined)[]): string {
  return parts
    .flatMap((p) => (Array.isArray(p) ? p : p ? [p] : []))
    .join(" ");
}

export function loadLibrary(): Library {
  if (cached) return cached;

  const sources = (sourcesJson.sources ?? []) as SourceRecord[];
  const cases = (casesJson.cases ?? []) as CaseRecord[];
  const ideas = (ideasJson.ideas ?? []) as IdeaRecord[];
  const perspectives = (perspectivesJson.perspectives ?? []) as PerspectiveRecord[];

  // Build the concept index from topics/tags/concepts across the library.
  const knownConcepts = new Set<string>();
  const conceptRelations = new Map<string, string[]>();
  const relations: TopicRelationRecord[] = [];

  const addKnown = (term: string) => {
    const key = conceptKey(term);
    if (key && key.length >= 3) knownConcepts.add(key);
  };
  const link = (a: string, b: string, type = "related") => {
    const ka = conceptKey(a);
    const kb = conceptKey(b);
    if (!ka || !kb || ka === kb) return;
    addKnown(ka);
    addKnown(kb);
    const list = conceptRelations.get(ka) ?? [];
    if (!list.includes(kb)) list.push(kb);
    conceptRelations.set(ka, list);
    const back = conceptRelations.get(kb) ?? [];
    if (!back.includes(ka)) back.push(ka);
    conceptRelations.set(kb, back);
    relations.push({ from: ka, to: kb, type });
  };

  for (const s of sources) {
    s.topics?.forEach(addKnown);
    s.tags?.forEach(addKnown);
  }
  for (const c of cases) {
    c.topics?.forEach(addKnown);
    c.tags?.forEach(addKnown);
    c.relatedConcepts?.forEach(addKnown);
    for (const t of c.topics ?? []) for (const rc of c.relatedConcepts ?? []) link(t, rc);
  }
  for (const i of ideas) {
    i.topics?.forEach(addKnown);
    i.tags?.forEach(addKnown);
  }
  for (const p of perspectives) {
    addKnown(p.topic);
  }

  const corpus = [
    ...sources.map((s) => recordText([s.title, s.description, s.topics, s.tags])),
    ...cases.map((c) => recordText([c.title, c.shortDescription, c.longDescription, c.topics, c.tags, c.relatedConcepts])),
    ...ideas.map((i) => recordText([i.title, i.description, i.topics, i.tags])),
  ];

  cached = { sources, cases, ideas, perspectives, relations, knownConcepts, conceptRelations, corpus };
  return cached;
}

export function findSource(id: string): SourceRecord | undefined {
  return loadLibrary().sources.find((s) => s.id === id);
}

export function sourcesByIds(ids: string[]): SourceRecord[] {
  const set = new Set(ids);
  return loadLibrary().sources.filter((s) => set.has(s.id));
}

export function libraryStats() {
  const lib = loadLibrary();
  return {
    sources: lib.sources.length,
    cases: lib.cases.length,
    ideas: lib.ideas.length,
    perspectives: lib.perspectives.length,
    concepts: lib.knownConcepts.size,
    synthetic: [
      ...lib.sources,
      ...lib.cases,
      ...lib.ideas,
      ...lib.perspectives,
    ].filter((r) => (r as { synthetic?: boolean }).synthetic).length,
  };
}

/** Reset the cache — used by tests and by the admin reindex action. */
export function resetLibraryCache() {
  cached = null;
}
