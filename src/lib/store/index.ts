/**
 * Store selection. Supabase when configured, otherwise the local JSON store.
 * The choice is surfaced in the UI so nothing is implicit.
 */

import { config } from "../config";
import type { AccountStore } from "./types";
import { LocalJsonAccountStore } from "./local";
import { SupabaseAccountStore } from "./supabase";

let store: AccountStore | null = null;

export function getStore(): AccountStore {
  if (store) return store;
  store = config.supabase.configured && config.supabase.serviceRoleKey
    ? new SupabaseAccountStore()
    : new LocalJsonAccountStore();
  return store;
}

export function storeKind(): AccountStore["kind"] {
  return getStore().kind;
}

export type { AccountStore, PrivacyRequest, SavedItem, StoredExploration } from "./types";
