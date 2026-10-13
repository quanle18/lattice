/**
 * Persistence contracts for account data.
 *
 * Two interchangeable implementations:
 *   - local-json: zero-dependency, single-instance (dev / self-hosted)
 *   - supabase:   free-tier Postgres + Row Level Security (serverless-safe)
 *
 * The knowledge library is NOT stored here — it is versioned seed data plus
 * optional provider results. Only user-owned data goes through this layer.
 */

import type { UsageRecord, UserAccount } from "../types";

export interface SavedItem {
  id: string;
  userId: string;
  /** "case" | "idea" | "source" | "exploration" */
  kind: string;
  refId: string;
  title: string;
  url?: string;
  payload?: unknown;
  createdAt: string;
}

export interface PrivacyRequest {
  id: string;
  userId: string;
  email: string;
  type: "access" | "correction" | "deletion" | "closure" | "question";
  message?: string;
  status: "REQUESTED" | "UNDER REVIEW" | "PROCESSING" | "COMPLETED";
  createdAt: string;
  updatedAt: string;
}

export interface StoredExploration {
  id: string;
  userId: string;
  label: string;
  kind: string;
  createdAt: string;
  payload: unknown;
}

export interface AccountStore {
  readonly kind: "local-json" | "supabase";

  // Accounts
  createUser(input: { email: string; passwordHash: string | null; marketingOptIn: boolean; termsVersion: string; privacyVersion: string }): Promise<UserAccount>;
  findUserByEmail(email: string): Promise<(UserAccount & { passwordHash: string | null }) | null>;
  findUserById(id: string): Promise<UserAccount | null>;
  updateUser(id: string, patch: Partial<UserAccount>): Promise<UserAccount | null>;
  deleteUser(id: string): Promise<void>;
  listUsers(): Promise<UserAccount[]>;

  // Saved items
  saveItem(item: Omit<SavedItem, "id" | "createdAt">): Promise<SavedItem>;
  listSaved(userId: string): Promise<SavedItem[]>;
  removeSaved(userId: string, id: string): Promise<void>;

  // Explorations
  saveExploration(item: Omit<StoredExploration, "createdAt">): Promise<StoredExploration>;
  listExplorations(userId: string): Promise<StoredExploration[]>;

  // Usage
  recordUsage(record: UsageRecord): Promise<void>;
  usageSummary(userId: string): Promise<{ aiCalls: number; searchCalls: number; explorations: number; estimatedCost: number }>;

  // Privacy
  createPrivacyRequest(input: Omit<PrivacyRequest, "id" | "createdAt" | "updatedAt" | "status">): Promise<PrivacyRequest>;
  listPrivacyRequests(): Promise<PrivacyRequest[]>;
  updatePrivacyRequestStatus(id: string, status: PrivacyRequest["status"]): Promise<void>;
}
