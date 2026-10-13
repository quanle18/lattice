"use client";

import { useRouter } from "next/navigation";
import { KnowledgeMapView } from "./knowledge-map";
import type { KnowledgeMap } from "@/lib/types";

/** Client wrapper so a map node click can navigate to a new exploration. */
export function LibraryMap({ map }: { map: KnowledgeMap }) {
  const router = useRouter();
  return <KnowledgeMapView map={map} onExplore={(c) => router.push(`/explore?q=${encodeURIComponent(c)}`)} />;
}
