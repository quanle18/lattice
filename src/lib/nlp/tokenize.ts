/**
 * Tokenisation + sentence splitting.
 * Pure functions, no dependencies, safe on both server and client.
 */

const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’\-.]*/gu;

export interface Token {
  /** Normalised (lowercased, trimmed) surface form. */
  text: string;
  /** Original surface form as it appeared. */
  raw: string;
  /** True when the token begins with an uppercase letter mid-sentence. */
  capitalised: boolean;
  /** True when the token is fully uppercase and >1 char (likely an acronym). */
  acronym: boolean;
  index: number;
}

export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .replace(/^['’\-.]+|['’\-.]+$/g, "")
    .trim();
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  const matches = text.matchAll(WORD_RE);
  let i = 0;
  for (const m of matches) {
    const raw = m[0];
    const text = normalizeWord(raw);
    if (!text) continue;
    const letters = raw.replace(/[^\p{L}]/gu, "");
    tokens.push({
      text,
      raw,
      capitalised: /^\p{Lu}/u.test(raw),
      acronym: letters.length >= 2 && letters === letters.toUpperCase() && /[\p{L}]/u.test(letters),
      index: i++,
    });
  }
  return tokens;
}

/**
 * Split text into sentences. Handles common abbreviations to avoid
 * over-splitting, which matters a lot for claim extraction.
 */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc", "e.g", "i.e",
  "fig", "no", "vol", "pp", "ed", "al", "cf", "approx", "dept", "est", "inc",
  "ltd", "co", "corp", "gov", "univ", "op", "cit",
]);

export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const out: string[] = [];
  let buf = "";
  const chars = Array.from(cleaned);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    buf += ch;
    if (ch === "." || ch === "!" || ch === "?" || ch === "…") {
      // Look ahead for closing quotes/brackets.
      let j = i + 1;
      while (j < chars.length && /["'”’)\]]/.test(chars[j])) {
        buf += chars[j];
        i = j;
        j++;
      }
      const next = chars[j];
      const atEnd = j >= chars.length;
      const followedBySpaceOrEnd = atEnd || /\s/.test(next);
      if (!followedBySpaceOrEnd) continue;
      const lastWord = buf
        .replace(/[.!?…"'”’)\]]+$/g, "")
        .split(/\s+/)
        .pop()
        ?.toLowerCase()
        .replace(/\.$/, "");
      if (lastWord && ABBREVIATIONS.has(lastWord)) continue;
      // Single-letter initials like "J." should not split.
      if (lastWord && lastWord.length === 1 && /[a-z]/.test(lastWord)) continue;
      out.push(buf.trim());
      buf = "";
    }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((s) => s.replace(/[^\p{L}\p{N}]/gu, "").length > 1);
}

export function wordCount(text: string): number {
  return (text.match(WORD_RE) || []).length;
}

/** Very light language detection via stopword density. */
export function detectLanguage(text: string): string {
  const tokens = tokenize(text)
    .slice(0, 2000)
    .map((t) => t.text);
  if (tokens.length === 0) return "en";
  let best = "en";
  let bestScore = 0;
  for (const [lang, set] of Object.entries(STOPWORD_SETS)) {
    let hits = 0;
    for (const t of tokens) if (set.has(t)) hits++;
    const score = hits / tokens.length;
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }
  return bestScore > 0.02 ? best : "en";
}

// Local import to avoid a cycle in the public API surface.
import { STOPWORDS as STOPWORD_SETS } from "./stopwords";
