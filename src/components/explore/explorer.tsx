"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, Icon, Skeleton, cn } from "@/components/ui";
import { InputPanel, type InputPayload } from "./input-panel";
import { SourceCard } from "./source-card";
import { KnowledgeMapView } from "./knowledge-map";
import type {
  CaseRecord,
  ExplorationResult,
  IdeaRecord,
  Recommendation,
  SourceRecord,
} from "@/lib/types";

type TabId =
  | "overview" | "concepts" | "research" | "cases" | "news"
  | "data" | "perspectives" | "sources" | "map" | "next";

const QUALITY_ORDER = ["PRIMARY", "ACADEMIC", "HIGH-QUALITY JOURNALISM", "SECONDARY", "GENERAL REFERENCE", "DEBATE / PERSPECTIVE"];

export function Explorer({
  initial,
  signedIn,
  autoQuery,
  startTab,
}: {
  initial?: ExplorationResult | null;
  signedIn: boolean;
  autoQuery?: string;
  startTab?: "upload" | "topic" | "text" | "url";
}) {
  const [result, setResult] = useState<ExplorationResult | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("overview");
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const lastPayload = useRef<InputPayload | null>(null);

  const run = useCallback(
    async (payload: InputPayload, refresh = false) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      lastPayload.current = payload;
      try {
        let res: Response;
        if (payload.kind === "file") {
          const form = new FormData();
          form.append("file", payload.file);
          if (refresh) form.append("refresh", "1");
          res = await fetch("/api/analyze", { method: "POST", body: form });
        } else {
          res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              [payload.kind === "topic" ? "query" : payload.kind]: payload.value,
              kind: payload.kind,
              refresh,
            }),
          });
        }

        const data = (await res.json()) as { result?: ExplorationResult; error?: string; cached?: boolean };
        if (!res.ok || !data.result) {
          setError(data.error ?? `Request failed (${res.status}).`);
          return;
        }
        setResult(data.result);
        setTab("overview");
        if (data.cached && !refresh) setNotice("Served from cache — identical material was analysed before.");
        if (refresh) setNotice("Research refreshed: cache bypassed for this run.");
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const save = useCallback(
    async (kind: string, refId: string, title: string, url?: string, payload?: unknown) => {
      const key = `${kind}:${refId}`;
      if (!signedIn) {
        setNotice("Sign in to save items to your research library.");
        return;
      }
      try {
        const res = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, refId, title, url, payload }),
        });
        if (!res.ok) {
          const d = (await res.json()) as { error?: string };
          setNotice(d.error ?? "Could not save that item.");
          return;
        }
        setSavedKeys((prev) => new Set(prev).add(key));
        setNotice(`Saved “${title.slice(0, 60)}”.`);
      } catch {
        setNotice("Could not reach the server to save that item.");
      }
    },
    [signedIn],
  );

  const exploreConcept = useCallback(
    async (concept: string) => {
      await run({ kind: "topic", value: concept });
    },
    [run],
  );

  const grouped = useMemo(() => {
    if (!result) return null;
    const sources = result.sources;
    const byKind = (kinds: SourceRecord["kind"][]) => sources.filter((s) => kinds.includes(s.item.kind));
    return {
      academic: byKind(["academic"]),
      news: byKind(["news"]),
      data: byKind(["data"]),
      reference: byKind(["reference", "perspective", "book", "company", "primary", "educational", "government"]),
    };
  }, [result]);

  const tabs = useMemo(() => {
    if (!result) return [] as Array<{ id: TabId; label: string; count?: number }>;
    const list: Array<{ id: TabId; label: string; count?: number }> = [
      { id: "overview", label: "Overview" },
      { id: "concepts", label: "Concepts", count: result.analysis.concepts.length },
    ];
    if (result.ideas.length || grouped?.academic.length) list.push({ id: "research", label: "Research", count: result.ideas.length + (grouped?.academic.length ?? 0) });
    if (result.cases.length) list.push({ id: "cases", label: "Cases", count: result.cases.length });
    if (grouped?.news.length) list.push({ id: "news", label: "News", count: grouped.news.length });
    if (grouped?.data.length) list.push({ id: "data", label: "Data", count: grouped.data.length });
    if (result.perspectives.length) list.push({ id: "perspectives", label: "Perspectives", count: result.perspectives.length });
    if (grouped?.reference.length) list.push({ id: "sources", label: "Sources", count: grouped.reference.length });
    list.push({ id: "map", label: "Knowledge Map" });
    if (result.next.length) list.push({ id: "next", label: "Next Steps", count: result.next.length });
    return list;
  }, [result, grouped]);

  // Auto-run a query supplied by the landing page or a map link.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !autoQuery || autoQuery.trim().length < 3) return;
    autoRan.current = true;
    void run({ kind: autoQuery.trim().split(/\s+/).length <= 12 ? "topic" : "text", value: autoQuery.trim() });
  }, [autoQuery, run]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <InputPanel onSubmit={(p) => void run(p)} busy={busy} initialTab={startTab} />
      </div>

      {error ? (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-rose-500/25 bg-rose-500/[0.07] p-4">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div>
            <p className="text-sm font-medium text-rose-300">Something went wrong</p>
            <p className="mt-1 text-sm text-rose-400/90">{error}</p>
          </div>
        </div>
      ) : null}

      {notice ? (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-signal-500/20 bg-signal-500/[0.06] p-3.5">
          <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-signal-300" />
          <p className="text-sm text-signal-200">{notice}</p>
        </div>
      ) : null}

      {busy && !result ? <LoadingState /> : null}

      {!busy && !result ? <IntroState /> : null}

      {result ? (
        <div ref={resultsRef} className="animate-fade-up">
          {/* Result header */}
          <div className="surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={result.mode === "live" ? "aurora" : "amber"}>
                    {result.mode === "live" ? "Live sources" : "Demo library"}
                  </Badge>
                  <Badge tone="outline">{result.analysis.documentType}</Badge>
                  <Badge tone="outline">{result.analysis.wordCount.toLocaleString()} words</Badge>
                  <Badge tone="outline">lang: {result.analysis.language}</Badge>
                </div>
                <h1 className="mt-3 text-xl font-semibold text-parchment-100 sm:text-2xl">
                  {result.analysis.mainTopic}
                </h1>
                {result.input.sourceName ? (
                  <p className="mt-1 text-xs text-parchment-500">Source file: {result.input.sourceName}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => lastPayload.current && void run(lastPayload.current, true)}
                  disabled={busy || !lastPayload.current}
                >
                  <Icon name="clock" className="h-3.5 w-3.5" />
                  Refresh research
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(window.location.href);
                    setNotice("Link copied.");
                  }}
                >
                  <Icon name="link" className="h-3.5 w-3.5" />
                  Copy link
                </Button>
              </div>
            </div>

            {result.warnings.length > 0 ? (
              <ul className="mt-4 space-y-1.5">
                {result.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-amber-400/90">
                    <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Tabs */}
          <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto border-b border-white/[0.06] pb-px" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-sm transition-colors",
                  tab === t.id
                    ? "border-b-2 border-signal-400 text-parchment-100"
                    : "border-b-2 border-transparent text-parchment-500 hover:text-parchment-200",
                )}
              >
                {t.label}
                {t.count !== undefined ? (
                  <span className="rounded-full bg-white/[0.07] px-1.5 py-0.5 text-[0.65rem] text-parchment-400">{t.count}</span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {tab === "overview" ? (
              <OverviewTab result={result} onExplore={exploreConcept} onSave={save} savedKeys={savedKeys} />
            ) : null}
            {tab === "concepts" ? <ConceptsTab result={result} onExplore={exploreConcept} /> : null}
            {tab === "research" ? (
              <ResearchTab result={result} grouped={grouped!} onSave={save} savedKeys={savedKeys} onExplore={exploreConcept} />
            ) : null}
            {tab === "cases" ? <CasesTab result={result} onSave={save} savedKeys={savedKeys} /> : null}
            {tab === "news" ? <SourcesGrid recs={grouped!.news} onSave={save} savedKeys={savedKeys} /> : null}
            {tab === "data" ? <DataTab result={result} recs={grouped!.data} onSave={save} savedKeys={savedKeys} /> : null}
            {tab === "perspectives" ? <PerspectivesTab result={result} onExplore={exploreConcept} /> : null}
            {tab === "sources" ? <SourcesGrid recs={grouped!.reference} onSave={save} savedKeys={savedKeys} /> : null}
            {tab === "map" ? <KnowledgeMapView map={result.map} onExplore={exploreConcept} /> : null}
            {tab === "next" ? <NextTab result={result} onExplore={exploreConcept} /> : null}
          </div>

          <ProviderReportPanel result={result} />
        </div>
      ) : null}
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({
  result,
  onExplore,
  onSave,
  savedKeys,
}: {
  result: ExplorationResult;
  onExplore: (c: string) => void;
  onSave: (kind: string, refId: string, title: string, url?: string, payload?: unknown) => void;
  savedKeys: Set<string>;
}) {
  const top = result.sources.slice(0, 3);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        <Card>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
            <Icon name="file" className="h-4 w-4 text-signal-300" /> Extractive summary
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-parchment-300">
            {result.analysis.summary || "No summary could be produced from the extracted text."}
          </p>
          <p className="mt-3 text-[0.7rem] text-parchment-600">
            Generated locally by sentence salience — not by an AI model, and not a substitute for reading
            the source.
          </p>
        </Card>

        {result.analysis.claims.length > 0 ? (
          <Card>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
              <Icon name="target" className="h-4 w-4 text-amber-400" /> Key claims detected
            </h3>
            <ul className="mt-3 space-y-3">
              {result.analysis.claims.slice(0, 5).map((c, i) => (
                <li key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-sm leading-relaxed text-parchment-200">“{c.text}”</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.signals.map((s) => (
                      <Badge key={s} tone="outline">{s}</Badge>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
            <Icon name="lightbulb" className="h-4 w-4 text-aurora-400" /> Main concepts
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.analysis.concepts.slice(0, 18).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onExplore(c.label)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition-colors",
                  c.known
                    ? "border-signal-400/25 bg-signal-500/10 text-signal-200 hover:bg-signal-500/20"
                    : "border-white/12 bg-white/[0.03] text-parchment-300 hover:border-white/25",
                )}
                title={c.known ? "Present in the internal library" : "Not yet in the internal library"}
              >
                {c.label}
              </button>
            ))}
          </div>
          {result.analysis.novelConcepts.length > 0 ? (
            <p className="mt-3 text-[0.7rem] leading-relaxed text-parchment-500">
              {result.analysis.novelConcepts.length} concept
              {result.analysis.novelConcepts.length === 1 ? " is" : "s are"} recognised but not yet
              represented in the internal library. They are still shown and searchable — the library
              enriches analysis, it does not gate it.
            </p>
          ) : null}
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <h3 className="text-sm font-semibold text-parchment-100">Strongest matches</h3>
          <p className="mt-1 text-xs text-parchment-500">Ranked deterministically by topic, tag and concept overlap.</p>
          <ul className="mt-4 space-y-2.5">
            {top.length === 0 ? (
              <li className="text-sm text-parchment-500">No sources matched strongly enough.</li>
            ) : (
              top.map((r) => (
                <li key={r.item.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone={r.item.quality === "ACADEMIC" ? "signal" : r.item.quality === "PRIMARY" ? "aurora" : "neutral"}>
                      {r.item.quality.replace("HIGH-QUALITY ", "")}
                    </Badge>
                    <span className="text-[0.68rem] text-parchment-600">{r.score.toFixed(1)}</span>
                  </div>
                  <p className="mt-2 text-sm leading-snug text-parchment-200">{r.item.title}</p>
                  <p className="mt-1 text-[0.7rem] text-parchment-500">{r.item.publisher}</p>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
            <Icon name="user" className="h-4 w-4 text-parchment-400" /> Entities
          </h3>
          <div className="mt-3 space-y-2.5">
            {(["ORG", "PERSON", "LOCATION", "WORK", "ACRONYM"] as const).map((kind) =>
              result.analysis.entities[kind].length ? (
                <div key={kind}>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-parchment-500">{kind}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {result.analysis.entities[kind].slice(0, 8).map((e) => (
                      <span key={e} className="rounded-md bg-white/[0.05] px-2 py-0.5 text-[0.72rem] text-parchment-300">
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null,
            )}
            {Object.values(result.analysis.entities).every((v) => v.length === 0) ? (
              <p className="text-sm text-parchment-500">No named entities were detected.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ConceptsTab({ result, onExplore }: { result: ExplorationResult; onExplore: (c: string) => void }) {
  const known = result.analysis.concepts.filter((c) => c.known);
  const novel = result.analysis.concepts.filter((c) => !c.known);

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-sm font-semibold text-parchment-100">
          {result.analysis.concepts.length} concepts recognised
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-parchment-500">
          Extracted locally from the material — independent of any starter list. {known.length} are
          already in the internal library; {novel.length} are new.
        </p>
      </Card>

      <ConceptGroup title="In the internal library" concepts={known} tone="signal" onExplore={onExplore} />
      <ConceptGroup title="New to the library" concepts={novel} tone="amber" onExplore={onExplore} />

      {result.analysis.concepts.length === 0 ? (
        <EmptyState
          title="No concepts could be isolated"
          description="The extracted text may be too short, fragmented, or mostly numeric. Try a longer document or paste more text."
        />
      ) : null}
    </div>
  );
}

function ConceptGroup({
  title,
  concepts,
  tone,
  onExplore,
}: {
  title: string;
  concepts: ExplorationResult["analysis"]["concepts"];
  tone: "signal" | "amber";
  onExplore: (c: string) => void;
}) {
  if (concepts.length === 0) return null;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-parchment-100">{title}</h3>
        <Badge tone={tone}>{concepts.length}</Badge>
      </div>
      <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {concepts.map((c) => (
          <li key={c.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-parchment-100">{c.label}</p>
              <span className="shrink-0 text-[0.68rem] text-parchment-600">{c.score.toFixed(2)}</span>
            </div>
            {c.evidence ? (
              <p className="mt-1.5 line-clamp-2 text-[0.72rem] leading-relaxed text-parchment-500">{c.evidence}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {c.disciplines.slice(0, 2).map((d) => (
                <Badge key={d} tone="outline">{d.replace(/-/g, " ")}</Badge>
              ))}
              {c.related.slice(0, 2).map((r) => (
                <span key={r} className="text-[0.68rem] text-parchment-600">↔ {r}</span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => onExplore(c.label)}
              className="mt-2 text-[0.72rem] text-signal-300 hover:text-signal-200"
            >
              Explore this →
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ResearchTab({
  result,
  grouped,
  onSave,
  savedKeys,
  onExplore,
}: {
  result: ExplorationResult;
  grouped: { academic: Recommendation<SourceRecord>[] };
  onSave: (kind: string, refId: string, title: string, url?: string, payload?: unknown) => void;
  savedKeys: Set<string>;
  onExplore: (c: string) => void;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
          <Icon name="lightbulb" className="h-4 w-4 text-aurora-400" /> Research directions from the library
        </h3>
        {result.ideas.length === 0 ? (
          <EmptyState title="No matching research directions" description="The internal idea library has no entry that overlaps with this material strongly enough." />
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {result.ideas.map((r) => (
              <li key={r.item.id} className="surface flex flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-medium leading-snug text-parchment-100">{r.item.title}</h4>
                  <button
                    type="button"
                    onClick={() => onSave("idea", r.item.id, r.item.title, undefined, r.item)}
                    aria-label="Save idea"
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                      savedKeys.has(`idea:${r.item.id}`) ? "bg-aurora-500/20 text-aurora-400" : "text-parchment-600 hover:bg-white/5 hover:text-parchment-300",
                    )}
                  >
                    <Icon name={savedKeys.has(`idea:${r.item.id}`) ? "check" : "bookmark"} className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-parchment-400">{r.item.description}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {r.item.difficulty ? <Badge tone="outline">{r.item.difficulty}</Badge> : null}
                  {r.item.researchType ? <Badge tone="outline">{r.item.researchType}</Badge> : null}
                </div>
                <p className="mt-3 text-[0.72rem] text-parchment-500">{r.reasons[0]}</p>
                <button
                  type="button"
                  onClick={() => onExplore(r.item.title)}
                  className="mt-3 self-start text-[0.72rem] text-signal-300 hover:text-signal-200"
                >
                  Explore this direction →
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
          <Icon name="book" className="h-4 w-4 text-signal-300" /> Academic sources
        </h3>
        {grouped.academic.length === 0 ? (
          <EmptyState
            title="No academic sources retrieved"
            description="Either no academic provider is enabled, or the providers returned nothing for these queries. Enable a keyless provider such as OpenAlex in your environment."
          />
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {grouped.academic.map((r) => (
              <SourceCard key={r.item.id} rec={r} onSave={(x) => onSave("source", x.item.id, x.item.title, x.item.url, x.item)} saved={savedKeys.has(`source:${r.item.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CasesTab({
  result,
  onSave,
  savedKeys,
}: {
  result: ExplorationResult;
  onSave: (kind: string, refId: string, title: string, url?: string, payload?: unknown) => void;
  savedKeys: Set<string>;
}) {
  if (result.cases.length === 0) {
    return <EmptyState title="No matching cases" description="The internal case library has no entry that overlaps with this material strongly enough." />;
  }
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {result.cases.map((r) => {
        const c: CaseRecord = r.item;
        return (
          <li key={c.id} className="surface flex flex-col p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {c.year ? <Badge tone="outline">{c.year}</Badge> : null}
                {c.country ? <Badge tone="outline">{c.country}</Badge> : null}
                {c.synthetic ? <Badge tone="rose">Demo record</Badge> : null}
              </div>
              <button
                type="button"
                onClick={() => onSave("case", c.id, c.title, undefined, c)}
                aria-label="Save case"
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-md",
                  savedKeys.has(`case:${c.id}`) ? "bg-aurora-500/20 text-aurora-400" : "text-parchment-600 hover:bg-white/5 hover:text-parchment-300",
                )}
              >
                <Icon name={savedKeys.has(`case:${c.id}`) ? "check" : "bookmark"} className="h-3.5 w-3.5" />
              </button>
            </div>
            <h4 className="mt-3 text-sm font-medium text-parchment-100">{c.title}</h4>
            <p className="mt-2 text-xs leading-relaxed text-parchment-400">{c.shortDescription}</p>
            {c.longDescription ? <p className="mt-2 text-xs leading-relaxed text-parchment-500">{c.longDescription}</p> : null}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.topics.slice(0, 4).map((t) => (
                <Badge key={t} tone="neutral">{t}</Badge>
              ))}
            </div>
            <p className="mt-3 text-[0.72rem] text-parchment-500">{r.reasons[0]}</p>
          </li>
        );
      })}
    </ul>
  );
}

function DataTab({
  result,
  recs,
  onSave,
  savedKeys,
}: {
  result: ExplorationResult;
  recs: Recommendation<SourceRecord>[];
  onSave: (kind: string, refId: string, title: string, url?: string, payload?: unknown) => void;
  savedKeys: Set<string>;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
          <Icon name="database" className="h-4 w-4 text-aurora-400" /> Official statistics
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-parchment-500">
          Values below come from the World Bank Open Data API (primary source) when a concept could be
          mapped to a real indicator. Lattice never invents a statistic.
        </p>
        {result.dataPoints.length > 0 ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.dataPoints.map((d, i) => (
              <li key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[0.68rem] uppercase tracking-wide text-parchment-500">{d.country}</p>
                <p className="mt-1 text-lg font-semibold text-parchment-100">
                  {d.value}
                  {d.unit ? <span className="ml-1 text-xs font-normal text-parchment-500">{d.unit}</span> : null}
                </p>
                <p className="mt-1 text-[0.72rem] leading-snug text-parchment-400">{d.label}</p>
                {d.year ? <p className="mt-0.5 text-[0.68rem] text-parchment-600">Latest: {d.year}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-parchment-500">
            No official indicator could be mapped to these concepts for this run.
          </p>
        )}
      </Card>
      <SourcesGrid recs={recs} onSave={onSave} savedKeys={savedKeys} />
    </div>
  );
}

function PerspectivesTab({ result, onExplore }: { result: ExplorationResult; onExplore: (c: string) => void }) {
  const byClaim = new Map<string, { supporting: typeof result.perspectives; challenging: typeof result.perspectives }>();
  for (const p of result.perspectives) {
    const entry = byClaim.get(p.claim) ?? { supporting: [], challenging: [] };
    if (p.stance === "supporting") entry.supporting.push(p);
    else entry.challenging.push(p);
    byClaim.set(p.claim, entry);
  }

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
          <Icon name="scale" className="h-4 w-4 text-amber-400" /> Opposing perspectives
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-parchment-500">
          Every position is traceable to at least one stored source. Lattice does not manufacture
          counter-arguments; when no perspective is recorded, it says so.
        </p>
        <a
          href="https://www.britannica.com/procon"
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-signal-300 hover:text-signal-200"
        >
          Britannica ProCon — debate framing <Icon name="external" className="h-3 w-3" />
        </a>
      </Card>

      {byClaim.size === 0 ? (
        <EmptyState
          title="No opposing-perspective material stored"
          description="The internal perspective library has no recorded positions on this subject yet. Explore the topic through external sources instead."
        />
      ) : (
        Array.from(byClaim.entries()).map(([claim, { supporting, challenging }]) => (
          <Card key={claim}>
            <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-parchment-500">Contested claim</p>
            <h4 className="mt-1 text-sm font-medium text-parchment-100">{claim}</h4>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-aurora-500/20 bg-aurora-500/[0.05] p-3.5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-aurora-400">Supporting</p>
                <ul className="mt-2 space-y-2">
                  {supporting.length === 0 ? <li className="text-xs text-parchment-500">No supporting position recorded.</li> : null}
                  {supporting.map((p) => (
                    <li key={p.id}>
                      <p className="text-xs leading-relaxed text-parchment-300">{p.summary}</p>
                      <p className="mt-1 text-[0.68rem] text-parchment-600">{p.sources.length} source(s)</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.05] p-3.5">
                <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-rose-400">Challenging</p>
                <ul className="mt-2 space-y-2">
                  {challenging.length === 0 ? <li className="text-xs text-parchment-500">No challenging position recorded.</li> : null}
                  {challenging.map((p) => (
                    <li key={p.id}>
                      <p className="text-xs leading-relaxed text-parchment-300">{p.summary}</p>
                      <p className="mt-1 text-[0.68rem] text-parchment-600">{p.sources.length} source(s)</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onExplore(claim)}
              className="mt-3 text-[0.72rem] text-signal-300 hover:text-signal-200"
            >
              Explore this claim →
            </button>
          </Card>
        ))
      )}
    </div>
  );
}

function SourcesGrid({
  recs,
  onSave,
  savedKeys,
}: {
  recs: Recommendation<SourceRecord>[];
  onSave: (kind: string, refId: string, title: string, url?: string, payload?: unknown) => void;
  savedKeys: Set<string>;
}) {
  if (recs.length === 0) {
    return <EmptyState title="No sources in this category" description="Nothing matched strongly enough in this category for the material provided." />;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {recs.map((r) => (
        <SourceCard key={r.item.id} rec={r} onSave={(x) => onSave("source", x.item.id, x.item.title, x.item.url, x.item)} saved={savedKeys.has(`source:${r.item.id}`)} />
      ))}
    </div>
  );
}

function NextTab({ result, onExplore }: { result: ExplorationResult; onExplore: (c: string) => void }) {
  return (
    <div className="space-y-4">
      <Card>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
          <Icon name="compass" className="h-4 w-4 text-signal-300" /> Where should you go next?
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-parchment-500">
          These suggestions are derived from the concepts, cases, ideas and perspectives already found —
          not generated by an AI model.
        </p>
      </Card>
      <ul className="grid gap-3 md:grid-cols-2">
        {result.next.map((n, i) => (
          <li key={i} className="surface flex flex-col p-4">
            <p className="text-sm font-medium text-parchment-100">{n.label}</p>
            <p className="mt-2 text-xs leading-relaxed text-parchment-500">{n.rationale}</p>
            <button
              type="button"
              onClick={() => {
                const a = n.action;
                const target = a.type === "concept" ? a.concept : a.type === "explore" ? a.query : n.label;
                onExplore(target);
              }}
              className="mt-3 self-start text-[0.72rem] text-signal-300 hover:text-signal-200"
            >
              Go →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProviderReportPanel({ result }: { result: ExplorationResult }) {
  const [open, setOpen] = useState(false);
  if (result.providers.length === 0) return null;
  return (
    <div className="mt-10 border-t border-white/[0.06] pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs text-parchment-500 hover:text-parchment-300"
      >
        <Icon name={open ? "chevron-down" : "chevron-right"} className="h-3.5 w-3.5" />
        Source provider report ({result.providers.length})
      </button>
      {open ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {result.providers.map((p) => (
            <li key={p.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-parchment-300">{p.label}</span>
                <Badge tone={p.status === "ok" ? "aurora" : p.status === "empty" ? "neutral" : p.status === "skipped" ? "outline" : "rose"}>
                  {p.status}
                </Badge>
              </div>
              {p.message ? <p className="mt-1 text-[0.68rem] leading-relaxed text-parchment-600">{p.message}</p> : null}
              <p className="mt-1 text-[0.68rem] text-parchment-600">{p.resultCount} result(s)</p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ── States ───────────────────────────────────────────────────────────────────

function IntroState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-6 py-14 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-signal-500/20 to-aurora-500/20 text-signal-300">
        <Icon name="compass" className="h-6 w-6" />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-parchment-100">Start with anything</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-parchment-500">
        Upload a document, paste text, give a URL, or type a topic. Lattice extracts the concepts
        locally — no AI required — then finds related cases, research, data and opposing perspectives
        from the sources actually available to it.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4" aria-live="polite" aria-busy="true">
      <div className="surface p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-3 h-7 w-2/3" />
        <Skeleton className="mt-3 h-4 w-full" />
        <Skeleton className="mt-2 h-4 w-4/5" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="surface p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-5 w-3/4" />
            <Skeleton className="mt-2 h-3 w-full" />
            <Skeleton className="mt-2 h-3 w-5/6" />
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-parchment-500">Analysing locally and querying enabled sources…</p>
    </div>
  );
}
