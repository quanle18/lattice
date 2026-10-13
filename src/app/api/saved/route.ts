import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";

/** GET /api/saved — the signed-in user's saved items. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const [items, explorations] = await Promise.all([
    getStore().listSaved(user.id),
    getStore().listExplorations(user.id),
  ]);
  return NextResponse.json({ items, explorations });
}

/** POST /api/saved — save a case, idea, source or exploration. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const body = (await req.json()) as {
      kind?: string;
      refId?: string;
      title?: string;
      url?: string;
      payload?: unknown;
    };
    if (!body.kind || !body.refId || !body.title) {
      return NextResponse.json({ error: "kind, refId and title are required." }, { status: 400 });
    }
    const item = await getStore().saveItem({
      userId: user.id,
      kind: body.kind.slice(0, 32),
      refId: body.refId.slice(0, 128),
      title: body.title.slice(0, 300),
      url: body.url,
      payload: body.payload,
    });
    return NextResponse.json({ item });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/** DELETE /api/saved?id=... — remove a saved item. */
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "An id is required." }, { status: 400 });
  await getStore().removeSaved(user.id, id);
  return NextResponse.json({ ok: true });
}
