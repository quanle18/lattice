/**
 * End-to-end verification script (offline / $0).
 *
 * Runs the full exploration pipeline on documents from unrelated disciplines
 * with NO network access and NO API keys, and prints what it found. This is
 * the human-readable counterpart to `npm test` and the regression check the
 * specification asked for.
 *
 * Run with:  npm run verify
 */

import { explore } from "../src/lib/explore/engine";
import { parseMarkdown } from "../src/lib/parsers/text";
import { runtimeMode, persistenceMode } from "../src/lib/config";
import { libraryStats } from "../src/lib/kb/repository";

const DOCUMENTS: Array<{ name: string; text: string }> = [
  {
    name: "International Relations",
    text: `# The Changing Nature of International Relations

Contemporary international relations are increasingly described as multipolar. Unlike the
bipolar structure of the Cold War, power today is distributed across several centres, and no
single state can set the terms of the international order alone.

Multipolarity is frequently associated with the balance of power. Economic interdependence
complicates this picture: trade between rivals creates leverage that can be used coercively,
yet it also creates domestic constituencies that favour restraint.

Middle powers have responded by pursuing strategic autonomy. Rather than aligning formally with
one great power, they hedge, diversify suppliers, and deepen regional institutions. The
security dilemma has returned in new domains, and competition over semiconductors and
artificial intelligence is now framed as national security policy.

Institutions designed for a different distribution of power have struggled to adapt, and
diplomacy increasingly takes place in ad hoc coalitions.`,
  },
  {
    name: "Biology",
    text: `# Selection Pressures in Fragmented Habitats

Habitat fragmentation reduces gene flow between populations and changes the strength of natural
selection. In small, isolated populations, genetic drift can overwhelm selection, so adaptive
responses to environmental change may be slower than theory predicts.

The microbiome offers a parallel case. Microbial communities respond rapidly to dietary change,
and metabolic outcomes correlate with microbial composition. Correlation is not causation, and
intervention studies are needed to separate the two.`,
  },
  {
    name: "Philosophy",
    text: `# The Explanatory Gap and Consciousness

The hard problem of consciousness concerns why physical processes are accompanied by subjective
experience at all. Defenders of an explanatory gap argue that no amount of third-person
description entails first-person experience, so the gap is principled rather than merely
empirical. Critics reply that apparent explanatory gaps have dissolved before as science
matured, and that the intuition may reflect current ignorance rather than a permanent limit.
The debate turns on what would count as an explanation of experience, and on whether
epistemic limits can be distinguished from metaphysical ones.`,
  },
];

async function main() {
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  LATTICE — offline verification");
  console.log("══════════════════════════════════════════════════════════════\n");

  const stats = libraryStats();
  console.log(`Runtime mode      : ${runtimeMode()}`);
  console.log(`Persistence       : ${persistenceMode()}`);
  console.log(
    `Library           : ${stats.sources} sources · ${stats.cases} cases · ${stats.ideas} ideas · ${stats.perspectives} perspectives · ${stats.concepts} concepts`,
  );
  console.log(`Synthetic records : ${stats.synthetic}\n`);

  let failures = 0;

  for (const doc of DOCUMENTS) {
    const parsed = parseMarkdown(doc.text, `${doc.name.toLowerCase().replace(/\s+/g, "-")}.md`);
    const result = await explore({
      text: parsed.extractedText,
      kind: "text",
      label: parsed.documentTitle,
      documentTitle: parsed.documentTitle,
      documentType: "markdown",
      offline: true,
    });

    console.log("──────────────────────────────────────────────────────────────");
    console.log(`▸ ${doc.name}: ${result.analysis.documentTitle}`);
    console.log("──────────────────────────────────────────────────────────────");
    console.log(`  words            : ${result.analysis.wordCount}`);
    console.log(`  concepts         : ${result.analysis.concepts.length} (${result.analysis.concepts.filter((c) => c.known).length} in library, ${result.analysis.novelConcepts.length} new)`);
    console.log(`  queries          : ${result.analysis.queries.slice(0, 3).join(" | ")}`);
    console.log(`  top concepts     : ${result.analysis.concepts.slice(0, 8).map((c) => c.label).join(", ")}`);
    console.log(`  cases matched    : ${result.cases.length}`);
    console.log(`  ideas matched    : ${result.ideas.length}`);
    console.log(`  perspectives     : ${result.perspectives.length}`);
    console.log(`  map              : ${result.map.nodes.length} nodes / ${result.map.edges.length} edges`);
    console.log(`  next steps       : ${result.next.length}`);
    if (result.next[0]) console.log(`    → ${result.next[0].label}`);

    // Acceptance checks.
    if (result.analysis.concepts.length === 0) {
      console.error(`  ✗ FAIL: no concepts extracted for ${doc.name}`);
      failures++;
    }
    if (result.analysis.processingStatus !== "completed") {
      console.error(`  ✗ FAIL: processing status was ${result.analysis.processingStatus}`);
      failures++;
    }
    if (result.analysis.warnings.some((w) => /no known concepts/i.test(w))) {
      console.error(`  ✗ FAIL: reported "no known concepts" for ${doc.name}`);
      failures++;
    }
    if (result.map.edges.length === 0) {
      console.error(`  ✗ FAIL: knowledge map had no edges for ${doc.name}`);
      failures++;
    }
    if (result.next.length === 0) {
      console.error(`  ✗ FAIL: no next-exploration suggestions for ${doc.name}`);
      failures++;
    }
    if (result.mode !== "demo") {
      console.error(`  ✗ FAIL: expected demo mode when offline, got ${result.mode}`);
      failures++;
    }
    console.log("  ✓ checks passed\n");
  }

  console.log("══════════════════════════════════════════════════════════════");
  if (failures === 0) {
    console.log("  ✓ ALL CHECKS PASSED — domain-independent, offline, $0");
  } else {
    console.error(`  ✗ ${failures} check(s) failed`);
  }
  console.log("══════════════════════════════════════════════════════════════\n");

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
