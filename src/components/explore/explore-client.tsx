"use client";

import { Explorer } from "./explorer";

/** Client wrapper for the workspace route. */
export function ExploreClient({
  initialQuery,
  signedIn,
  startTab,
}: {
  initialQuery?: string;
  signedIn: boolean;
  startTab?: "upload" | "topic" | "text" | "url";
}) {
  return <Explorer signedIn={signedIn} autoQuery={initialQuery} startTab={startTab} />;
}
