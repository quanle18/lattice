/**
 * Central runtime configuration.
 *
 * Every external dependency is OPTIONAL. `mode` is derived from what is
 * actually configured, and the UI surfaces it honestly — we never claim a
 * capability the deployment does not have.
 */

function env(key: string, fallback = ""): string {
  const v = process.env[key];
  return v === undefined || v === null ? fallback : String(v).trim();
}

function flag(key: string, fallback: boolean): boolean {
  const v = env(key).toLowerCase();
  if (v === "") return fallback;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function num(key: string, fallback: number): number {
  const v = Number(env(key));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export const supabaseConfigured =
  env("NEXT_PUBLIC_SUPABASE_URL") !== "" &&
  env("NEXT_PUBLIC_SUPABASE_ANON_KEY") !== "";

export const aiEnabled = flag("AI_ENABLED", false) && env("AI_API_KEY") !== "";

export const config = {
  siteUrl: env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"),

  supabase: {
    url: env("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),
    configured: supabaseConfigured,
  },

  auth: {
    adminEmails: env("ADMIN_EMAILS")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  },

  /**
   * Free, keyless providers. These are the backbone of LIVE MODE at $0.
   */
  providers: {
    openalex: flag("LATTICE_ENABLE_OPENALEX", true),
    crossref: flag("LATTICE_ENABLE_CROSSREF", true),
    arxiv: flag("LATTICE_ENABLE_ARXIV", true),
    wikipedia: flag("LATTICE_ENABLE_WIKIPEDIA", true),
    worldbank: flag("LATTICE_ENABLE_WORLDBANK", true),
    gdelt: flag("LATTICE_ENABLE_GDELT", true),
    guardianKey: env("GUARDIAN_API_KEY"),
  },

  ai: {
    enabled: aiEnabled,
    provider: env("AI_PROVIDER"),
    apiKey: env("AI_API_KEY"),
    model: env("AI_MODEL"),
    baseUrl: env("AI_BASE_URL"),
  },

  limits: {
    maxUploadMb: num("LATTICE_MAX_UPLOAD_MB", 25),
    rateLimitPerMin: num("LATTICE_RATE_LIMIT_PER_MIN", 60),
    freeAiQuota: num("LATTICE_FREE_AI_QUOTA", 5),
  },
} as const;

export type RuntimeMode = "demo" | "live";

/**
 * Demo mode = deterministic, local-only, zero network. Live mode = at least
 * one external provider is reachable. Persistence is independent of this.
 */
export function runtimeMode(): RuntimeMode {
  const p = config.providers;
  const anyProvider =
    p.openalex || p.crossref || p.arxiv || p.wikipedia || p.worldbank || p.gdelt || p.guardianKey !== "";
  return anyProvider ? "live" : "demo";
}

export function persistenceMode(): "supabase" | "local-json" {
  return config.supabase.configured ? "supabase" : "local-json";
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return config.auth.adminEmails.includes(email.toLowerCase());
}
