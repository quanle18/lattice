import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/**
 * POST /api/privacy-request
 * Public endpoint: anyone can file an access/correction/deletion/closure
 * request, signed in or not. Status starts at REQUESTED.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { email?: string; type?: string; message?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }
    const allowed = ["access", "correction", "deletion", "closure", "question"] as const;
    const type = (allowed as readonly string[]).includes(body.type ?? "") ? (body.type as (typeof allowed)[number]) : "question";

    const user = await getCurrentUser().catch(() => null);
    const request = await getStore().createPrivacyRequest({
      userId: user?.id ?? "anonymous",
      email,
      type,
      message: (body.message ?? "").slice(0, 4000),
    });
    return NextResponse.json({ request: { id: request.id, status: request.status, createdAt: request.createdAt } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
