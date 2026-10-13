/**
 * Deterministic keyword / keyphrase extraction.
 *
 * Two complementary, dependency-free methods:
 *   1. RAKE  — phrase-boundary scoring using stopwords as delimiters.
 *   2. TF-IDF — corpus-relative term importance.
 *
 * Neither requires a model download or an API call. This is the first layer
 * of the universal concept pipeline and it works for ANY domain.
 */

import { isStopword } from "./stopwords";
import { normalizeWord, tokenize } from "./tokenize";

const PHRASE_BREAK = /[.,;:!?()\[\]{}"“”'’<>/\\|@#$%^&*_+=~`\n\r\t]+/;

export interface Keyphrase {
  text: string;
  score: number;
  /** Number of distinct content words in the phrase. */
  length: number;
  /** How many times the phrase (normalised) occurs. */
  occurrences: number;
}

/** Function words that commonly sit *inside* a real concept phrase. */
const CONNECTIVES = new Set(["of", "for", "in", "to", "on", "with", "and", "or", "from", "by"]);

interface Candidate {
  words: string[];
  raw: string;
}

function candidatePhrases(text: string, maxWords: number): Candidate[] {
  const out: Candidate[] = [];
  for (const rawSegment of text.split(PHRASE_BREAK)) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    const words = segment.split(/\s+/);
    let current: string[] = [];
    const flush = () => {
      if (current.length > 0 && current.length <= maxWords) {
        out.push({ words: current.slice(), raw: current.join(" ") });
      }
      current = [];
    };
    for (const w of words) {
      const norm = normalizeWord(w);
      if (!norm || isStopword(norm) || norm.length < 2) {
        flush();
      } else {
        current.push(norm);
      }
    }
    flush();
  }
  return out;
}

/**
 * RAKE treats every stopword as a hard phrase boundary, so it can never
 * surface a phrase such as "balance of power". Recover short windows that
 * begin and end on a content word but contain connectives in between.
 */
function stopwordSpanningCandidates(text: string, maxWords: number): Candidate[] {
  const out: Candidate[] = [];
  for (const rawSegment of text.split(PHRASE_BREAK)) {
    const segment = rawSegment.trim();
    if (!segment) continue;
    const words = segment
      .split(/\s+/)
      .map((w) => normalizeWord(w))
      .filter((w) => w.length >= 2);
    for (let i = 0; i < words.length; i++) {
      if (isStopword(words[i])) continue; // must open on a content word
      for (let len = 2; len <= maxWords && i + len <= words.length; len++) {
        const slice = words.slice(i, i + len);
        if (isStopword(slice[slice.length - 1])) continue; // must close on one too
        const inner = slice.slice(1, -1);
        // Every inner token must be a connective, so we join "balance of
        // power" without gluing whole clauses together.
        if (inner.length === 0 || !inner.every((w) => CONNECTIVES.has(w))) continue;
        out.push({ words: slice, raw: slice.join(" ") });
      }
    }
  }
  return out;
}

/**
 * RAKE: score each content word by degree/frequency, then sum over phrases.
 * Reference: Rose et al. (2010), "Automatic Keyword Extraction from
 * Individual Documents".
 */
export function rakeKeyphrases(text: string, opts?: { maxWords?: number; limit?: number }): Keyphrase[] {
  const maxWords = opts?.maxWords ?? 4;
  const limit = opts?.limit ?? 40;
  const candidates = [
    ...candidatePhrases(text, maxWords),
    ...stopwordSpanningCandidates(text, maxWords),
  ];
  if (candidates.length === 0) return [];

  const freq = new Map<string, number>();
  const degree = new Map<string, number>();
  for (const c of candidates) {
    // Connectives carry no topical weight, so they must not inflate scores.
    const content = c.words.filter((w) => !isStopword(w));
    for (const w of content) freq.set(w, (freq.get(w) ?? 0) + 1);
    for (const w of new Set(content)) degree.set(w, (degree.get(w) ?? 0) + (content.length - 1));
  }

  const wordScore = (w: string) => {
    const f = freq.get(w) ?? 0;
    const d = degree.get(w) ?? 0;
    return d + f; // degree/frequency ratio form, simplified and stable
  };

  const byPhrase = new Map<string, Keyphrase>();
  for (const c of candidates) {
    const key = c.words.join(" ");
    let score = 0;
    for (const w of c.words) if (!isStopword(w)) score += wordScore(w);
    // Prefer phrases of 2–3 words: single generic words are noisy.
    const lengthBoost = c.words.length >= 2 ? 1 + (c.words.length - 1) * 0.15 : 0.55;
    score *= lengthBoost;
    const existing = byPhrase.get(key);
    if (existing) {
      existing.occurrences += 1;
      existing.score += score;
    } else {
      byPhrase.set(key, { text: key, score, length: c.words.length, occurrences: 1 });
    }
  }

  return Array.from(byPhrase.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ── TF-IDF ───────────────────────────────────────────────────────────────────

export interface TfIdfModel {
  idf: Map<string, number>;
  docCount: number;
}

export function termFrequencies(text: string): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokenize(text)) {
    if (t.text.length < 2 || isStopword(t.text) || /^\d+$/.test(t.text)) continue;
    tf.set(t.text, (tf.get(t.text) ?? 0) + 1);
  }
  return tf;
}

/** Build an IDF model from a corpus of documents. */
export function buildTfIdf(corpus: string[]): TfIdfModel {
  const df = new Map<string, number>();
  for (const doc of corpus) {
    const seen = new Set(termFrequencies(doc).keys());
    for (const term of seen) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const N = Math.max(corpus.length, 1);
  const idf = new Map<string, number>();
  for (const [term, d] of df) {
    idf.set(term, Math.log((N + 1) / (d + 1)) + 1);
  }
  return { idf, docCount: N };
}

export interface RankedTerm {
  term: string;
  score: number;
}

/**
 * Score terms of a document against a model. When no model is supplied we
 * fall back to plain frequency × length weighting, so this is always usable.
 */
export function tfidfTerms(
  text: string,
  model?: TfIdfModel,
  limit = 50,
): RankedTerm[] {
  const tf = termFrequencies(text);
  const total = Array.from(tf.values()).reduce((a, b) => a + b, 0) || 1;
  const scored: RankedTerm[] = [];
  for (const [term, count] of tf) {
    const tfNorm = count / total;
    const idf = model?.idf.get(term) ?? 1.5;
    scored.push({ term, score: tfNorm * idf });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Merge RAKE phrases and TF-IDF terms into a single ranked candidate list.
 * Bigrams/trigrams from RAKE are kept as phrases; single words come from
 * TF-IDF so that domain vocabulary is not lost.
 */
export interface MergedKeyword {
  text: string;
  score: number;
  kind: "phrase" | "term";
}

export function extractKeywords(
  text: string,
  model?: TfIdfModel,
  limit = 30,
): MergedKeyword[] {
  const phrases = rakeKeyphrases(text, { maxWords: 4, limit: 60 });
  const terms = tfidfTerms(text, model, 80);

  const maxPhrase = phrases[0]?.score ?? 1;
  const maxTerm = terms[0]?.score ?? 1;

  const merged = new Map<string, MergedKeyword>();

  for (const p of phrases) {
    if (p.length < 2) continue;
    merged.set(p.text, {
      text: p.text,
      score: (p.score / maxPhrase) * 1.0,
      kind: "phrase",
    });
  }

  for (const t of terms) {
    if (t.term.length < 4) continue;
    const existing = merged.get(t.term);
    const norm = t.score / maxTerm;
    if (existing) {
      existing.score = Math.max(existing.score, norm * 0.85);
    } else {
      merged.set(t.term, { text: t.term, score: norm * 0.6, kind: "term" });
    }
  }

  const ranked = Array.from(merged.values()).sort((a, b) => b.score - a.score);
  // RAKE phrases otherwise crowd out single salient terms, which are often the
  // most useful anchors ("multipolarity", "fragmentation"). Reserve slots for
  // the strongest terms so both kinds survive the cut.
  const termSlots = Math.max(3, Math.floor(limit / 3));
  const phraseSlots = Math.max(1, limit - termSlots);
  const topPhrases = ranked.filter((k) => k.kind === "phrase").slice(0, phraseSlots);
  const topTerms = ranked.filter((k) => k.kind === "term").slice(0, termSlots);
  return [...topPhrases, ...topTerms].sort((a, b) => b.score - a.score);
}
