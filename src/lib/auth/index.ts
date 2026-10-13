/**
 * Authentication facade.
 *
 * Two backends behind one API:
 *   - Supabase Auth (when configured): managed credentials, server-side
 *     sessions via httpOnly cookies. Recommended for production.
 *   - Built-in fallback: scrypt password hashing + HMAC-signed httpOnly
 *     session cookie. Works at $0 for self-hosting; clearly labelled in the UI
 *     as a non-production option.
 *
 * Nothing here ever returns or logs a password or a raw token to the client.
 */

import { cookies } from "next/headers";
import { config } from "../config";
import { getStore } from "../store";
import type { UserAccount } from "../types";
import { createSessionToken, hashPassword, verifyPassword, verifySession } from "./password";

export const SESSION_COOKIE = "lattice_session";
export const TERMS_VERSION = "1.0";
export const PRIVACY_VERSION = "1.0";

export type AuthBackend = "supabase" | "builtin";

export function authBackend(): AuthBackend {
  return config.supabase.configured ? "supabase" : "builtin";
}

// ── Supabase path ────────────────────────────────────────────────────────────

async function supabaseServerClient() {
  const { createServerClient } = await import("@supabase/ssr");
  const cookieStore = await cookies();
  return createServerClient(config.supabase.url, config.supabase.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list: Array<{ name: string; value: string; options?: Record<string, unknown> }>) => {
        for (const { name, value, options } of list) {
          try {
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]);
          } catch {
            // Called from a Server Component render — safe to ignore; the
            // middleware refreshes the session instead.
          }
        }
      },
    },
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<UserAccount | null> {
  if (authBackend() === "supabase") {
    try {
      const supabase = await supabaseServerClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user?.email) return null;
      return getStore().findUserByEmail(data.user.email);
    } catch {
      return null;
    }
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = verifySession(token);
  if (!payload) return null;
  const user = await getStore().findUserById(payload.sub);
  if (!user || user.status !== "active") return null;
  return user;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: UserAccount;
}

export async function signUp(input: {
  email: string;
  password: string;
  marketingOptIn: boolean;
  acceptTerms: boolean;
}): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!input.acceptTerms) return { ok: false, error: "You must accept the Terms of Service and Privacy Policy to create an account." };
  if (input.password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  const store = getStore();
  const existing = await store.findUserByEmail(email);
  if (existing) return { ok: false, error: "An account with this email already exists." };

  if (authBackend() === "supabase") {
    try {
      const supabase = await supabaseServerClient();
      const { error } = await supabase.auth.signUp({ email, password: input.password });
      if (error) return { ok: false, error: error.message };
      const user = await store.createUser({
        email,
        passwordHash: null,
        marketingOptIn: input.marketingOptIn,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
      });
      return { ok: true, user };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  const passwordHash = await hashPassword(input.password);
  const user = await store.createUser({
    email,
    passwordHash,
    marketingOptIn: input.marketingOptIn,
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
  });
  await setSessionCookie(user);
  return { ok: true, user };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const normalized = email.trim().toLowerCase();

  if (authBackend() === "supabase") {
    try {
      const supabase = await supabaseServerClient();
      const { error } = await supabase.auth.signInWithPassword({ email: normalized, password });
      if (error) return { ok: false, error: "Incorrect email or password." };
      const user = await getStore().findUserByEmail(normalized);
      return user ? { ok: true, user } : { ok: false, error: "Your account profile could not be loaded." };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  const store = getStore();
  const found = await store.findUserByEmail(normalized);
  // Constant-ish behaviour: always run a verification to avoid user enumeration.
  const ok = found ? await verifyPassword(password, found.passwordHash) : await verifyPassword(password, null);
  if (!found || !ok) return { ok: false, error: "Incorrect email or password." };
  if (found.status !== "active") return { ok: false, error: "This account is not active." };

  const { passwordHash: _pw, ...user } = found;
  void _pw;
  await setSessionCookie(user);
  return { ok: true, user };
}

export async function signOut(): Promise<void> {
  if (authBackend() === "supabase") {
    try {
      const supabase = await supabaseServerClient();
      await supabase.auth.signOut();
    } catch {
      /* fall through to clearing the built-in cookie */
    }
  }
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

async function setSessionCookie(user: UserAccount): Promise<void> {
  const token = createSessionToken(user.id, user.email);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
}

export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await getStore().deleteUser(user.id);
  await signOut();
  return { ok: true };
}

export function isAdmin(user: UserAccount | null): boolean {
  return !!user && config.auth.adminEmails.includes(user.email.toLowerCase());
}
