import { NextResponse } from "next/server";
import { runtimeMode, persistenceMode, config } from "@/lib/config";
import { libraryStats } from "@/lib/kb/repository";
import { providerSummary } from "@/lib/providers/registry";
import { aiStatus } from "@/lib/providers/ai";
import { formatCapabilities } from "@/lib/parsers";
import { internalMetrics } from "@/lib/limits";

export const runtime = "nodejs";

/** GET /api/health — an honest capability report for this deployment. */
export async function GET() {
  const formats = await formatCapabilities();
  return NextResponse.json({
    ok: true,
    mode: runtimeMode(),
    persistence: persistenceMode(),
    auth: config.supabase.configured ? "supabase" : "builtin",
    ai: aiStatus(),
    library: libraryStats(),
    providers: providerSummary(),
    formats: formats.map((f) => ({ ext: f.ext, enabled: f.enabled, note: f.note })),
    metrics: internalMetrics(),
    limits: config.limits,
    timestamp: new Date().toISOString(),
  });
}
