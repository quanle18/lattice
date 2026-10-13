/**
 * Knowledge map construction.
 *
 * The graph is built entirely from real extracted concepts plus stored
 * relationships. Clicking a node in the UI re-queries this structure — it never
 * triggers a model call.
 */

import { conceptKey } from "../nlp/concepts";
import type { Concept, DocumentAnalysis, KnowledgeMap, KnowledgeMapEdge, KnowledgeMapNode } from "../types";
import { loadLibrary } from "../kb/repository";
import { taxonomyNeighbours } from "../nlp/taxonomy";

export function buildKnowledgeMap(analysis: DocumentAnalysis, maxNodes = 26): KnowledgeMap {
  const lib = loadLibrary();
  const concepts: Concept[] = analysis.concepts.slice(0, maxNodes);
  const present = new Set(concepts.map((c) => c.key));

  const nodes: KnowledgeMapNode[] = concepts.map((c) => ({
    id: c.key,
    label: c.label,
    kind: c.kind ?? "concept",
    weight: Math.max(0.15, Math.min(1, c.score)),
    known: c.known,
    disciplines: c.disciplines,
  }));

  const edges: KnowledgeMapEdge[] = [];
  const seen = new Set<string>();
  const addEdge = (a: string, b: string, type: string, weight: number) => {
    if (a === b || !present.has(a) || !present.has(b)) return;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source: a, target: b, type, weight });
  };

  for (const c of concepts) {
    // 1. Explicit relations carried on the concept (library + taxonomy + co-occurrence).
    for (const r of c.related) {
      const rk = conceptKey(r);
      addEdge(c.key, rk, "related", 0.7);
    }
    // 2. Taxonomy neighbours among present concepts.
    for (const n of taxonomyNeighbours(c.label)) {
      if (present.has(n.text)) addEdge(c.key, n.text, n.type, 0.8);
    }
    // 3. Library concept graph.
    const libRel = lib.conceptRelations.get(c.key);
    if (libRel) for (const r of libRel) if (present.has(r)) addEdge(c.key, r, "library", 0.6);
  }

  // Guarantee connectivity: link any isolated node to the strongest hub.
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const hub = nodes.slice().sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || b.weight - a.weight)[0];
  if (hub) {
    for (const n of nodes) {
      if ((degree.get(n.id) ?? 0) === 0 && n.id !== hub.id) addEdge(hub.id, n.id, "co-occurrence", 0.4);
    }
  }

  return { nodes, edges };
}

/** Neighbours of a node for interactive exploration (pure lookup). */
export function mapNeighbours(map: KnowledgeMap, nodeId: string) {
  const neighbours: { id: string; type: string; weight: number }[] = [];
  for (const e of map.edges) {
    if (e.source === nodeId) neighbours.push({ id: e.target, type: e.type, weight: e.weight });
    else if (e.target === nodeId) neighbours.push({ id: e.source, type: e.type, weight: e.weight });
  }
  return neighbours.sort((a, b) => b.weight - a.weight);
}
