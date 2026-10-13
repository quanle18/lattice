/**
 * Shared domain types. Kept in one place so the parsers, NLP layer,
 * knowledge base, recommendation engine and API all agree on shapes.
 */

// ── Sources ──────────────────────────────────────────────────────────────────

export type SourceKind =
  | "academic"
  | "news"
  | "government"
  | "data"
  | "reference"
  | "perspective"
  | "book"
  | "company"
  | "primary"
  | "educational";

export type QualityTier =
  | "PRIMARY"
  | "ACADEMIC"
  | "HIGH-QUALITY JOURNALISM"
  | "SECONDARY"
  | "GENERAL REFERENCE"
  | "DEBATE / PERSPECTIVE";

export interface SourceRecord {
  id: string;
  title: string;
  publisher: string;
  author?: string;
  date?: string;
  url: string;
  kind: SourceKind;
  quality: QualityTier;
  topics: string[];
  tags: string[];
  country?: string;
  industry?: string;
  description?: string;
  doi?: string;
  /** Where the record came from: internal library, cache, or a live provider. */
  origin: "library" | "provider" | "demo";
  /** Provider id, when origin === "provider". */
  provider?: string;
  retrievedAt?: string;
  /** Set when a live record could not be fully verified. */
  verification?: "verified" | "unverified" | "metadata-only";
  /** True for demonstration-library records. The UI labels these as fictional. */
  synthetic?: boolean;
}

/** A perspective together with the sources that back it. */
export interface PerspectiveWithSources extends PerspectiveRecord {
  sources: SourceRecord[];
}

// ── Knowledge-base entities ──────────────────────────────────────────────────

export interface CaseRecord {
  id: string;
  title: string;
  shortDescription: string;
  longDescription?: string;
  topics: string[];
  subtopics?: string[];
  tags: string[];
  industry?: string;
  country?: string;
  region?: string;
  year?: number;
  timePeriod?: string;
  relatedConcepts?: string[];
  relatedCases?: string[];
  researchQuestions?: string[];
  sourceUrls?: string[];
  sourceQuality?: QualityTier;
  /** Demo datasets are explicitly marked so the UI can label them fictional. */
  synthetic?: boolean;
}

export interface IdeaRecord {
  id: string;
  title: string;
  description: string;
  topics: string[];
  subtopics?: string[];
  tags: string[];
  difficulty?: "introductory" | "intermediate" | "advanced";
  researchType?: string;
  relatedCases?: string[];
  relatedSources?: string[];
  relatedQuestions?: string[];
  synthetic?: boolean;
}

export interface PerspectiveRecord {
  id: string;
  claim: string;
  topic: string;
  stance: "supporting" | "challenging";
  summary: string;
  /** Source ids backing this position — every position must be traceable. */
  sourceIds: string[];
  synthetic?: boolean;
}

export interface TopicRelationRecord {
  from: string;
  to: string;
  type: string;
}

// ── Concept extraction ───────────────────────────────────────────────────────

export interface Concept {
  id: string;
  label: string;
  /** Normalised key used for matching. */
  key: string;
  score: number;
  /** Where the concept was recognised. */
  origin: "extracted" | "taxonomy" | "library" | "entity" | "ai";
  /** Discipline ids from the taxonomy (may be empty for niche subjects). */
  disciplines: string[];
  /** True when the concept exists in the internal knowledge base. */
  known: boolean;
  /** A short sentence from the document that grounds the concept. */
  evidence?: string;
  related: string[];
  kind?: "concept" | "entity" | "topic";
}

export interface Claim {
  text: string;
  /** Sentences in the document that support the claim. */
  evidence: string[];
  /** Signal words that made this look like a claim. */
  signals: string[];
}

export interface ExtractedEntities {
  PERSON: string[];
  ORG: string[];
  LOCATION: string[];
  DATE: string[];
  STATISTIC: string[];
  ACRONYM: string[];
  WORK: string[];
  MISC: string[];
}

export interface DocumentAnalysis {
  documentTitle: string;
  documentType: string;
  language: string;
  wordCount: number;
  /** First ~600 characters of the extracted text, for previews. */
  excerpt: string;
  mainTopic: string;
  summary: string;
  concepts: Concept[];
  topics: string[];
  entities: ExtractedEntities;
  claims: Claim[];
  /** Concepts not present in the internal knowledge base. */
  novelConcepts: string[];
  /** Search queries derived from concepts — used for provider discovery. */
  queries: string[];
  processingStatus: "completed" | "partial" | "failed";
  warnings: string[];
  /** Content hash for caching. */
  contentHash: string;
}

// ── Parsing ──────────────────────────────────────────────────────────────────

export interface ParsedDocument {
  documentTitle: string;
  documentType: string;
  extractedText: string;
  headings: string[];
  tables: string[][][];
  metadata: Record<string, string | number | boolean | undefined>;
  warnings: string[];
  pageCount?: number;
}

// ── Recommendations ──────────────────────────────────────────────────────────

export interface RelevanceBreakdown {
  topic: number;
  tag: number;
  concept: number;
  industry: number;
  geography: number;
  time: number;
  quality: number;
  semantic: number;
}

export interface Recommendation<T> {
  item: T;
  score: number;
  breakdown: RelevanceBreakdown;
  /** Deterministic, human-readable reason this item was surfaced. */
  reasons: string[];
}

export interface KnowledgeMapNode {
  id: string;
  label: string;
  kind: "concept" | "entity" | "topic";
  weight: number;
  known: boolean;
  disciplines: string[];
}

export interface KnowledgeMapEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

export interface KnowledgeMap {
  nodes: KnowledgeMapNode[];
  edges: KnowledgeMapEdge[];
}

export interface NextExploration {
  label: string;
  rationale: string;
  action:
    | { type: "explore"; query: string }
    | { type: "concept"; concept: string }
    | { type: "source"; sourceId: string };
}

export interface ExplorationResult {
  id: string;
  createdAt: string;
  input: {
    kind: "topic" | "text" | "file" | "url";
    label: string;
    sourceName?: string;
    url?: string;
  };
  analysis: DocumentAnalysis;
  cases: Recommendation<CaseRecord>[];
  ideas: Recommendation<IdeaRecord>[];
  sources: Recommendation<SourceRecord>[];
  perspectives: PerspectiveWithSources[];
  map: KnowledgeMap;
  next: NextExploration[];
  dataPoints: DataPoint[];
  providers: ProviderReport[];
  mode: "demo" | "live";
  warnings: string[];
}

export interface DataPoint {
  label: string;
  value: string;
  unit?: string;
  year?: number;
  country?: string;
  sourceId?: string;
}

export interface ProviderReport {
  id: string;
  label: string;
  status: "ok" | "empty" | "unavailable" | "skipped" | "error";
  resultCount: number;
  message?: string;
  cached?: boolean;
}

// ── Accounts / usage ─────────────────────────────────────────────────────────

export interface UserAccount {
  id: string;
  email: string;
  createdAt: string;
  plan: "free" | "pro";
  status: "active" | "suspended" | "deleted";
  consentStatus: "accepted" | "pending";
  marketingOptIn: boolean;
  termsVersion: string;
  privacyVersion: string;
}

export interface UsageRecord {
  userId: string;
  feature: string;
  aiCalls: number;
  searchCalls: number;
  embeddingCalls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  processingTimeMs: number;
  cacheHit: boolean;
  timestamp: string;
}
