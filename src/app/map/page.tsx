import type { Metadata } from "next";
import { Card, SectionHeading } from "@/components/ui";
import { LibraryMap } from "@/components/explore/library-map";
import { loadLibrary } from "@/lib/kb/repository";
import type { KnowledgeMap } from "@/lib/types";

export const metadata: Metadata = { title: "Knowledge Map" };

/**
 * Build a map of the internal library itself. Nodes are concepts the library
 * indexes; edges are stored relationships. Purely a database view.
 */
function libraryMap(): KnowledgeMap {
  const lib = loadLibrary();
  const degree = new Map<string, number>();
  for (const [from, tos] of lib.conceptRelations) {
    degree.set(from, (degree.get(from) ?? 0) + tos.length);
  }

  const nodes = Array.from(lib.knownConcepts)
    .map((key) => ({
      id: key,
      label: key,
      kind: "concept" as const,
      weight: Math.min(1, 0.2 + (degree.get(key) ?? 0) / 12),
      known: true,
      disciplines: [],
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 22);

  const present = new Set(nodes.map((n) => n.id));
  const edges: KnowledgeMap["edges"] = [];
  const seen = new Set<string>();
  for (const [from, tos] of lib.conceptRelations) {
    if (!present.has(from)) continue;
    for (const to of tos) {
      if (!present.has(to)) continue;
      const key = from < to ? `${from}|${to}` : `${to}|${from}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: from, target: to, type: "library", weight: 0.7 });
    }
  }

  return { nodes, edges };
}

export default function MapPage() {
  const map = libraryMap();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <SectionHeading
        eyebrow="Connect"
        title="Knowledge map"
        description="The relationships the internal library already knows about. Every node and edge comes from stored data — selecting a node never calls a model."
      />
      <div className="mt-8">
        {map.nodes.length === 0 ? (
          <Card>
            <p className="text-sm text-parchment-400">
              The library is empty, so there is nothing to map yet. Add cases, ideas and sources in the
              admin panel, or explore a topic to build a document-level map.
            </p>
          </Card>
        ) : (
          <LibraryMap map={map} />
        )}
      </div>
    </div>
  );
}
