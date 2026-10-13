/**
 * Deterministic recommendation engine.
 *
 * Scoring is transparent arithmetic over database fields — no model, no
 * network. Weights are configurable and every result carries a breakdown plus
 * plain-language reasons, so "why is this relevant?" costs nothing to answer.
 */

import type { Concept, DocumentAnalysis, QualityTier, Recommendation, RelevanceBreakdown } from "../types";
import { conceptKey } from "../nlp/concepts";

export interface ScoringWeights {
  topic: number;
  tag: number;
  concept: number;
  industry: number;
  geography: number;
  time: number;
  quality: number;
  /** Maximum contribution of local embedding similarity. */
  semantic: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  topic: 40,
  tag: 25,
  concept: 15,
  industry: 5,
  geography: 5,
  time: 5,
  quality: 5,
  semantic: 10,
};

export interface ScorableItem {
  id: string;
  title: string;
  topics?: string[];
  tags?: string[];
  subtopics?: string[];
  relatedConcepts?: string[];
  industry?: string;
  country?: string;
  region?: string;
  year?: number;
  quality?: QualityTier;
  /** Free text used for the semantic component. */
  text?: string;
}

const QUALITY_SCORE: Record<QualityTier, number> = {
  PRIMARY: 1.0,
  ACADEMIC: 0.95,
  "HIGH-QUALITY JOURNALISM": 0.8,
  SECONDARY: 0.6,
  "GENERAL REFERENCE": 0.5,
  "DEBATE / PERSPECTIVE": 0.45,
};

/** Normalise a term list into a set of concept keys. */
function keys(terms?: string[]): Set<string> {
  const s = new Set<string>();
  for (const t of terms ?? []) {
    const k = conceptKey(t);
    if (k) s.add(k);
  }
  return s;
}

function overlap(a: Set<string>, b: Set<string>): string[] {
  const out: string[] = [];
  for (const x of a) {
    if (b.has(x)) {
      out.push(x);
      continue;
    }
    // Exact match alone is too strict for multi-word topics: a document about
    // "contemporary international relations" plainly covers an item tagged
    // "international relations". Treat either phrase containing the other as
    // a match so relevance is not silently lost to phrasing.
    const xTokens = x.split(" ").filter(Boolean);
    if (xTokens.length < 2) continue;
    const xSet = new Set(xTokens);
    for (const y of b) {
      const yTokens = y.split(" ").filter(Boolean);
      if (yTokens.length < 2) continue;
      const ySet = new Set(yTokens);
      if (xTokens.every((t) => ySet.has(t)) || yTokens.every((t) => xSet.has(t))) {
        out.push(x);
        break;
      }
    }
  }
  return out;
}

export interface ScoreContext {
  analysis: DocumentAnalysis;
  weights?: ScoringWeights;
  /** Optional precomputed embedding of the query document. */
  queryVector?: Float32Array;
  /** Optional embedder for semantic scoring of items. */
  embed?: (text: string) => Float32Array;
  /** Recency reference year for the time component. */
  now?: number;
}

export interface ScoreResult {
  score: number;
  breakdown: RelevanceBreakdown;
  reasons: string[];
  matchedTopics: string[];
  matchedTags: string[];
  matchedConcepts: string[];
}

export function scoreItem(item: ScorableItem, ctx: ScoreContext): ScoreResult {
  const w = ctx.weights ?? DEFAULT_WEIGHTS;
  const analysis = ctx.analysis;

  const docTopics = keys(analysis.topics);
  const docConcepts = keys(analysis.concepts.map((c) => c.label));
  const itemTopics = keys(item.topics);
  const itemTags = keys(item.tags);
  const itemConcepts = keys([...(item.relatedConcepts ?? []), ...(item.subtopics ?? [])]);

  const matchedTopics = overlap(docTopics, itemTopics);
  const matchedTags = overlap(docConcepts, itemTags);
  const matchedConcepts = overlap(docConcepts, itemConcepts);

  // Topic component — fraction of the document's topics covered by the item.
  const topicRatio = docTopics.size ? matchedTopics.length / Math.min(docTopics.size, 4) : 0;
  const topic = Math.min(1, topicRatio) * w.topic;

  // Tag component — absolute count, capped.
  const tag = Math.min(1, matchedTags.length / 3) * w.tag;

  // Concept component.
  const concept = Math.min(1, matchedConcepts.length / 3) * w.concept;

  // Industry.
  const itemIndustry = conceptKey(item.industry ?? "");
  const industry =
    itemIndustry && Array.from(docConcepts).some((c) => c.includes(itemIndustry) || itemIndustry.includes(c))
      ? w.industry
      : 0;

  // Geography — check locations extracted from the document.
  const locations = keys(analysis.entities.LOCATION);
  const itemGeo = keys([item.country, item.region].filter((x): x is string => typeof x === "string" && x.length > 0));
  const geography = overlap(locations, itemGeo).length > 0 ? w.geography : 0;

  // Time — recent items score higher, older items decay gently.
  let time = 0;
  if (item.year) {
    const now = ctx.now ?? new Date().getFullYear();
    const age = Math.max(0, now - item.year);
    time = w.time * Math.max(0, 1 - age / 30);
  }

  // Quality.
  const quality = item.quality ? (QUALITY_SCORE[item.quality] ?? 0.4) * w.quality : 0;

  // Semantic (local embeddings).
  let semantic = 0;
  if (w.semantic > 0 && ctx.queryVector && ctx.embed && item.text) {
    const v = ctx.embed(item.text);
    let dot = 0;
    const n = Math.min(v.length, ctx.queryVector.length);
    for (let i = 0; i < n; i++) dot += v[i] * ctx.queryVector[i];
    semantic = Math.max(0, dot) * w.semantic;
  }

  const breakdown: RelevanceBreakdown = { topic, tag, concept, industry, geography, time, quality, semantic };
  const score = topic + tag + concept + industry + geography + time + quality + semantic;

  const reasons: string[] = [];
  if (matchedTopics.length) {
    reasons.push(`Shares ${matchedTopics.length} topic${matchedTopics.length > 1 ? "s" : ""} with your material: ${matchedTopics.slice(0, 4).join(", ")}.`);
  }
  if (matchedTags.length) {
    reasons.push(`Matches the concept${matchedTags.length > 1 ? "s" : ""} ${matchedTags.slice(0, 4).join(", ")}.`);
  }
  if (matchedConcepts.length) {
    reasons.push(`Related to ${matchedConcepts.slice(0, 3).join(", ")}.`);
  }
  if (industry) reasons.push(`Same industry: ${item.industry}.`);
  if (geography) {
    const place = [item.country, item.region].filter((x): x is string => typeof x === "string" && x.length > 0).join(" / ");
    reasons.push(`Same geography: ${place}.`);
  }
  if (item.quality) reasons.push(`Source quality: ${item.quality}.`);
  if (semantic > 1.5) reasons.push("Semantically close to your material (local embedding similarity).");
  if (reasons.length === 0) reasons.push("Surfaced by weak term overlap; treat as a peripheral suggestion.");

  return { score, breakdown, reasons, matchedTopics, matchedTags, matchedConcepts };
}

export function recommend<T extends ScorableItem>(
  items: T[],
  ctx: ScoreContext,
  opts: { limit?: number; minScore?: number } = {},
): Recommendation<T>[] {
  const limit = opts.limit ?? 8;
  const minScore = opts.minScore ?? 1;
  return items
    .map((item) => {
      const r = scoreItem(item, ctx);
      return { item, score: r.score, breakdown: r.breakdown, reasons: r.reasons };
    })
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function conceptsToKeys(concepts: Concept[]): Set<string> {
  return keys(concepts.map((c) => c.label));
}
