"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Icon, cn } from "@/components/ui";

const SUGGESTIONS = [
  "Multipolarity and the balance of power",
  "How does automation affect wages?",
  "Philosophy of consciousness",
  "Climate tipping points",
];

/** A small, honest constellation: concepts Lattice actually understands. */
const NODES = [
  // Six disciplines, 60° apart. A 72° spacing starting at -90° wraps the last
  // label back onto the first, which is what made them overlap.
  { label: "International relations", angle: -90, r: 1 },
  { label: "Economics", angle: -30, r: 1 },
  { label: "Climate", angle: 30, r: 1 },
  { label: "Philosophy", angle: 90, r: 1 },
  { label: "Biology", angle: 150, r: 1 },
  { label: "History", angle: 210, r: 1 },
  // Inner ring offset by 30° so no two labels sit on the same ray.
  { label: "multipolarity", angle: -60, r: 0.62 },
  { label: "automation", angle: 0, r: 0.62 },
  { label: "consciousness", angle: 60, r: 0.62 },
  { label: "emissions", angle: 120, r: 0.62 },
  { label: "empire", angle: 180, r: 0.62 },
  { label: "selection", angle: 240, r: 0.62 },
];

export function Hero() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hovered, setHovered] = useState<number | null>(null);

  const go = (value: string) => {
    const query = value.trim();
    if (query.length < 3) return;
    router.push(`/explore?q=${encodeURIComponent(query)}`);
  };

  const cx = 300;
  const cy = 260;

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-backdrop" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-[-18rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(58,98,240,0.35), transparent 62%)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[0.72rem] text-parchment-300">
              <span className="h-1.5 w-1.5 rounded-full bg-aurora-400" />
              Deterministic engine · AI optional · $0 to run
            </span>

            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-parchment-100 sm:text-5xl lg:text-6xl">
              One idea.
              <br />
              <span className="text-gradient">A world of connections.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-parchment-400">
              Explore any subject, connect ideas across disciplines, and discover the research,
              evidence, cases and perspectives worth exploring next.
            </p>

            <form
              className="mt-8"
              onSubmit={(e) => {
                e.preventDefault();
                go(q);
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-parchment-500" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Ask a question, or enter any topic…"
                    aria-label="Start exploring"
                    className="h-12 w-full rounded-xl border border-white/12 bg-ink-900/80 py-3.5 pl-11 pr-4 text-sm text-parchment-100 placeholder:text-parchment-600 focus:border-signal-500/50 focus:outline-none focus:ring-2 focus:ring-signal-500/20"
                  />
                </div>
                <Button type="submit" size="lg" className="sm:w-auto">
                  <Icon name="compass" className="h-4 w-4" />
                  Start Exploring
                </Button>
                <a
                  href="/explore?tab=upload"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-white/12 px-5 text-sm font-medium text-parchment-200 transition-colors hover:bg-white/5"
                >
                  <Icon name="upload" className="h-4 w-4" />
                  Upload Research
                </a>
              </div>
            </form>

            <div className="mt-5 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => go(s)}
                  className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-[0.72rem] text-parchment-400 transition-colors hover:border-white/20 hover:text-parchment-200"
                >
                  {s}
                </button>
              ))}
            </div>

            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-6">
              {[
                { k: "Formats", v: "10+" },
                { k: "Disciplines", v: "Any" },
                { k: "AI cost", v: "$0" },
              ].map((s) => (
                <div key={s.k}>
                  <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-parchment-600">{s.k}</dt>
                  <dd className="mt-1 text-xl font-semibold text-parchment-100">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Constellation */}
          <div className="relative animate-fade-in">
            <div className="surface relative overflow-hidden p-3">
              <svg viewBox="0 0 600 520" className="h-auto w-full" role="img" aria-label="A constellation of concepts connected across disciplines">
                <defs>
                  <radialGradient id="heroGlow" cx="50%" cy="50%">
                    <stop offset="0%" stopColor="#3a62f0" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#3a62f0" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx={cx} cy={cy} r={210} fill="url(#heroGlow)" />

                {/* Orbit rings */}
                {[110, 190, 250].map((r) => (
                  <ellipse key={r} cx={cx} cy={cy} rx={r} ry={r * 0.82} fill="none" stroke="rgba(255,255,255,0.05)" />
                ))}

                {/* Edges from centre to ring 1 and ring 1 to ring 2 */}
                {NODES.map((n, i) => {
                  const rad = (n.angle * Math.PI) / 180;
                  const dist = n.r === 1 ? 190 : 250;
                  const x = cx + Math.cos(rad) * dist;
                  const y = cy + Math.sin(rad) * dist * 0.82;
                  return (
                    <line
                      key={`e${i}`}
                      x1={cx}
                      y1={cy}
                      x2={x}
                      y2={y}
                      stroke={hovered === i ? "rgba(140,170,255,0.6)" : "rgba(255,255,255,0.09)"}
                      strokeWidth={hovered === i ? 1.6 : 1}
                    />
                  );
                })}

                {/* Nodes */}
                {NODES.map((n, i) => {
                  const rad = (n.angle * Math.PI) / 180;
                  const dist = n.r === 1 ? 190 : 250;
                  const x = cx + Math.cos(rad) * dist;
                  const y = cy + Math.sin(rad) * dist * 0.82;
                  const big = n.r === 1;
                  return (
                    <g
                      key={n.label}
                      transform={`translate(${x},${y})`}
                      onMouseEnter={() => setHovered(i)}
                      onMouseLeave={() => setHovered(null)}
                      className="cursor-pointer"
                    >
                      <circle r={big ? 7 : 4.5} fill={big ? "#5c86fb" : "#5eead4"} fillOpacity={hovered === i ? 1 : 0.7} />
                      <text
                        x={x > cx ? 12 : -12}
                        textAnchor={x > cx ? "start" : "end"}
                        y={4}
                        fontSize={big ? 12 : 11}
                        fill={hovered === i ? "#f4f5f7" : "#9aa0b0"}
                        className="select-none"
                      >
                        {n.label}
                      </text>
                    </g>
                  );
                })}

                {/* Centre */}
                <g transform={`translate(${cx},${cy})`}>
                  <circle r={26} fill="#3a62f0" fillOpacity="0.22" />
                  <circle r={13} fill="#5c86fb" />
                  <text y={4} textAnchor="middle" fontSize={10} fill="#07080c" fontWeight="700">
                    ?
                  </text>
                </g>
              </svg>

              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-ink-950/70 px-3 py-2 backdrop-blur">
                <span className="text-[0.7rem] text-parchment-400">
                  Your material becomes a map you can navigate
                </span>
                <span className="text-[0.7rem] text-parchment-600">Hover a node</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
