import type { Metadata } from "next";
import { ExploreClient } from "@/components/explore/explore-client";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Explore",
  description: "Upload material, paste text, enter a URL or start with a topic.",
};

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser().catch(() => null);
  const startTab = params.tab === "upload" || params.tab === "text" || params.tab === "url" ? params.tab : undefined;

  return (
    <div className="min-h-[70vh]">
      <div className="border-b border-white/[0.06] bg-ink-950/40">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <h1 className="text-2xl font-semibold text-parchment-100">Exploration workspace</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-parchment-400">
            Bring any material — a document, a passage, a URL, or just a question. Lattice extracts the
            concepts locally, then finds what is worth exploring next.
          </p>
        </div>
      </div>
      <ExploreClient initialQuery={params.q} signedIn={!!user} startTab={startTab} />
    </div>
  );
}
