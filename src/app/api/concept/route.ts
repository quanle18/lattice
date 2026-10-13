import { NextResponse } from "next/server";
import { exploreConcept } from "@/lib/explore/engine";
import { checkRateLimit, clientKey } from "@/lib/limits";

export const runtime = "nodejs";

/**
 * POST /api/concept  { concept: string }
 * Re-queries the database + providers for a single concept. This is what the
 * knowledge map and "next step" buttons call — never an LLM.
 */
export async function POST(req: Request) {
  const limit = checkRateLimit(`concept:${clientKey(req)}`);
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests." }, { status: 429 });

  try {
    const { concept, offline } = (await req.json()) as { concept?: string; offline?: boolean };
    if (!concept || concept.trim().length < 2) {
      return NextResponse.json({ error: "A concept is required." }, { status: 400 });
    }
    const result = await exploreConcept(concept.trim().slice(0, 200), offline === true);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
