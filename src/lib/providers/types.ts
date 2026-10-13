/**
 * Provider contracts. Every external capability sits behind one of these
 * interfaces so it can be replaced or removed without touching callers.
 */

import type { DataPoint, SourceRecord } from "../types";

export type { DataPoint };

export interface ProviderQuery {
  /** Concepts/keywords driving the search. */
  queries: string[];
  /** Primary topic, used as a fallback query. */
  topic: string;
  /** Detected locations, for geo-filtered providers. */
  locations: string[];
  limit?: number;
}

export interface ProviderResult {
  sources: SourceRecord[];
  /** Optional structured data points (e.g. statistics). */
  dataPoints?: DataPoint[];
  /** Free-form provider note shown in the UI. */
  note?: string;
}

export interface SourceProvider {
  readonly id: string;
  readonly label: string;
  readonly kind: SourceRecord["kind"] | "mixed";
  /** True when the provider needs no API key. */
  readonly keyless: boolean;
  /** Whether the provider is currently enabled by configuration. */
  isEnabled(): boolean;
  search(query: ProviderQuery): Promise<ProviderResult>;
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  isEnabled(): boolean;
  complete(prompt: string, opts?: { maxTokens?: number; system?: string }): Promise<string>;
}
