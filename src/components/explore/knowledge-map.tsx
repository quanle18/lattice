"use client";

import { useMemo, useState } from "react";
import { Badge, Icon, cn } from "@/components/ui";
import type { KnowledgeMap } from "@/lib/types";

/**
 * Interactive knowledge map.
 *
 * Layout: the strongest concept sits at the centre, remaining nodes are placed
 * on concentric rings ordered by weight. All positions are computed locally —
 * selecting a node never triggers a model call.
 */
export function KnowledgeMapView({
  map,
  onExplore,
}: {
  map: KnowledgeMap;
  onExplore?: (concept: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const layout = useMemo(() => {
    const W = 720;
    const H = 480;
    const cx = W / 2;
    const cy = H / 2;
    const nodes = map.nodes.slice(0, 22);
    if (nodes.length === 0) return { W, H, positions: new Map<string, { x: number; y: number; r: number }>() };

    const sorted = nodes.slice().sort((a, b) => b.weight - a.weight);
    const positions = new Map<string, { x: number; y: number; r: number }>();

    // Centre node.
    const hub = sorted[0];
    positions.set(hub.id, { x: cx, y: cy, r: 9 + hub.weight * 5 });

    // Ring assignment.
    const rings = [1, 2, 3];
    let idx = 1;
    rings.forEach((ring, ringIndex) => {
      const count = ringIndex === 0 ? 6 : ringIndex === 1 ? 8 : 6;
      const radius = 90 + ringIndex * 78;
      for (let i = 0; i < count && idx < sorted.length; i++, idx++) {
        const n = sorted[idx];
        const angle = (i / count) * Math.PI * 2 + ringIndex * 0.4;
        positions.set(n.id, {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius * 0.82,
          r: 5 + n.weight * 5,
        });
      }
    });

    return { W, H, positions };
  }, [map]);

  const neighbours = useMemo(() => {
    if (!selected) return new Set<string>();
    const set = new Set<string>();
    for (const e of map.edges) {
      if (e.source === selected) set.add(e.target);
      else if (e.target === selected) set.add(e.source);
    }
    return set;
  }, [selected, map]);

  const selectedNode = map.nodes.find((n) => n.id === selected);

  // Captioning every node guarantees collisions in a force layout, so only the
  // most significant ones are labelled. The selected node and its neighbours
  // always are, so selection never hides information.
  const labelThreshold = useMemo(() => {
    const radii = map.nodes
      .slice(0, 22)
      .map((n) => layout.positions.get(n.id)?.r ?? 0)
      .sort((a, b) => b - a);
    return radii.length > 12 ? radii[11] : 0;
  }, [map.nodes, layout]);

  if (map.nodes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-parchment-500">
        No concepts were strong enough to map. Try a longer document.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="surface overflow-hidden p-2">
        <svg
          viewBox={`0 0 ${layout.W} ${layout.H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`Knowledge map with ${map.nodes.length} concepts and ${map.edges.length} relationships`}
        >
          <defs>
            <radialGradient id="hubGlow" cx="50%" cy="50%">
              <stop offset="0%" stopColor="#5c86fb" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#5c86fb" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx={layout.W / 2} cy={layout.H / 2} r={190} fill="url(#hubGlow)" />

          {/* Edges */}
          <g>
            {map.edges.map((e, i) => {
              const a = layout.positions.get(e.source);
              const b = layout.positions.get(e.target);
              if (!a || !b) return null;
              const active = !selected || selected === e.source || selected === e.target;
              return (
                <line
                  key={i}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={active ? "rgba(140,170,255,0.35)" : "rgba(255,255,255,0.05)"}
                  strokeWidth={active ? 1.2 : 0.6}
                  strokeDasharray={e.type === "co-occurrence" ? "3 4" : undefined}
                />
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {map.nodes.slice(0, 22).map((n) => {
              const p = layout.positions.get(n.id);
              if (!p) return null;
              const isSelected = selected === n.id;
              const isNeighbour = neighbours.has(n.id);
              const dimmed = selected !== null && !isSelected && !isNeighbour;
              const fill = n.kind === "entity" ? "#5eead4" : n.known ? "#5c86fb" : "#a9bbf5";
              return (
                <g
                  key={n.id}
                  transform={`translate(${p.x},${p.y})`}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.25 : 1}
                  onClick={() => setSelected(isSelected ? null : n.id)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Concept: ${n.label}${n.known ? " (in library)" : " (new)"}`}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      setSelected(isSelected ? null : n.id);
                    }
                  }}
                >
                  <circle r={p.r + 8} fill="transparent" />
                  <circle
                    r={p.r}
                    fill={fill}
                    fillOpacity={isSelected ? 0.95 : 0.65}
                    stroke={isSelected ? "#fff" : "rgba(255,255,255,0.25)"}
                    strokeWidth={isSelected ? 2 : 1}
                  />
                  {(p.r >= labelThreshold || isSelected || isNeighbour) && (
                    <text
                      y={p.r + 15}
                      textAnchor="middle"
                      className="pointer-events-none select-none"
                      fontSize={Math.max(10, Math.min(12, 13 - n.label.length / 14))}
                      fill={dimmed ? "rgba(200,205,220,0.4)" : "#c9cdd8"}
                    >
                      {n.label.length > 18 ? `${n.label.slice(0, 17)}…` : n.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="surface flex flex-col p-4">
        {selectedNode ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-wide text-parchment-500">
                  Selected concept
                </p>
                <h4 className="mt-1 text-base font-semibold text-parchment-100">{selectedNode.label}</h4>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Clear selection"
                className="grid h-7 w-7 place-items-center rounded-md text-parchment-500 hover:bg-white/5 hover:text-parchment-200"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone={selectedNode.known ? "signal" : "amber"}>
                {selectedNode.known ? "In library" : "New to library"}
              </Badge>
              <Badge tone="outline">{selectedNode.kind}</Badge>
              {selectedNode.disciplines.slice(0, 2).map((d) => (
                <Badge key={d} tone="neutral">
                  {d.replace(/-/g, " ")}
                </Badge>
              ))}
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-parchment-500">
              Connected to {neighbours.size} concept{neighbours.size === 1 ? "" : "s"}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {Array.from(neighbours).map((id) => {
                const n = map.nodes.find((x) => x.id === id);
                if (!n) return null;
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => setSelected(id)}
                      className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[0.72rem] text-parchment-300 hover:border-white/20 hover:text-parchment-100"
                    >
                      {n.label}
                    </button>
                  </li>
                );
              })}
            </ul>

            {onExplore ? (
              <button
                type="button"
                onClick={() => onExplore(selectedNode.label)}
                className={cn(
                  "mt-auto flex items-center justify-center gap-2 rounded-lg bg-signal-500 px-4 py-2.5 text-sm font-medium text-white",
                  "hover:bg-signal-400",
                )}
              >
                <Icon name="compass" className="h-4 w-4" />
                Explore “{selectedNode.label}”
              </button>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Icon name="graph" className="h-8 w-8 text-parchment-600" />
            <p className="mt-3 text-sm font-medium text-parchment-300">Select a concept</p>
            <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-parchment-500">
              Click any node to see its connections, then explore it as a new research direction.
              Nodes marked “new to library” are concepts Lattice recognised but has not yet indexed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
