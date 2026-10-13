/**
 * Local, deterministic embeddings — $0, offline, no model download.
 *
 * Strategy: a signed hashing vectorizer (a.k.a. "hashing trick") over word
 * unigrams, bigrams and character 4-grams. This gives useful lexical-semantic
 * similarity for matching, dedup and clustering without any external service.
 *
 * The `EmbeddingProvider` interface also allows a real local transformer
 * (e.g. @xenova/transformers) to be dropped in later without changing callers.
 */

import { tokenize } from "./tokenize";
import { isStopword } from "./stopwords";

export const EMBEDDING_DIM = 512;

export interface EmbeddingProvider {
  readonly id: string;
  readonly dim: number;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
}

/** FNV-1a 32-bit — fast, stable, dependency-free. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function addFeature(vec: Float32Array, feature: string, weight: number) {
  const h = fnv1a(feature);
  const idx = h % EMBEDDING_DIM;
  const sign = (h >>> 31) & 1 ? -1 : 1;
  vec[idx] += sign * weight;
}

function l2normalize(vec: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < vec.length; i++) vec[i] /= norm;
  return vec;
}

export function hashEmbed(text: string): Float32Array {
  const vec = new Float32Array(EMBEDDING_DIM);
  const tokens = tokenize(text)
    .map((t) => t.text)
    .filter((t) => t.length > 1 && !isStopword(t) && !/^\d+$/.test(t));

  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    addFeature(vec, `w:${w}`, 1.0);
    if (i + 1 < tokens.length) addFeature(vec, `b:${w}_${tokens[i + 1]}`, 0.6);
  }

  // Character 4-grams over the normalised text capture morphology and
  // tolerate typos / inflection differences.
  const compact = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (let i = 0; i + 4 <= compact.length; i += 1) {
    const gram = compact.slice(i, i + 4);
    if (gram.includes(" ")) continue;
    addFeature(vec, `c:${gram}`, 0.25);
  }

  return l2normalize(vec);
}

export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot; // vectors are L2-normalised
}

export class HashingEmbeddingProvider implements EmbeddingProvider {
  readonly id = "hashing-v1";
  readonly dim = EMBEDDING_DIM;
  async embed(text: string) {
    return hashEmbed(text);
  }
  async embedBatch(texts: string[]) {
    return texts.map(hashEmbed);
  }
}

/**
 * Optional real local model. Install `@xenova/transformers` to activate;
 * until then this transparently falls back to the hashing provider.
 * Kept behind a dynamic import so the default install stays tiny and $0.
 */
export class LocalTransformerProvider implements EmbeddingProvider {
  readonly id = "local-transformer";
  private pipe: unknown = null;
  dim = 384;
  constructor(private model = "Xenova/all-MiniLM-L6-v2") {}

  private async getPipe() {
    if (this.pipe) return this.pipe;
    const dynamicImport = new Function("m", "return import(m)") as (m: string) => Promise<unknown>;
    const mod = (await dynamicImport("@xenova/transformers")) as {
      pipeline: (task: string, model: string) => Promise<unknown>;
    };
    this.pipe = await mod.pipeline("feature-extraction", this.model);
    return this.pipe;
  }

  async embed(text: string): Promise<Float32Array> {
    try {
      const pipe = (await this.getPipe()) as (
        t: string,
        o: { pooling: string; normalize: boolean },
      ) => Promise<{ data: Float32Array }>;
      const out = await pipe(text, { pooling: "mean", normalize: true });
      return out.data;
    } catch {
      return hashEmbed(text);
    }
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const out: Float32Array[] = [];
    for (const t of texts) out.push(await this.embed(t));
    return out;
  }
}

export function defaultEmbeddingProvider(): EmbeddingProvider {
  return new HashingEmbeddingProvider();
}
