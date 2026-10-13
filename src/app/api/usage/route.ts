import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { config } from "@/lib/config";

export const runtime = "nodejs";

/** GET /api/usage — the signed-in user's usage and remaining quota. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const summary = await getStore().usageSummary(user.id);
  const quota = config.limits.freeAiQuota;
  return NextResponse.json({
    summary,
    quota: {
      deepAiOperations: quota,
      used: summary.aiCalls,
      remaining: Math.max(0, quota - summary.aiCalls),
    },
    aiEnabled: config.ai.enabled,
  });
}
