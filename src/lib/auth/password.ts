/**
 * Password hashing (scrypt) and signed session tokens.
 *
 * These are used ONLY by the built-in fallback auth. When Supabase Auth is
 * configured, Supabase owns credentials and this module is not involved.
 *
 * scrypt with a per-user random salt is a deliberately slow, memory-hard KDF
 * and is appropriate for password storage. Passwords are never logged, never
 * returned, and never stored in plaintext.
 */

import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEYLEN);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hex] = parts;
  const derived = await scrypt(password, salt, KEYLEN);
  const expected = Buffer.from(hex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

// ── Session tokens ───────────────────────────────────────────────────────────

export interface SessionPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

function sessionSecret(): string {
  const s = process.env.LATTICE_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  // Development fallback. In production a real secret MUST be provided;
  // the UI warns when this path is taken.
  return "lattice-development-session-secret-do-not-use-in-production";
}

export function usingDevSecret(): boolean {
  const s = process.env.LATTICE_SESSION_SECRET;
  return !s || s.length < 32;
}

export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionToken(userId: string, email: string, ttlMs = 1000 * 60 * 60 * 24 * 14): string {
  const now = Date.now();
  return signSession({ sub: userId, email, iat: now, exp: now + ttlMs });
}
