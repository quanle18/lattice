/**
 * Opposing-perspectives engine.
 *
 * Positions are retrieved from the library and grouped into supporting vs
 * challenging. We NEVER synthesise an argument that is not backed by a stored
 * source — if there is no recorded perspective, we say so.
 */

import { conceptKey } from "../nlp/concepts";
import type { DocumentAnalysis, PerspectiveRecord, SourceRecord } from "../types";
import { loadLibrary, sourcesByIds } from "../kb/repository";

export interface PerspectiveGroup {
  claim: string;
  topic: string;
  supporting: Array<PerspectiveRecord & { sources: SourceRecord[] }>;
  challenging: Array<PerspectiveRecord & { sources: SourceRecord[] }>;
  /** True when both sides exist and every side has at least one source. */
  balanced: boolean;
}

export interface PerspectivesResult {
  groups: PerspectiveGroup[];
  /** Perspectives that matched the document but had no backing source. */
  unsourced: string[];
  /** Whether the library simply has no perspective on this material. */
  note?: string;
}

function docKeys(analysis: DocumentAnalysis): Set<string> {
  const s = new Set<string>();
  for (const t of analysis.topics) s.add(conceptKey(t));
  for (const c of analysis.concepts) s.add(c.key);
  return s;
}

export function buildPerspectives(analysis: DocumentAnalysis): PerspectivesResult {
  const lib = loadLibrary();
  const doc = docKeys(analysis);

  const scored = lib.perspectives
    .map((p) => {
      const topicKey = conceptKey(p.topic);
      let hits = 0;
      for (const k of doc) {
        if (k === topicKey || k.includes(topicKey) || topicKey.includes(k)) hits += 2;
      }
      // Also match against the claim text.
      const claimKey = conceptKey(p.claim);
      for (const k of doc) if (claimKey.includes(k) && k.length > 3) hits += 1;
      return { p, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  const byClaim = new Map<string, PerspectiveGroup>();
  const unsourced: string[] = [];

  for (const { p } of scored) {
    const sources = sourcesByIds(p.sourceIds);
    const enriched = { ...p, sources };
    if (sources.length === 0) {
      unsourced.push(p.id);
      continue;
    }
    const key = conceptKey(p.claim);
    const group = byClaim.get(key) ?? {
      claim: p.claim,
      topic: p.topic,
      supporting: [],
      challenging: [],
      balanced: false,
    };
    if (p.stance === "supporting") group.supporting.push(enriched);
    else group.challenging.push(enriched);
    byClaim.set(key, group);
  }

  const groups = Array.from(byClaim.values()).map((g) => ({
    ...g,
    balanced: g.supporting.length > 0 && g.challenging.length > 0,
  }));

  groups.sort((a, b) => Number(b.balanced) - Number(a.balanced) || (b.supporting.length + b.challenging.length) - (a.supporting.length + a.challenging.length));

  const result: PerspectivesResult = { groups, unsourced };
  if (groups.length === 0) {
    result.note =
      "No opposing-perspective material is stored for this subject yet. Lattice does not invent counter-arguments — you can explore the topic through external sources instead.";
  }
  return result;
}

/**
 * Britannica ProCon is treated strictly as a debate/perspective source.
 * We link to its own index rather than fabricating article URLs, and only
 * surface it when the material looks contested.
 */
export function proConReference(): { label: string; url: string; note: string } {
  return {
    label: "Britannica ProCon",
    url: "https://www.britannica.com/procon",
    note: "Debate and opposing-perspectives framing. Lattice links to ProCon's own index — specific articles are only shown once verified.",
  };
}

const CONTESTED_SIGNALS = /\b(should|ought|debate|controvers|argue|disagree|oppos|contested|policy|reform|whether|trade-?off|versus|vs\.?)\b/i;

export function looksContested(analysis: DocumentAnalysis): boolean {
  if (analysis.claims.some((c) => c.signals.includes("normative") || c.signals.includes("comparative"))) return true;
  const text = `${analysis.summary} ${analysis.concepts.slice(0, 10).map((c) => c.label).join(" ")}`;
  return CONTESTED_SIGNALS.test(text);
}
