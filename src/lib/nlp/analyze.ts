/**
 * The universal document analysis pipeline.
 *
 *   text → normalise → chunk → keywords → entities → concepts → claims →
 *          queries → DocumentAnalysis
 *
 * Every step is local and deterministic. No LLM is contacted, ever. This is
 * what allows Lattice to understand material from ANY discipline, including
 * subjects no developer anticipated.
 */

import type { Concept, DocumentAnalysis, ExtractedEntities } from "../types";
import { extractClaims, extractiveSummary } from "./claims";
import { buildConcepts, buildQueries, contentHash, deriveMainTopic, novelConceptLabels } from "./concepts";
import { extractEntities, groupEntities } from "./entities";
import { buildTfIdf, extractKeywords, type TfIdfModel } from "./keywords";
import { detectLanguage, splitSentences, wordCount } from "./tokenize";

export interface KnowledgeContext {
  knownConcepts: Set<string>;
  kbRelations?: Map<string, string[]>;
  /** Corpus used for IDF. Falls back to the document itself. */
  idfModel?: TfIdfModel;
}

export interface AnalyzeOptions extends KnowledgeContext {
  documentTitle?: string;
  documentType?: string;
  /**
   * How the text arrived. A short topic query is not a failed extraction, so
   * the low-text warning is only meaningful for uploads and fetched pages.
   */
  inputKind?: "topic" | "text" | "file" | "url";
  /** Skip the claim/entity passes for very large inputs to bound latency. */
  fast?: boolean;
}

/** Split long text into overlapping chunks for later embedding/retrieval. */
export function chunkText(text: string, maxChars = 1200, overlap = 150): string[] {
  const sentences = splitSentences(text);
  const chunks: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if (buf.length + s.length + 1 > maxChars && buf.length > 0) {
      chunks.push(buf.trim());
      buf = buf.slice(Math.max(0, buf.length - overlap));
    }
    buf += (buf ? " " : "") + s;
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

function normaliseText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function analyzeText(rawText: string, opts: AnalyzeOptions): DocumentAnalysis {
  const warnings: string[] = [];
  const text = normaliseText(rawText);
  const hash = contentHash(text);

  if (text.length < 40) {
    if (opts.inputKind === "file") {
      warnings.push(
        "Very little text was extracted. If this file is a scanned PDF or an image, OCR may be required.",
      );
    } else if (opts.inputKind === "url") {
      warnings.push(
        "Very little text could be read from this page. It may be rendered client-side or sit behind a paywall.",
      );
    }
  }

  const wc = wordCount(text);
  const language = detectLanguage(text);

  // IDF model: prefer the supplied corpus so common terms across the library
  // are down-weighted; otherwise build from the document's own chunks.
  const chunks = chunkText(text, 1200, 150);
  // Build the fallback IDF model from SENTENCES, not whole-document chunks.
  // A short document otherwise collapses to a single "document", giving every
  // term the same IDF so raw frequency decides — which buries the terms the
  // document is actually about, since those often occur only once.
  const sentences = splitSentences(text).filter((s) => s.trim().length > 0);
  const idfModel =
    opts.idfModel ??
    buildTfIdf(sentences.length > 1 ? sentences : chunks.length > 1 ? chunks : [text]);

  const keywords = extractKeywords(text, idfModel, 40);
  const entities = opts.fast ? [] : extractEntities(text);
  const entityGroups: ExtractedEntities = entities.length ? groupEntities(entities) : emptyGroups();

  const concepts: Concept[] = buildConcepts({
    text,
    keywords,
    entities,
    knownConcepts: opts.knownConcepts,
    kbRelations: opts.kbRelations,
  });

  const claims = opts.fast ? [] : extractClaims(text, 12);
  const summary = extractiveSummary(text, 4);
  const mainTopic = deriveMainTopic(text, concepts);
  const novelConcepts = novelConceptLabels(concepts, 12);
  const queries = buildQueries(concepts, mainTopic, 8);

  if (concepts.length === 0 && wc > 0) {
    warnings.push(
      "No salient concepts could be isolated. This usually means the extracted text is fragmented or mostly numeric.",
    );
  }

  return {
    documentTitle: opts.documentTitle?.trim() || mainTopic,
    documentType: opts.documentType ?? "text",
    language,
    wordCount: wc,
    excerpt: text.slice(0, 600),
    mainTopic,
    summary,
    concepts,
    topics: concepts.filter((c) => c.kind !== "entity").slice(0, 8).map((c) => c.label),
    entities: entityGroups,
    claims,
    novelConcepts,
    queries,
    processingStatus: text.length < 40 ? "partial" : "completed",
    warnings,
    contentHash: hash,
  };
}

function emptyGroups(): ExtractedEntities {
  return { PERSON: [], ORG: [], LOCATION: [], DATE: [], STATISTIC: [], ACRONYM: [], WORK: [], MISC: [] };
}

/**
 * Quick analysis for interactive typing / suggestions — skips the expensive
 * entity and claim passes.
 */
export function analyzeQuick(rawText: string, known: Set<string>): DocumentAnalysis {
  return analyzeText(rawText, { knownConcepts: known, fast: true, documentType: "text" });
}
