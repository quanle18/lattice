/**
 * Taxonomy loader + concept relationship helpers.
 *
 * The taxonomy is data, not logic. Editing src/data/taxonomy.json extends what
 * Lattice can *label*; it never restricts what Lattice can *extract*.
 */

import raw from "@/data/taxonomy.json";

export interface Discipline {
  id: string;
  label: string;
  keywords: string[];
}

export interface TaxonomyRelation {
  from: string;
  to: string;
  type: string;
}

interface TaxonomyFile {
  version: number;
  disciplines: Discipline[];
  relations: TaxonomyRelation[];
}

const file = raw as unknown as TaxonomyFile;

export const disciplines: Discipline[] = file.disciplines;
export const taxonomyRelations: TaxonomyRelation[] = file.relations;

const keywordIndex: Map<string, string[]> = (() => {
  const idx = new Map<string, string[]>();
  for (const d of disciplines) {
    for (const kw of d.keywords) {
      const key = kw.toLowerCase();
      const list = idx.get(key) ?? [];
      list.push(d.id);
      idx.set(key, list);
    }
  }
  return idx;
})();

export const disciplineById = new Map(disciplines.map((d) => [d.id, d]));

/** Return discipline ids that the given concept text belongs to. */
export function disciplinesFor(text: string): string[] {
  const key = text.toLowerCase().trim();
  const direct = keywordIndex.get(key);
  if (direct) return direct;
  // Token overlap for multi-word concepts.
  const words = key.split(/\s+/).filter((w) => w.length > 3);
  const hits = new Set<string>();
  for (const w of words) {
    const ids = keywordIndex.get(w);
    if (ids) for (const id of ids) hits.add(id);
  }
  return Array.from(hits);
}

/** Related concepts for a given concept, from the taxonomy graph. */
export function taxonomyNeighbours(text: string): { text: string; type: string }[] {
  const key = text.toLowerCase().trim();
  const out: { text: string; type: string }[] = [];
  for (const r of taxonomyRelations) {
    if (r.from === key) out.push({ text: r.to, type: r.type });
    else if (r.to === key) out.push({ text: r.from, type: r.type });
  }
  return out;
}

export function allTaxonomyTerms(): string[] {
  return Array.from(keywordIndex.keys());
}
