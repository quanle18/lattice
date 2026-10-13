"use client";

import { useState } from "react";
import { Badge, Icon, cn } from "@/components/ui";
import type { IconName } from "@/components/ui";
import type { Recommendation, SourceRecord } from "@/lib/types";

const QUALITY_TONE: Record<string, "aurora" | "signal" | "amber" | "neutral" | "outline"> = {
  PRIMARY: "aurora",
  ACADEMIC: "signal",
  "HIGH-QUALITY JOURNALISM": "neutral",
  SECONDARY: "neutral",
  "GENERAL REFERENCE": "outline",
  "DEBATE / PERSPECTIVE": "amber",
};

const KIND_ICON: Record<string, IconName> = {
  academic: "book",
  news: "globe",
  government: "shield",
  data: "database",
  reference: "layers",
  perspective: "scale",
  book: "book",
  company: "file",
  primary: "database",
  educational: "layers",
};

export function SourceCard({
  rec,
  onSave,
  saved,
}: {
  rec: Recommendation<SourceRecord>;
  onSave?: (rec: Recommendation<SourceRecord>) => void;
  saved?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = rec.item;
  const tone = QUALITY_TONE[s.quality] ?? "neutral";

  return (
    <article className="group surface flex flex-col p-4 transition-all duration-200 hover:border-white/15 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white/[0.05] text-parchment-400">
            <Icon name={KIND_ICON[s.kind] ?? "file"} className="h-3.5 w-3.5" />
          </span>
          <Badge tone={tone} title={`Source quality: ${s.quality}`}>
            {s.quality.replace("HIGH-QUALITY ", "")}
          </Badge>
          {s.origin === "provider" ? (
            <span className="text-[0.68rem] uppercase tracking-wide text-parchment-600">{s.provider}</span>
          ) : null}
          {s.synthetic ? (
            <Badge tone="rose" title="Demonstration record — not a real source">
              Demo record
            </Badge>
          ) : null}
        </div>
        {onSave ? (
          <button
            type="button"
            onClick={() => onSave(rec)}
            aria-label={saved ? "Saved" : "Save source"}
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors",
              saved ? "bg-aurora-500/20 text-aurora-400" : "text-parchment-600 hover:bg-white/5 hover:text-parchment-300",
            )}
          >
            <Icon name={saved ? "check" : "bookmark"} className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <h4 className="mt-3 text-sm font-medium leading-snug text-parchment-100">
        {s.url ? (
          <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-signal-300">
            {s.title}
          </a>
        ) : (
          s.title
        )}
      </h4>

      <p className="mt-1.5 text-xs text-parchment-500">
        {[s.publisher, s.author, s.date].filter(Boolean).join(" · ")}
      </p>

      {s.description ? (
        <p className={cn("mt-2.5 text-xs leading-relaxed text-parchment-400", !expanded && "line-clamp-3")}>
          {s.description}
        </p>
      ) : null}

      {s.description && s.description.length > 180 ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 self-start text-[0.7rem] text-signal-300 hover:text-signal-200"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}

      {rec.reasons.length > 0 ? (
        <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
          <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-parchment-500">
            Why this is relevant
          </p>
          <ul className="mt-1 space-y-0.5">
            {rec.reasons.slice(0, 2).map((r, i) => (
              <li key={i} className="text-[0.72rem] leading-relaxed text-parchment-400">
                {r}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span className="text-[0.68rem] text-parchment-600">
          Score {rec.score.toFixed(1)}
          {s.verification === "metadata-only" ? " · metadata only" : ""}
        </span>
        {s.url ? (
          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-[0.72rem] text-signal-300 hover:text-signal-200"
          >
            Read original <Icon name="external" className="h-3 w-3" />
          </a>
        ) : (
          <span className="text-[0.68rem] text-parchment-600">No link available</span>
        )}
      </div>
    </article>
  );
}
