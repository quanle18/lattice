/**
 * "Where should you go next?" — deterministic next-step generation.
 *
 * Every suggestion is derived from data already computed for this exploration
 * (concepts, ideas, cases, entities, perspectives). No LLM is involved, and
 * each suggestion carries a concrete action the UI can execute.
 */

import type { CaseRecord, IdeaRecord, NextExploration, DocumentAnalysis } from "../types";
import type { Recommendation } from "../types";
import type { PerspectiveGroup } from "./perspectives";

export interface NextInput {
  analysis: DocumentAnalysis;
  ideas: Recommendation<IdeaRecord>[];
  cases: Recommendation<CaseRecord>[];
  perspectiveGroups: PerspectiveGroup[];
}

export function buildNextExplorations(input: NextInput, limit = 8): NextExploration[] {
  const { analysis, ideas, cases, perspectiveGroups } = input;
  const out: NextExploration[] = [];
  const used = new Set<string>();

  const push = (s: NextExploration) => {
    const key = s.label.toLowerCase();
    if (used.has(key)) return;
    used.add(key);
    out.push(s);
  };

  const concepts = analysis.concepts.filter((c) => c.kind !== "entity");
  const novel = concepts.filter((c) => !c.known);
  const known = concepts.filter((c) => c.known);

  // 1. Strongest novel concepts — the material goes beyond the library.
  for (const c of novel.slice(0, 3)) {
    push({
      label: `Explore “${c.label}” in depth`,
      rationale: `This concept is central to your material but is not yet represented in the internal library, so external sources are the best next step.`,
      action: { type: "explore", query: c.label },
    });
  }

  // 2. Concept-pair comparisons (only when both concepts are present).
  const withPairs = concepts.filter((c) => c.related.length > 0);
  let pairs = 0;
  for (const c of withPairs) {
    if (pairs >= 2) break;
    const partnerKey = c.related.find((r) => concepts.some((x) => x.key === r));
    const partner = concepts.find((x) => x.key === partnerKey);
    if (partner) {
      push({
        label: `Compare “${c.label}” and “${partner.label}”`,
        rationale: `These two concepts co-occur in your material and appear to be linked, which usually signals a relationship worth examining directly.`,
        action: { type: "explore", query: `${c.label} ${partner.label}` },
      });
      pairs++;
    }
  }

  // 3. Library ideas that matched.
  for (const idea of ideas.slice(0, 2)) {
    push({
      label: `Investigate: ${idea.item.title}`,
      rationale: idea.reasons[0] ?? "Matched your material's topics.",
      action: { type: "explore", query: idea.item.title },
    });
  }

  // 4. Cases worth studying.
  for (const c of cases.slice(0, 2)) {
    push({
      label: `Study the case: ${c.item.title}`,
      rationale: c.reasons[0] ?? "A concrete case related to your material.",
      action: { type: "explore", query: c.item.title },
    });
  }

  // 5. Geographic comparison.
  const locations = analysis.entities.LOCATION.filter((l) => l.split(/\s+/).length <= 3);
  if (locations.length >= 2) {
    push({
      label: `Compare ${locations[0]} and ${locations[1]}`,
      rationale: `Both appear in your material; comparing contexts often reveals which findings generalise.`,
      action: { type: "explore", query: `${locations[0]} ${locations[1]} ${analysis.topics[0] ?? ""}`.trim() },
    });
  } else if (locations.length === 1) {
    push({
      label: `Explore how this applies in ${locations[0]}`,
      rationale: `Your material references ${locations[0]}; checking the local context tests how general the argument is.`,
      action: { type: "explore", query: `${analysis.topics[0] ?? analysis.mainTopic} ${locations[0]}` },
    });
  }

  // 6. Challenge the strongest claim.
  const balanced = perspectiveGroups.find((g) => g.balanced);
  if (balanced) {
    push({
      label: `Find evidence challenging: “${balanced.claim}”`,
      rationale: `Your material touches a contested claim. The library holds both supporting and challenging positions — examining the other side is the fastest way to stress-test it.`,
      action: { type: "explore", query: balanced.claim },
    });
  } else if (analysis.claims[0]) {
    push({
      label: `Test the claim: “${truncate(analysis.claims[0].text, 80)}”`,
      rationale: `This is the strongest claim-signal sentence in your material. Looking for counter-evidence is a natural next step.`,
      action: { type: "explore", query: analysis.claims[0].text },
    });
  }

  // 7. Historical background.
  const topic = analysis.topics[0] ?? analysis.mainTopic;
  if (topic) {
    push({
      label: `Explore the historical background of ${topic}`,
      rationale: `Long-run context often reframes present-day findings.`,
      action: { type: "explore", query: `history of ${topic}` },
    });
  }

  // 8. Library concepts that matched, for depth.
  for (const c of known.slice(0, 2)) {
    push({
      label: `Go deeper on “${c.label}”`,
      rationale: `The internal library already holds cases, ideas and sources on this concept.`,
      action: { type: "concept", concept: c.key },
    });
  }

  return out.slice(0, limit);
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`;
}
