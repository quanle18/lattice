/**
 * Concept assembly — the layer that makes Lattice domain-independent.
 *
 * Inputs are generic (keywords, entities, text). Output is a set of Concept
 * objects that are ALWAYS produced, whether or not they exist in the internal
 * knowledge base. The library can only *enrich* (mark `known`, add relations);
 * it can never decide that a document "has no concepts".
 */

import type { Concept, ExtractedEntities } from "../types";
import type { Entity } from "./entities";
import type { MergedKeyword } from "./keywords";
import { disciplinesFor, taxonomyNeighbours } from "./taxonomy";
import { splitSentences, tokenize } from "./tokenize";
import { isStopword } from "./stopwords";

export interface ConceptInput {
  text: string;
  keywords: MergedKeyword[];
  entities: Entity[];
  /** Concept keys present in the internal knowledge base (lowercased). */
  knownConcepts: Set<string>;
  /** Relationships from the knowledge base, keyed by lowercase concept. */
  kbRelations?: Map<string, string[]>;
}

export function conceptKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function conceptId(label: string): string {
  return conceptKey(label).replace(/[\s]+/g, "-");
}

function sentencesContaining(text: string, needle: string, limit = 1): string[] {
  const out: string[] = [];
  const n = needle.toLowerCase();
  for (const s of splitSentences(text)) {
    if (s.toLowerCase().includes(n)) {
      out.push(s.trim());
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * Compute within-document co-occurrence between concept labels, using a
 * sentence window. Used to build the knowledge map without any external call.
 */
function coOccurrence(text: string, labels: string[]): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();
  const sentences = splitSentences(text);
  const lowerLabels = labels.map((l) => l.toLowerCase());
  for (const s of sentences) {
    const low = s.toLowerCase();
    const present: string[] = [];
    for (let i = 0; i < labels.length; i++) {
      if (low.includes(lowerLabels[i])) present.push(labels[i]);
    }
    for (const a of present) {
      for (const b of present) {
        if (a === b) continue;
        const m = result.get(a) ?? new Map<string, number>();
        m.set(b, (m.get(b) ?? 0) + 1);
        result.set(a, m);
      }
    }
  }
  return result;
}

export function buildConcepts(input: ConceptInput): Concept[] {
  const { text, keywords, entities, knownConcepts, kbRelations } = input;
  const map = new Map<string, Concept>();

  const upsert = (label: string, partial: Partial<Concept>) => {
    const key = conceptKey(label);
    if (!key || key.length < 3) return;
    if (key.split(" ").every((w) => isStopword(w))) return;
    const existing = map.get(key);
    if (existing) {
      existing.score = Math.max(existing.score, partial.score ?? 0);
      if (partial.disciplines) {
        for (const d of partial.disciplines) if (!existing.disciplines.includes(d)) existing.disciplines.push(d);
      }
      if (!existing.evidence && partial.evidence) existing.evidence = partial.evidence;
      if (partial.kind && existing.kind === "concept") existing.kind = partial.kind;
      return;
    }
    map.set(key, {
      id: conceptId(label),
      label: label.trim(),
      key,
      score: partial.score ?? 0.5,
      origin: partial.origin ?? "extracted",
      disciplines: partial.disciplines ?? [],
      known: knownConcepts.has(key),
      evidence: partial.evidence,
      related: [],
      kind: partial.kind ?? "concept",
    });
  };

  // 1. Keyphrases and salient terms.
  for (const k of keywords) {
    const label = k.text;
    const words = label.split(" ");
    // Drop pure-numeric or single very-short tokens.
    if (words.length === 1 && label.length < 4) continue;
    upsert(label, {
      score: k.score,
      origin: "extracted",
      disciplines: disciplinesFor(label),
      evidence: sentencesContaining(text, label)[0],
    });
  }

  // 2. Named entities are first-class concepts (people, orgs, places, works).
  for (const e of entities) {
    if (e.kind === "DATE" || e.kind === "STATISTIC") continue;
    upsert(e.text, {
      score: Math.min(0.95, 0.45 + e.count * 0.08),
      origin: "entity",
      kind: "entity",
      disciplines: disciplinesFor(e.text),
      evidence: e.sampleContext,
    });
  }

  // 3. Taxonomy enrichment: only add a taxonomy term if it actually appears
  //    in the text (never invent concepts the document does not contain).
  const textLower = text.toLowerCase();
  const existingKeys = new Set(map.keys());
  for (const c of Array.from(map.values())) {
    for (const nb of taxonomyNeighbours(c.label)) {
      if (!existingKeys.has(nb.text)) continue; // neighbour not present in text
      // linking happens below
    }
  }
  // Link taxonomy neighbours only among concepts present in the document.
  for (const c of Array.from(map.values())) {
    const neighbours = taxonomyNeighbours(c.label)
      .map((n) => n.text)
      .filter((t) => existingKeys.has(t) && t !== c.key);
    for (const n of neighbours) if (!c.related.includes(n)) c.related.push(n);
  }

  // 4. Knowledge-base relations between present concepts.
  if (kbRelations) {
    for (const c of Array.from(map.values())) {
      const rel = kbRelations.get(c.key) ?? [];
      for (const r of rel) {
        if (existingKeys.has(r) && r !== c.key && !c.related.includes(r)) c.related.push(r);
      }
    }
  }

  // 5. Co-occurrence relations for concepts with no explicit relation yet.
  const labels = Array.from(map.values()).map((c) => c.label);
  const co = coOccurrence(text, labels);
  for (const c of Array.from(map.values())) {
    const neighbours = co.get(c.label);
    if (!neighbours) continue;
    const top = Array.from(neighbours.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([l]) => conceptKey(l));
    for (const t of top) {
      if (t !== c.key && !c.related.includes(t)) c.related.push(t);
    }
  }

  // 6. Boost concepts that appear in the document title / first sentences.
  const head = textLower.slice(0, 400);
  for (const c of map.values()) {
    if (head.includes(c.key)) c.score = Math.min(1, c.score * 1.25);
    if (c.known) c.score = Math.min(1, c.score * 1.1);
  }

  const ranked = Array.from(map.values()).sort((a, b) => b.score - a.score);

  // Deduplicate near-duplicates: drop a single word if a phrase containing it
  // scores at least as highly.
  const kept: Concept[] = [];
  for (const c of ranked) {
    const isSubsumed = kept.some(
      (k) => k.key.includes(c.key) && k.key !== c.key && k.score >= c.score * 0.9,
    );
    if (isSubsumed && c.origin !== "entity") continue;
    kept.push(c);
  }

  return kept;
}

/** Concepts not present in the internal knowledge base. */
export function novelConceptLabels(concepts: Concept[], limit = 12): string[] {
  return concepts
    .filter((c) => !c.known && c.kind !== "entity")
    .slice(0, limit)
    .map((c) => c.label);
}

/** Build search queries from concepts: phrases first, then distinctive terms. */
export function buildQueries(concepts: Concept[], mainTopic: string, limit = 8): string[] {
  const queries = new Set<string>();
  const topicKey = conceptKey(mainTopic);
  if (topicKey) queries.add(topicKey);

  const phrases = concepts.filter((c) => c.key.includes(" ") && c.score > 0.35);
  for (const p of phrases.slice(0, 4)) queries.add(p.key);

  const singles = concepts.filter((c) => !c.key.includes(" ") && c.score > 0.3);
  for (const s of singles.slice(0, 4)) {
    if (topicKey && s.key !== topicKey) queries.add(`${topicKey} ${s.key}`);
  }
  // Pair the two strongest phrases for a compound query.
  if (phrases.length >= 2) queries.add(`${phrases[0].key} ${phrases[1].key}`);

  return Array.from(queries).filter(Boolean).slice(0, limit);
}

export function emptyEntities(): ExtractedEntities {
  return {
    PERSON: [], ORG: [], LOCATION: [], DATE: [],
    STATISTIC: [], ACRONYM: [], WORK: [], MISC: [],
  };
}

/** Derive a plausible main topic from keywords without any model call. */
export function deriveMainTopic(text: string, concepts: Concept[]): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 8 && l.length < 140);
  if (firstLine && !/^(abstract|introduction|contents)/i.test(firstLine)) {
    return firstLine.replace(/[.。]+$/, "").slice(0, 120);
  }
  const top = concepts.filter((c) => c.kind !== "entity").slice(0, 3).map((c) => c.label);
  return top.join(" · ") || "Untitled material";
}

/** Cheap stable content hash (FNV-1a, hex) used for cache keys. */
export function contentHash(text: string): string {
  let h = 0x811c9dc5;
  const sample = text.length > 200_000 ? text.slice(0, 200_000) : text;
  for (let i = 0; i < sample.length; i++) {
    h ^= sample.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Unused guard kept for API symmetry; ensures tokenizer stays tree-shaken in. */
export const _internal = { tokenize };
