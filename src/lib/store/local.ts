/**
 * Local JSON account store — zero external dependencies.
 *
 * Intended for development and single-instance self-hosting. It is NOT safe
 * for multi-instance/serverless deployments (each instance has its own disk),
 * which is exactly why Supabase is offered as the production path.
 *
 * Writes are atomic per file (write to a temp name, then rename) and the
 * process keeps an in-memory copy so reads are cheap.
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { UsageRecord, UserAccount } from "../types";
import type { AccountStore, PrivacyRequest, SavedItem, StoredExploration } from "./types";

const DATA_DIR = process.env.LATTICE_DATA_DIR ?? path.join(process.cwd(), ".lattice-data");

interface Db {
  users: Array<UserAccount & { passwordHash: string | null }>;
  saved: SavedItem[];
  explorations: StoredExploration[];
  usage: UsageRecord[];
  privacy: PrivacyRequest[];
}

let cache: Db | null = null;

async function load(): Promise<Db> {
  if (cache) return cache;
  await mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, "accounts.json");
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as Partial<Db>;
    cache = {
      users: parsed.users ?? [],
      saved: parsed.saved ?? [],
      explorations: parsed.explorations ?? [],
      usage: parsed.usage ?? [],
      privacy: parsed.privacy ?? [],
    };
  } catch {
    cache = { users: [], saved: [], explorations: [], usage: [], privacy: [] };
  }
  return cache;
}

async function persist(db: Db): Promise<void> {
  const file = path.join(DATA_DIR, "accounts.json");
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await rename(tmp, file);
}

export class LocalJsonAccountStore implements AccountStore {
  readonly kind = "local-json" as const;

  async createUser(input: { email: string; passwordHash: string | null; marketingOptIn: boolean; termsVersion: string; privacyVersion: string }): Promise<UserAccount> {
    const db = await load();
    const now = new Date().toISOString();
    const user: UserAccount & { passwordHash: string | null } = {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      createdAt: now,
      plan: "free",
      status: "active",
      consentStatus: "accepted",
      marketingOptIn: input.marketingOptIn,
      termsVersion: input.termsVersion,
      privacyVersion: input.privacyVersion,
      passwordHash: input.passwordHash,
    };
    db.users.push(user);
    await persist(db);
    return strip(user);
  }

  async findUserByEmail(email: string) {
    const db = await load();
    return db.users.find((u) => u.email === email.toLowerCase()) ?? null;
  }

  async findUserById(id: string) {
    const db = await load();
    const u = db.users.find((x) => x.id === id);
    return u ? strip(u) : null;
  }

  async updateUser(id: string, patch: Partial<UserAccount>) {
    const db = await load();
    const u = db.users.find((x) => x.id === id);
    if (!u) return null;
    Object.assign(u, patch);
    await persist(db);
    return strip(u);
  }

  async deleteUser(id: string) {
    const db = await load();
    db.users = db.users.filter((u) => u.id !== id);
    db.saved = db.saved.filter((s) => s.userId !== id);
    db.explorations = db.explorations.filter((e) => e.userId !== id);
    db.usage = db.usage.filter((u) => u.userId !== id);
    await persist(db);
  }

  async listUsers() {
    const db = await load();
    return db.users.map(strip);
  }

  async saveItem(item: Omit<SavedItem, "id" | "createdAt">) {
    const db = await load();
    const record: SavedItem = { ...item, id: randomUUID(), createdAt: new Date().toISOString() };
    // De-duplicate on (user, kind, refId).
    db.saved = db.saved.filter((s) => !(s.userId === item.userId && s.kind === item.kind && s.refId === item.refId));
    db.saved.push(record);
    await persist(db);
    return record;
  }

  async listSaved(userId: string) {
    const db = await load();
    return db.saved.filter((s) => s.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async removeSaved(userId: string, id: string) {
    const db = await load();
    db.saved = db.saved.filter((s) => !(s.userId === userId && s.id === id));
    await persist(db);
  }

  async saveExploration(item: Omit<StoredExploration, "createdAt">) {
    const db = await load();
    const record: StoredExploration = { ...item, createdAt: new Date().toISOString() };
    db.explorations = db.explorations.filter((e) => e.id !== item.id);
    db.explorations.push(record);
    await persist(db);
    return record;
  }

  async listExplorations(userId: string) {
    const db = await load();
    return db.explorations.filter((e) => e.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async recordUsage(record: UsageRecord) {
    const db = await load();
    db.usage.push(record);
    // Bound growth in the local store.
    if (db.usage.length > 5000) db.usage = db.usage.slice(-5000);
    await persist(db);
  }

  async usageSummary(userId: string) {
    const db = await load();
    const rows = db.usage.filter((u) => u.userId === userId);
    return {
      aiCalls: rows.reduce((a, r) => a + (r.aiCalls ?? 0), 0),
      searchCalls: rows.reduce((a, r) => a + (r.searchCalls ?? 0), 0),
      explorations: rows.filter((r) => r.feature === "explore").length,
      estimatedCost: rows.reduce((a, r) => a + (r.estimatedCost ?? 0), 0),
    };
  }

  async createPrivacyRequest(input: Omit<PrivacyRequest, "id" | "createdAt" | "updatedAt" | "status">) {
    const db = await load();
    const now = new Date().toISOString();
    const req: PrivacyRequest = { ...input, id: randomUUID(), status: "REQUESTED", createdAt: now, updatedAt: now };
    db.privacy.push(req);
    await persist(db);
    return req;
  }

  async listPrivacyRequests() {
    const db = await load();
    return db.privacy.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updatePrivacyRequestStatus(id: string, status: PrivacyRequest["status"]) {
    const db = await load();
    const r = db.privacy.find((x) => x.id === id);
    if (!r) return;
    r.status = status;
    r.updatedAt = new Date().toISOString();
    await persist(db);
  }
}

function strip(u: UserAccount & { passwordHash: string | null }): UserAccount {
  const { passwordHash: _pw, ...rest } = u;
  void _pw;
  return rest;
}
