/**
 * Deterministic claim extraction.
 *
 * A "claim" here is a declarative sentence carrying a causal, comparative,
 * predictive or normative signal — the kind of statement a reader would want
 * to verify or challenge. No model is used; we look for explicit linguistic
 * signals and statistical anchors.
 */

import type { Claim } from "../types";
import { splitSentences } from "./tokenize";

interface Signal {
  re: RegExp;
  label: string;
  weight: number;
}

const SIGNALS: Signal[] = [
  { re: /\b(causes?|caused by|leads? to|leading to|results? in|drives?|produces?|generates?)\b/i, label: "causal", weight: 1.0 },
  { re: /\b(increases?|decreases?|reduces?|raises?|lowers?|improves?|worsens?|boosts?|dampens?)\b/i, label: "directional", weight: 0.9 },
  { re: /\b(more|less|higher|lower|greater|fewer|faster|slower)\s+than\b/i, label: "comparative", weight: 0.7 },
  { re: /\b(will|would|is likely to|are likely to|is expected to|projected to|forecast)\b/i, label: "predictive", weight: 0.7 },
  { re: /\b(should|must|ought to|needs? to|it is necessary)\b/i, label: "normative", weight: 0.6 },
  { re: /\b(the evidence (shows|suggests|indicates)|research (shows|suggests|finds)|studies (show|suggest|find))\b/i, label: "evidential", weight: 1.0 },
  { re: /\b(significant|substantial|correlat\w*|associated with|linked to)\b/i, label: "associational", weight: 0.6 },
  { re: /\b\d{1,3}(?:[.,]\d+)?\s?(?:%|percent|million|billion|trillion)\b/i, label: "quantified", weight: 0.8 },
  { re: /\b(is|are|was|were|remains?)\s+(a|an|the)\b/i, label: "definitional", weight: 0.3 },
];

export function extractClaims(text: string, limit = 12): Claim[] {
  const sentences = splitSentences(text);
  const claims: Claim[] = [];

  for (const s of sentences) {
    const words = s.split(/\s+/).length;
    if (words < 6 || words > 60) continue;
    const signals: string[] = [];
    let weight = 0;
    for (const sig of SIGNALS) {
      if (sig.re.test(s)) {
        signals.push(sig.label);
        weight += sig.weight;
      }
    }
    if (signals.length === 0) continue;
    claims.push({ text: s.trim(), evidence: [s.trim()], signals });
    // stash weight in a parallel map via a non-enumerable-ish field
    (claims[claims.length - 1] as Claim & { _w?: number })._w = weight;
  }

  return claims
    .sort((a, b) => ((b as { _w?: number })._w ?? 0) - ((a as { _w?: number })._w ?? 0))
    .slice(0, limit)
    .map(({ text, evidence, signals }) => ({ text, evidence, signals }));
}

/** A one-paragraph extractive summary: the most information-dense sentences. */
export function extractiveSummary(text: string, maxSentences = 4): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return "";
  if (sentences.length <= maxSentences) return sentences.join(" ");

  // Score sentences by position, length and keyword salience.
  const freq = new Map<string, number>();
  for (const s of sentences) {
    for (const w of s.toLowerCase().match(/[\p{L}]{4,}/gu) ?? []) {
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  const scored = sentences.map((s, i) => {
    const words = s.toLowerCase().match(/[\p{L}]{4,}/gu) ?? [];
    let score = 0;
    for (const w of words) score += Math.log(1 + (freq.get(w) ?? 0));
    score /= Math.sqrt(words.length || 1);
    // Lead bias: earlier sentences usually carry the thesis.
    if (i === 0) score *= 1.35;
    else if (i < 3) score *= 1.15;
    if (words.length < 6) score *= 0.4;
    return { s, i, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.s)
    .join(" ");
}
