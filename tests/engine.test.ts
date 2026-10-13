/**
 * Core engine tests.
 *
 * These are the tests that matter most for the platform's central promise:
 * that concept extraction is DOMAIN-INDEPENDENT and does not depend on any
 * starter library or AI provider.
 *
 * Run with:  npm test
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";

import { splitSentences, tokenize, detectLanguage, wordCount } from "../src/lib/nlp/tokenize";
import { extractKeywords, rakeKeyphrases, termFrequencies } from "../src/lib/nlp/keywords";
import { extractEntities } from "../src/lib/nlp/entities";
import { extractClaims, extractiveSummary } from "../src/lib/nlp/claims";
import { hashEmbed, cosine } from "../src/lib/nlp/embed";
import { buildConcepts, novelConceptLabels, buildQueries } from "../src/lib/nlp/concepts";
import { analyzeText } from "../src/lib/nlp/analyze";
import { loadLibrary } from "../src/lib/kb/repository";
import { buildKnowledgeMap, mapNeighbours } from "../src/lib/recommend/map";
import { buildNextExplorations } from "../src/lib/recommend/next";
import { buildPerspectives } from "../src/lib/recommend/perspectives";
import { recommend, scoreItem, DEFAULT_WEIGHTS } from "../src/lib/recommend/engine";
import { parseCsv, parseJson, parseXml } from "../src/lib/parsers/tabular";
import { parseMarkdown, parseRtf } from "../src/lib/parsers/text";
import { parseHtml } from "../src/lib/parsers/html";
import { extensionOf, sniffBytes, UnsupportedFormatError, parseDocument } from "../src/lib/parsers";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const IR_DOCUMENT = `
The Changing Nature of International Relations

Contemporary international relations are increasingly described as multipolar. Unlike the
bipolar structure of the Cold War, power today is distributed across several centres, and no
single state can set the terms of the international order alone.

Multipolarity is frequently associated with the balance of power, but the relationship is
contested. Some scholars argue that a greater number of poles increases the risk of
miscalculation; others argue that stability depends on how specific disputes are managed
rather than on the number of poles.

Economic interdependence complicates this picture. Trade between rivals creates leverage, and
that leverage can be used coercively. At the same time, interdependence creates domestic
constituencies that favour restraint, because conflict is costly for exporters.

Middle powers have responded by pursuing strategic autonomy. Rather than aligning formally
with one great power, they hedge: diversifying suppliers, deepening regional institutions,
and investing in technology that reduces exposure to coercion.

The security dilemma has returned in new domains. Competition over semiconductors and
artificial intelligence is now framed as national security policy, and export controls have
become instruments of statecraft. Whether this produces an arms race or a managed competition
remains an open question.

Institutions designed for a different distribution of power have struggled to adapt.
Multilateralism persists, but reform has stalled, and diplomacy increasingly takes place in
ad hoc coalitions rather than in universal bodies.
`;

const BIOLOGY_DOCUMENT = `
Selection Pressures in Fragmented Habitats

Habitat fragmentation reduces gene flow between populations and changes the strength of
natural selection. In small, isolated populations, genetic drift can overwhelm selection,
so adaptive responses to environmental change may be slower than theory predicts.

The microbiome offers a parallel case. Microbial communities respond rapidly to dietary
change, and metabolic outcomes correlate with microbial composition. Correlation, however,
is not causation, and intervention studies are needed to separate the two.

Evolution by natural selection requires heritable variation in fitness. Where variation is
eroded by fragmentation, the capacity to adapt declines even if selection pressure increases.
`;

// ── Tokenisation ─────────────────────────────────────────────────────────────

test("tokenize normalises and flags capitalisation and acronyms", () => {
  const tokens = tokenize("The WHO reported that OpenAI and NATO acted in Geneva.");
  const texts = tokens.map((t) => t.text);
  assert.ok(texts.includes("who"));
  assert.ok(texts.includes("openai"));
  const who = tokens.find((t) => t.text === "who");
  assert.equal(who?.acronym, true);
});

test("splitSentences does not split on common abbreviations", () => {
  const s = splitSentences("Dr. Smith met Prof. Jones. They discussed AI. It was productive.");
  assert.equal(s.length, 3);
});

test("detectLanguage identifies English", () => {
  assert.equal(detectLanguage(IR_DOCUMENT), "en");
});

test("wordCount counts words", () => {
  assert.ok(wordCount("one two three") === 3);
});

// ── Keywords ─────────────────────────────────────────────────────────────────

test("RAKE returns multi-word keyphrases from the IR document", () => {
  const phrases = rakeKeyphrases(IR_DOCUMENT, { maxWords: 3, limit: 30 });
  const joined = phrases.map((p) => p.text).join(" | ");
  assert.ok(phrases.length > 5, "expected several phrases");
  assert.ok(/balance of power|international relations|strategic autonomy|security dilemma/.test(joined));
});

test("extractKeywords merges phrases and salient terms", () => {
  const kws = extractKeywords(IR_DOCUMENT);
  assert.ok(kws.length > 10);
  const all = kws.map((k) => k.text).join(" ");
  assert.ok(all.includes("multipolar") || all.includes("multipolarity"));
});

test("termFrequencies ignores stopwords", () => {
  const tf = termFrequencies("the the the power power");
  assert.ok(!tf.has("the"));
  assert.equal(tf.get("power"), 2);
});

// ── Entities ─────────────────────────────────────────────────────────────────

test("extractEntities finds locations, acronyms and statistics", () => {
  const entities = extractEntities(
    "NATO and the WHO met in Geneva in 2021. Inflation reached 8.5 percent in the United States.",
  );
  const locations = entities.filter((e) => e.kind === "LOCATION").map((e) => e.text.toLowerCase());
  assert.ok(locations.some((l) => l.includes("geneva")), "expected Geneva as a location");
  assert.ok(entities.some((e) => e.kind === "STATISTIC"), "expected a statistic");
  assert.ok(entities.some((e) => e.kind === "DATE" || e.kind === "ACRONYM"));
});

// ── Claims ───────────────────────────────────────────────────────────────────

test("extractClaims finds causal and quantified claims", () => {
  const claims = extractClaims(
    "Automation leads to job displacement in routine occupations. Wages rose by 12 percent last year. The sky is blue.",
  );
  assert.ok(claims.length >= 2);
  assert.ok(claims.some((c) => c.signals.includes("causal")));
  assert.ok(claims.some((c) => c.signals.includes("quantified")));
});

test("extractiveSummary returns a non-empty summary", () => {
  const s = extractiveSummary(IR_DOCUMENT, 3);
  assert.ok(s.length > 40);
  assert.ok(s.split(/(?<=[.!?])\s+/).length <= 3);
});

// ── Embeddings ───────────────────────────────────────────────────────────────

test("hash embeddings are deterministic and similarity is meaningful", () => {
  const a = hashEmbed("international relations and the balance of power");
  const b = hashEmbed("international relations and the balance of power");
  const c = hashEmbed("microbiome metabolism and dietary intervention");
  assert.deepEqual(Array.from(a), Array.from(b));
  assert.ok(cosine(a, b) > cosine(a, c), "related texts should be closer");
});

// ── THE REGRESSION TEST: domain independence ─────────────────────────────────

test("REGRESSION: IR document yields IR concepts without any starter library", () => {
  // Deliberately pass an EMPTY known-concept set: the extractor must still work.
  const analysis = analyzeText(IR_DOCUMENT, { knownConcepts: new Set(), documentType: "text" });

  const labels = analysis.concepts.map((c) => c.label.toLowerCase()).join(" | ");

  // Concepts the original failure case required.
  for (const expected of ["multipolar", "diplomacy", "interdependence", "strategic autonomy", "security dilemma", "balance of power"]) {
    assert.ok(labels.includes(expected), `expected concept matching "${expected}" in:\n${labels}`);
  }

  assert.ok(analysis.concepts.length > 8, "should extract many concepts");
  assert.ok(analysis.queries.length > 0, "should derive search queries");
  assert.equal(analysis.processingStatus, "completed");
  assert.ok(!analysis.warnings.some((w) => /no known concepts/i.test(w)), "must not claim no concepts exist");
});

test("REGRESSION: biology document yields biology concepts, not IR ones", () => {
  const analysis = analyzeText(BIOLOGY_DOCUMENT, { knownConcepts: new Set() });
  const labels = analysis.concepts.map((c) => c.label.toLowerCase()).join(" | ");
  assert.ok(labels.includes("fragmentation") || labels.includes("habitat"));
  assert.ok(labels.includes("selection") || labels.includes("natural selection"));
  assert.ok(!labels.includes("multipolarity"));
});

test("novel concepts are reported, never discarded", () => {
  const concepts = buildConcepts({
    text: "Quantum chromodynamics and lattice gauge theory describe confinement.",
    keywords: extractKeywords("Quantum chromodynamics and lattice gauge theory describe confinement."),
    entities: [],
    knownConcepts: new Set(),
  });
  const novel = novelConceptLabels(concepts);
  assert.ok(concepts.length > 0, "concepts must survive an empty library");
  assert.ok(novel.length > 0, "unknown concepts must be surfaced as novel");
  assert.ok(concepts.every((c) => c.known === false));
});

test("known concepts are marked when the library contains them", () => {
  const lib = loadLibrary();
  const analysis = analyzeText(IR_DOCUMENT, { knownConcepts: lib.knownConcepts });
  const known = analysis.concepts.filter((c) => c.known);
  assert.ok(known.length > 0, "library concepts should be marked known");
});

test("buildQueries derives multiple distinct queries", () => {
  const analysis = analyzeText(IR_DOCUMENT, { knownConcepts: new Set() });
  const q = buildQueries(analysis.concepts, analysis.mainTopic);
  assert.ok(q.length >= 2);
  assert.equal(new Set(q).size, q.length);
});

// ── Recommendation engine ────────────────────────────────────────────────────

test("scoring rewards topic overlap and explains itself", () => {
  const analysis = analyzeText(IR_DOCUMENT, { knownConcepts: new Set() });
  const relevant = scoreItem(
    { id: "a", title: "Multipolarity", topics: ["international relations", "multipolarity"], tags: ["balance of power"] },
    { analysis },
  );
  const irrelevant = scoreItem(
    { id: "b", title: "Microbiome", topics: ["biology", "microbiome"], tags: ["metabolism"] },
    { analysis },
  );
  assert.ok(relevant.score > irrelevant.score);
  assert.ok(relevant.reasons.length > 0);
  assert.equal(
    Object.values(relevant.breakdown).reduce((a, b) => a + b, 0).toFixed(4),
    relevant.score.toFixed(4),
    "breakdown must sum to the score",
  );
});

test("recommend returns ranked, bounded results", () => {
  const lib = loadLibrary();
  const analysis = analyzeText(IR_DOCUMENT, { knownConcepts: lib.knownConcepts });
  const recs = recommend(lib.cases, { analysis }, { limit: 3 });
  assert.ok(recs.length <= 3);
  for (let i = 1; i < recs.length; i++) {
    assert.ok(recs[i - 1].score >= recs[i].score, "results must be sorted");
  }
});

test("weights are configurable", () => {
  const analysis = analyzeText(IR_DOCUMENT, { knownConcepts: new Set() });
  const item = { id: "x", title: "t", topics: ["international relations"], tags: [] };
  const base = scoreItem(item, { analysis });
  const boosted = scoreItem(item, { analysis, weights: { ...DEFAULT_WEIGHTS, topic: 100 } });
  assert.ok(boosted.score > base.score);
});

// ── Knowledge map ────────────────────────────────────────────────────────────

test("knowledge map is connected and navigable", () => {
  const analysis = analyzeText(IR_DOCUMENT, { knownConcepts: new Set() });
  const map = buildKnowledgeMap(analysis);
  assert.ok(map.nodes.length > 3);
  assert.ok(map.edges.length > 0);

  // Every node except possibly the hub should have at least one edge.
  const degree = new Map<string, number>();
  for (const e of map.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  const isolated = map.nodes.filter((n) => (degree.get(n.id) ?? 0) === 0);
  assert.ok(isolated.length <= 1, `expected at most one isolated node, got ${isolated.length}`);

  const hub = map.nodes.slice().sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0))[0];
  const neighbours = mapNeighbours(map, hub.id);
  assert.ok(neighbours.length > 0);
});

// ── Perspectives ─────────────────────────────────────────────────────────────

test("perspectives are only returned with backing sources", () => {
  const analysis = analyzeText(
    "Automation reduces employment and raises productivity. Wages have stagnated.",
    { knownConcepts: loadLibrary().knownConcepts },
  );
  const result = buildPerspectives(analysis);
  for (const g of result.groups) {
    for (const p of [...g.supporting, ...g.challenging]) {
      assert.ok(p.sources.length > 0, "every perspective must be traceable to a source");
    }
  }
});

test("perspectives explain themselves when nothing is stored", () => {
  const analysis = analyzeText("A completely novel topic about underwater basket weaving.", {
    knownConcepts: new Set(),
  });
  const result = buildPerspectives(analysis);
  if (result.groups.length === 0) {
    assert.ok(result.note, "must explain the absence rather than inventing positions");
  }
});

// ── Next steps ───────────────────────────────────────────────────────────────

test("next explorations are concrete and deduplicated", () => {
  const lib = loadLibrary();
  const analysis = analyzeText(IR_DOCUMENT, { knownConcepts: lib.knownConcepts });
  const ideas = recommend(lib.ideas, { analysis }, { limit: 3 });
  const cases = recommend(lib.cases, { analysis }, { limit: 3 });
  const next = buildNextExplorations({ analysis, ideas, cases, perspectiveGroups: [] }, 8);
  assert.ok(next.length > 0);
  const labels = next.map((n) => n.label.toLowerCase());
  assert.equal(new Set(labels).size, labels.length, "suggestions must be unique");
  for (const n of next) assert.ok(n.action && n.rationale.length > 0);
});

// ── Parsers ──────────────────────────────────────────────────────────────────

test("markdown parser extracts headings and title", () => {
  const doc = parseMarkdown("# Title\n\n## Section\n\nBody text here.", "x.md");
  assert.equal(doc.documentTitle, "Title");
  assert.deepEqual(doc.headings, ["Title", "Section"]);
});

test("csv parser detects headers and preserves rows", () => {
  const doc = parseCsv(Buffer.from("country,year,value\nVietnam,2020,5\nChina,2021,9\n"), "d.csv");
  assert.deepEqual(doc.headings, ["country", "year", "value"]);
  assert.ok(doc.tables.length >= 3);
  assert.ok(doc.extractedText.includes("country: Vietnam"));
});

test("json parser flattens nested structures", () => {
  const doc = parseJson(Buffer.from(JSON.stringify({ a: { b: [1, 2] } })), "d.json");
  assert.ok(doc.extractedText.includes("a.b[0]: 1"));
});

test("json parser degrades gracefully on invalid input", () => {
  const doc = parseJson(Buffer.from("{ not json"), "d.json");
  assert.ok(doc.warnings.length > 0);
});

test("xml parser flattens elements", () => {
  const doc = parseXml(Buffer.from("<root><item>hello</item></root>"), "d.xml");
  assert.ok(doc.extractedText.includes("hello"));
});

test("rtf parser strips control words and decodes escapes", () => {
  const doc = parseRtf("{\\rtf1\\ansi Hello \\'e9 world\\par second line}", "d.rtf");
  assert.ok(doc.extractedText.includes("Hello"));
  assert.ok(doc.extractedText.includes("é"));
  assert.ok(doc.extractedText.includes("second line"));
});

test("html parser extracts title, headings and body", () => {
  const doc = parseHtml(
    "<html><head><title>My Page</title></head><body><nav>skip</nav><article><h1>Heading</h1><p>Body text that is long enough to pass the small-content warning threshold and be useful for analysis purposes.</p></article></body></html>",
  );
  assert.equal(doc.documentTitle, "My Page");
  assert.deepEqual(doc.headings, ["Heading"]);
  assert.ok(doc.extractedText.includes("Body text"));
});

test("unsupported formats are rejected with a helpful error", async () => {
  await assert.rejects(
    () => parseDocument(Buffer.from("MZ"), "malware.exe"),
    (err: unknown) => err instanceof UnsupportedFormatError && /Unsupported file type/.test((err as Error).message),
  );
});

test("magic-byte validation rejects mislabelled files", async () => {
  await assert.rejects(
    () => parseDocument(Buffer.from("not a pdf at all"), "fake.pdf"),
    /not a valid PDF/,
  );
});

test("sniffBytes recognises signatures", () => {
  assert.equal(sniffBytes(Buffer.from("%PDF-1.7")), "pdf");
  assert.equal(sniffBytes(Buffer.from([0x50, 0x4b, 0x03, 0x04])), "zip");
  assert.equal(sniffBytes(Buffer.from("plain text content")), "text");
});

test("extensionOf handles names without extensions", () => {
  assert.equal(extensionOf("report.PDF"), "pdf");
  assert.equal(extensionOf("noextension"), "");
});

// ── Library integrity ────────────────────────────────────────────────────────

test("library loads and is internally consistent", () => {
  const lib = loadLibrary();
  assert.ok(lib.sources.length > 0);
  assert.ok(lib.cases.length > 0);
  assert.ok(lib.ideas.length > 0);
  assert.ok(lib.knownConcepts.size > 0);

  // Every perspective source reference must resolve.
  for (const p of lib.perspectives) {
    for (const id of p.sourceIds) {
      assert.ok(lib.sources.some((s) => s.id === id), `perspective ${p.id} references missing source ${id}`);
    }
  }
});

test("demonstration records are marked synthetic and carry no fabricated URL", () => {
  const lib = loadLibrary();
  for (const s of lib.sources.filter((x) => x.synthetic)) {
    assert.equal(s.url, "", `synthetic source ${s.id} must not carry a fabricated URL`);
  }
});
