/**
 * Heuristic named-entity recognition.
 *
 * No model, no API. Combines:
 *   - capitalisation sequences (proper-noun chunks)
 *   - acronym detection
 *   - organisation suffix patterns
 *   - a small, extensible gazetteer for countries/regions
 *   - numeric/statistical and temporal patterns
 *
 * It is intentionally conservative: precision over recall, and everything is
 * traceable back to a span in the source text.
 */

import { normalizeWord, splitSentences, tokenize } from "./tokenize";

export type EntityKind =
  | "PERSON"
  | "ORG"
  | "LOCATION"
  | "DATE"
  | "STATISTIC"
  | "ACRONYM"
  | "WORK"
  | "MISC";

export interface Entity {
  text: string;
  kind: EntityKind;
  count: number;
  /** Sentences the entity appears in — used for claim grounding. */
  sampleContext: string;
}

const ORG_SUFFIXES =
  /\b(Inc|LLC|Ltd|Corp|Corporation|Company|Co|Group|Holdings|Foundation|Institute|Institution|University|College|School|Ministry|Department|Agency|Commission|Council|Committee|Association|Organization|Organisation|Union|Bank|Fund|Programme|Program|Center|Centre|Bureau|Office|Authority|Court|Party|Army|Navy|Alliance|Coalition|Federation|Consortium|Laboratory|Lab)\b/i;

const WORK_HINTS =
  /\b(Act|Treaty|Convention|Agreement|Protocol|Accord|Declaration|Charter|Report|Plan|Strategy|Initiative|Framework|Directive|Regulation|Policy|Theory|Model|Theorem|Hypothesis|Principle|Effect|Paradox|Dilemma)\b/i;

/** Extensible gazetteer — countries, regions, major cities, blocs. */
const GAZETTEER: Set<string> = new Set(
  `afghanistan albania algeria argentina armenia australia austria azerbaijan bangladesh belarus belgium bolivia brazil bulgaria cambodia cameroon canada chad chile china colombia croatia cuba cyprus czechia denmark ecuador egypt estonia ethiopia finland france georgia germany ghana greece hungary iceland india indonesia iran iraq ireland israel italy japan jordan kazakhstan kenya kuwait laos latvia lebanon libya lithuania malaysia mali mexico moldova mongolia morocco myanmar nepal netherlands new zealand nigeria north korea norway oman pakistan palestine panama peru philippines poland portugal qatar romania russia rwanda saudi arabia senegal serbia singapore slovakia slovenia somalia south africa south korea spain sri lanka sudan sweden switzerland syria taiwan tajikistan tanzania thailand tunisia turkey turkmenistan uganda ukraine united arab emirates united kingdom united states uruguay uzbekistan venezuela vietnam yemen zambia zimbabwe
  europe asia africa oceania antarctica
  "european union" "united nations" nato asean brics g7 g20 opec mercosur "african union" "world bank" imf "world trade organization" "international monetary fund" oecd
  washington beijing moscow london paris berlin brussels tokyo delhi hanoi saigon bangkok jakarta seoul taipei geneva davos new york silicon valley
  "southeast asia" "east asia" "south asia" "central asia" "middle east" "north africa" "sub-saharan africa" "latin america" "north america" "western europe" "eastern europe" "scandinavia" "balkans" "persian gulf" "south china sea" "arctic" "sahel"`.split(
    /\s+/,
  ),
);

const STOPWORD_STARTS = new Set([
  "The", "This", "That", "These", "Those", "However", "Therefore", "Moreover",
  "Furthermore", "In", "On", "At", "For", "But", "And", "Or", "As", "It", "We",
  "They", "He", "She", "There", "When", "While", "Because", "Although", "If",
]);

function isSentenceStart(tokens: { raw: string }[], i: number): boolean {
  return i === 0;
}

export function extractEntities(text: string): Entity[] {
  const sentences = splitSentences(text);
  const map = new Map<string, Entity>();

  const add = (raw: string, kind: EntityKind, context: string) => {
    const key = raw.trim();
    if (key.length < 2 || key.length > 80) return;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.sampleContext.length < context.length) existing.sampleContext = context;
    } else {
      map.set(key, { text: key, kind, count: 1, sampleContext: context });
    }
  };

  for (const sentence of sentences) {
    const tokens = tokenize(sentence);

    // ── Capitalised sequences (proper nouns) ────────────────────────────────
    let run: { raw: string; text: string }[] = [];
    const flushRun = () => {
      if (run.length === 0) return;
      const phrase = run.map((t) => t.raw).join(" ");
      const first = run[0].raw;
      const isStart = STOPWORD_STARTS.has(first);
      const multi = run.length > 1;
      if (!(isStart && !multi) && phrase.replace(/[^\p{L}]/gu, "").length >= 2) {
        let kind: EntityKind = "MISC";
        const lower = phrase.toLowerCase();
        if (GAZETTEER.has(lower)) kind = "LOCATION";
        else if (ORG_SUFFIXES.test(phrase)) kind = "ORG";
        else if (WORK_HINTS.test(phrase)) kind = "WORK";
        else if (multi) kind = "PERSON";
        else if (run[0].raw.length > 2) kind = "MISC";
        else {
          run = [];
          return;
        }
        // Single capitalised common words are usually sentence starts.
        if (kind === "MISC" && !multi && isStart && !GAZETTEER.has(lower)) {
          run = [];
          return;
        }
        add(phrase, kind, sentence);
      }
      run = [];
    };

    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const cap = /^\p{Lu}/u.test(t.raw) || t.acronym;
      if (cap && !isSentenceStart(tokens, i)) {
        run.push({ raw: t.raw, text: t.text });
      } else if (cap && isSentenceStart(tokens, i) && run.length === 0) {
        // Could still be a proper noun at the start; tentatively accept and
        // let the kind classifier decide.
        run.push({ raw: t.raw, text: t.text });
      } else {
        flushRun();
      }
    }
    flushRun();

    // ── Acronyms ────────────────────────────────────────────────────────────
    for (const t of tokens) {
      if (t.acronym && t.raw.replace(/[^\p{L}]/gu, "").length >= 2) {
        add(t.raw.replace(/[^\p{L}\p{N}]/gu, ""), "ACRONYM", sentence);
      }
    }

    // ── Statistics & dates ─────────────────────────────────────────────────
    for (const m of sentence.matchAll(
      /\b\d{1,3}(?:[.,]\d+)?\s?(?:%|percent|percentage points?|million|billion|trillion|thousand|bn|m)\b/gi,
    )) {
      add(m[0].trim(), "STATISTIC", sentence);
    }
    for (const m of sentence.matchAll(
      /\b(?:19|20)\d{2}(?:\s?[–-]\s?(?:19|20)?\d{2})?\b/g,
    )) {
      add(m[0].trim(), "DATE", sentence);
    }
    for (const m of sentence.matchAll(
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/g,
    )) {
      add(m[0].trim(), "DATE", sentence);
    }
  }

  return Array.from(map.values())
    .filter((e) => e.count > 0)
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
}

/** Group entities by kind, most frequent first. */
export function groupEntities(entities: Entity[]): Record<EntityKind, string[]> {
  const out = {
    PERSON: [] as string[],
    ORG: [] as string[],
    LOCATION: [] as string[],
    DATE: [] as string[],
    STATISTIC: [] as string[],
    ACRONYM: [] as string[],
    WORK: [] as string[],
    MISC: [] as string[],
  };
  for (const e of entities) out[e.kind].push(e.text);
  return out;
}
