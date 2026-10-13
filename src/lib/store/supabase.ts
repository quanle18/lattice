/**
 * Supabase-backed account store (free tier, serverless-safe).
 *
 * Uses the service-role key ONLY on the server. Authentication itself is
 * delegated to Supabase Auth, so passwords are never handled by this code.
 *
 * Expected tables are defined in supabase/migrations/0001_init.sql.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { config } from "../config";
import type { UsageRecord, UserAccount } from "../types";
import type { AccountStore, PrivacyRequest, SavedItem, StoredExploration } from "./types";

interface ProfileRow {
  id: string;
  email: string;
  created_at: string;
  plan: string;
  status: string;
  consent_status: string;
  marketing_opt_in: boolean;
  terms_version: string;
  privacy_version: string;
}

function toAccount(row: ProfileRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at,
    plan: (row.plan as UserAccount["plan"]) ?? "free",
    status: (row.status as UserAccount["status"]) ?? "active",
    consentStatus: (row.consent_status as UserAccount["consentStatus"]) ?? "pending",
    marketingOptIn: row.marketing_opt_in,
    termsVersion: row.terms_version,
    privacyVersion: row.privacy_version,
  };
}

export class SupabaseAccountStore implements AccountStore {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(config.supabase.url, config.supabase.serviceRoleKey || config.supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async createUser(input: { email: string; passwordHash: string | null; marketingOptIn: boolean; termsVersion: string; privacyVersion: string }): Promise<UserAccount> {
    // Supabase Auth owns credentials; this creates/updates the profile row.
    const { data, error } = await this.client
      .from("profiles")
      .upsert(
        {
          email: input.email.toLowerCase(),
          marketing_opt_in: input.marketingOptIn,
          terms_version: input.termsVersion,
          privacy_version: input.privacyVersion,
          consent_status: "accepted",
        },
        { onConflict: "email" },
      )
      .select()
      .single();
    if (error) throw new Error(`Failed to create profile: ${error.message}`);
    return toAccount(data as ProfileRow);
  }

  async findUserByEmail(email: string) {
    const { data, error } = await this.client.from("profiles").select("*").eq("email", email.toLowerCase()).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    // Password hashes live in Supabase Auth; this returns null by design.
    return { ...toAccount(data as ProfileRow), passwordHash: null };
  }

  async findUserById(id: string) {
    const { data, error } = await this.client.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toAccount(data as ProfileRow) : null;
  }

  async updateUser(id: string, patch: Partial<UserAccount>) {
    const row: Record<string, unknown> = {};
    if (patch.plan) row.plan = patch.plan;
    if (patch.status) row.status = patch.status;
    if (patch.consentStatus) row.consent_status = patch.consentStatus;
    if (patch.marketingOptIn !== undefined) row.marketing_opt_in = patch.marketingOptIn;
    const { data, error } = await this.client.from("profiles").update(row).eq("id", id).select().maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toAccount(data as ProfileRow) : null;
  }

  async deleteUser(id: string) {
    // Cascades remove dependent rows (see the migration's ON DELETE CASCADE).
    const { error } = await this.client.from("profiles").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listUsers() {
    const { data, error } = await this.client.from("profiles").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as ProfileRow[]).map(toAccount);
  }

  async saveItem(item: Omit<SavedItem, "id" | "createdAt">) {
    const { data, error } = await this.client
      .from("saved_items")
      .upsert(
        { id: randomUUID(), user_id: item.userId, kind: item.kind, ref_id: item.refId, title: item.title, url: item.url, payload: item.payload },
        { onConflict: "user_id,kind,ref_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    const r = data as { id: string; created_at: string };
    return { ...item, id: r.id, createdAt: r.created_at };
  }

  async listSaved(userId: string) {
    const { data, error } = await this.client.from("saved_items").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Array<{ id: string; user_id: string; kind: string; ref_id: string; title: string; url?: string; payload?: unknown; created_at: string }>).map((r) => ({
      id: r.id,
      userId: r.user_id,
      kind: r.kind,
      refId: r.ref_id,
      title: r.title,
      url: r.url,
      payload: r.payload,
      createdAt: r.created_at,
    }));
  }

  async removeSaved(userId: string, id: string) {
    const { error } = await this.client.from("saved_items").delete().eq("user_id", userId).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async saveExploration(item: Omit<StoredExploration, "createdAt">) {
    const { error } = await this.client.from("explorations").upsert({
      id: item.id,
      user_id: item.userId,
      label: item.label,
      kind: item.kind,
      payload: item.payload,
    });
    if (error) throw new Error(error.message);
    return { ...item, createdAt: new Date().toISOString() };
  }

  async listExplorations(userId: string) {
    const { data, error } = await this.client.from("explorations").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return (data as Array<{ id: string; user_id: string; label: string; kind: string; payload: unknown; created_at: string }>).map((r) => ({
      id: r.id,
      userId: r.user_id,
      label: r.label,
      kind: r.kind,
      payload: r.payload,
      createdAt: r.created_at,
    }));
  }

  async recordUsage(record: UsageRecord) {
    const { error } = await this.client.from("usage_logs").insert({
      user_id: record.userId,
      feature: record.feature,
      ai_calls: record.aiCalls,
      search_calls: record.searchCalls,
      embedding_calls: record.embeddingCalls,
      input_tokens: record.inputTokens,
      output_tokens: record.outputTokens,
      estimated_cost: record.estimatedCost,
      processing_time_ms: record.processingTimeMs,
      cache_hit: record.cacheHit,
    });
    if (error) throw new Error(error.message);
  }

  async usageSummary(userId: string) {
    const { data, error } = await this.client.from("usage_logs").select("feature, ai_calls, search_calls, estimated_cost").eq("user_id", userId);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ feature: string; ai_calls: number; search_calls: number; estimated_cost: number }>;
    return {
      aiCalls: rows.reduce((a, r) => a + (r.ai_calls ?? 0), 0),
      searchCalls: rows.reduce((a, r) => a + (r.search_calls ?? 0), 0),
      explorations: rows.filter((r) => r.feature === "explore").length,
      estimatedCost: rows.reduce((a, r) => a + Number(r.estimated_cost ?? 0), 0),
    };
  }

  async createPrivacyRequest(input: Omit<PrivacyRequest, "id" | "createdAt" | "updatedAt" | "status">) {
    const { data, error } = await this.client
      .from("privacy_requests")
      .insert({ user_id: input.userId, email: input.email, type: input.type, message: input.message, status: "REQUESTED" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const r = data as { id: string; created_at: string; updated_at: string };
    return { ...input, id: r.id, status: "REQUESTED" as const, createdAt: r.created_at, updatedAt: r.updated_at };
  }

  async listPrivacyRequests() {
    const { data, error } = await this.client.from("privacy_requests").select("*").order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as Array<{ id: string; user_id: string; email: string; type: PrivacyRequest["type"]; message?: string; status: PrivacyRequest["status"]; created_at: string; updated_at: string }>).map((r) => ({
      id: r.id,
      userId: r.user_id,
      email: r.email,
      type: r.type,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  async updatePrivacyRequestStatus(id: string, status: PrivacyRequest["status"]) {
    const { error } = await this.client.from("privacy_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
  }
}
