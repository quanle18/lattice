"use client";

import { useCallback, useRef, useState } from "react";
import { Button, Icon, cn } from "@/components/ui";

export type InputPayload =
  | { kind: "topic" | "text" | "url"; value: string }
  | { kind: "file"; file: File };

export const ACCEPTED =
  ".pdf,.docx,.pptx,.txt,.md,.markdown,.csv,.html,.htm,.json,.xml,.rtf,.png,.jpg,.jpeg,.webp";

const FORMAT_LABELS = "PDF, Word, PowerPoint, TXT, Markdown, CSV, HTML, JSON, XML, RTF";

const EXAMPLES = [
  "Multipolarity and the balance of power",
  "How does automation affect wages?",
  "Philosophy of consciousness",
  "Climate tipping points",
  "Comparative advantage under fragmentation",
  "Antimicrobial resistance governance",
];

type Tab = "topic" | "text" | "upload" | "url";

const TABS: Array<{ id: Tab; label: string; icon: "search" | "file" | "upload" | "link" }> = [
  { id: "topic", label: "Topic", icon: "search" },
  { id: "text", label: "Paste text", icon: "file" },
  { id: "upload", label: "Upload", icon: "upload" },
  { id: "url", label: "URL", icon: "link" },
];

export function InputPanel({
  onSubmit,
  busy,
  maxUploadMb = 25,
  compact = false,
  initialTab,
}: {
  onSubmit: (payload: InputPayload) => void;
  busy: boolean;
  maxUploadMb?: number;
  compact?: boolean;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "topic");
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptFile = useCallback(
    (f: File | undefined) => {
      setFileError(null);
      if (!f) return;
      const ext = (f.name.split(".").pop() ?? "").toLowerCase();
      const allowed = ACCEPTED.split(",").map((x) => x.replace(".", ""));
      if (!allowed.includes(ext)) {
        setFileError(`“.${ext}” is not supported. Accepted: ${FORMAT_LABELS}.`);
        return;
      }
      if (f.size > maxUploadMb * 1024 * 1024) {
        setFileError(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB; the limit is ${maxUploadMb} MB.`);
        return;
      }
      if (f.size === 0) {
        setFileError("That file is empty.");
        return;
      }
      setFile(f);
    },
    [maxUploadMb],
  );

  const canSubmit =
    !busy &&
    ((tab === "topic" && topic.trim().length > 2) ||
      (tab === "text" && text.trim().length > 20) ||
      (tab === "url" && url.trim().length > 6) ||
      (tab === "upload" && !!file));

  const submit = () => {
    if (!canSubmit) return;
    if (tab === "topic") onSubmit({ kind: "topic", value: topic.trim() });
    else if (tab === "text") onSubmit({ kind: "text", value: text.trim() });
    else if (tab === "url") onSubmit({ kind: "url", value: url.trim() });
    else if (file) onSubmit({ kind: "file", file });
  };

  return (
    <div className={cn("surface overflow-hidden", compact ? "p-4" : "p-5")}>
      <div role="tablist" aria-label="Input method" className="flex gap-1 rounded-xl bg-white/[0.03] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm",
              tab === t.id ? "bg-ink-700 text-parchment-100 shadow-sm" : "text-parchment-400 hover:text-parchment-200",
            )}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5" />
            <span className={compact ? "sr-only sm:not-sr-only" : ""}>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "topic" ? (
          <div>
            <label htmlFor="topic-input" className="sr-only">
              Topic or research question
            </label>
            <input
              id="topic-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Ask a question or enter any topic…"
              className="h-12 w-full rounded-xl border border-white/10 bg-ink-900 px-4 text-sm text-parchment-100 placeholder:text-parchment-600 focus:border-signal-500/50 focus:outline-none focus:ring-2 focus:ring-signal-500/20"
            />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setTopic(ex)}
                  className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-[0.72rem] text-parchment-400 transition-colors hover:border-white/20 hover:text-parchment-200"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "text" ? (
          <div>
            <label htmlFor="text-input" className="sr-only">
              Paste your text
            </label>
            <textarea
              id="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={compact ? 5 : 8}
              placeholder="Paste an abstract, article excerpt, essay, or any passage you want to explore…"
              className="w-full resize-y rounded-xl border border-white/10 bg-ink-900 p-4 text-sm leading-relaxed text-parchment-100 placeholder:text-parchment-600 focus:border-signal-500/50 focus:outline-none focus:ring-2 focus:ring-signal-500/20"
            />
            <p className="mt-2 text-right text-[0.7rem] text-parchment-600">
              {text.trim() ? `${text.trim().split(/\s+/).length} words` : "Analysis is local and free"}
            </p>
          </div>
        ) : null}

        {tab === "url" ? (
          <div>
            <label htmlFor="url-input" className="sr-only">
              Page URL
            </label>
            <input
              id="url-input"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="https://example.org/article"
              className="h-12 w-full rounded-xl border border-white/10 bg-ink-900 px-4 text-sm text-parchment-100 placeholder:text-parchment-600 focus:border-signal-500/50 focus:outline-none focus:ring-2 focus:ring-signal-500/20"
            />
            <p className="mt-2 text-[0.7rem] leading-relaxed text-parchment-600">
              Lattice retrieves public pages only. Login-protected or JavaScript-heavy pages may return
              little text — paste the content instead.
            </p>
          </div>
        ) : null}

        {tab === "upload" ? (
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                acceptFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-signal-400/60 bg-signal-500/[0.07]" : "border-white/12 bg-white/[0.015]",
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                className="sr-only"
                onChange={(e) => acceptFile(e.target.files?.[0])}
              />
              <Icon name="upload" className="h-7 w-7 text-parchment-500" />
              <p className="mt-3 text-sm font-medium text-parchment-200">Drop your research material here</p>
              <p className="mt-1 text-xs text-parchment-500">{FORMAT_LABELS}</p>
              <p className="mt-0.5 text-xs text-parchment-600">Up to {maxUploadMb} MB per file</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => inputRef.current?.click()}
              >
                Browse files
              </Button>
            </div>

            {file ? (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5">
                <Icon name="file" className="h-4 w-4 shrink-0 text-signal-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-parchment-200">{file.name}</p>
                  <p className="text-[0.7rem] text-parchment-500">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  aria-label="Remove file"
                  className="grid h-7 w-7 place-items-center rounded-md text-parchment-500 hover:bg-white/5 hover:text-parchment-200"
                >
                  <Icon name="close" className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            {fileError ? (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2 text-xs text-rose-400">
                <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {fileError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="hidden text-[0.7rem] text-parchment-600 sm:block">
          Deterministic analysis · no AI required · results cached
        </p>
        <Button type="button" onClick={submit} disabled={!canSubmit} size="md" className="w-full sm:w-auto">
          {busy ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Analysing…
            </>
          ) : (
            <>
              <Icon name="sparkle" className="h-4 w-4" />
              Start exploring
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
