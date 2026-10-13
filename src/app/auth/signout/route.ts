import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export const runtime = "nodejs";

/** POST /auth/signout — used by the nav form. */
export async function POST(req: Request) {
  await signOut();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
