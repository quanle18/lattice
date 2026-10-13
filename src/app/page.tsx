import Link from "next/link";
import { Badge, Card, Icon, SectionHeading } from "@/components/ui";
import { Hero } from "@/components/landing/hero";
import { libraryStats } from "@/lib/kb/repository";
import { providerSummary } from "@/lib/providers/registry";
import { runtimeMode } from "@/lib/config";

const DISCIPLINES = [
  { name: "International Relations", example: "multipolarity · balance of power · diplomacy", icon: "globe" as const },
  { name: "Economics", example: "comparative advantage · inflation · labour", icon: "database" as const },
  { name: "History", example: "empire · decolonisation · industrialisation", icon: "book" as const },
  { name: "Biology", example: "evolution · selection · microbiome", icon: "layers" as const },
  { name: "Climate Science", example: "tipping points · carbon pricing · adaptation", icon: "globe" as const },
  { name: "Philosophy", example: "consciousness · justice · epistemology", icon: "lightbulb" as const },
  { name: "Technology & AI", example: "scaling · automation · semiconductors", icon: "sparkle" as const },
  { name: "Sociology", example: "mobility · inequality · urbanisation", icon: "user" as const },
];

const FEATURES = [
  {
    icon: "file" as const,
    title: "Understand",
    body: "Local concept extraction, entity recognition and claim detection run on every upload. No starter list decides what you are allowed to explore.",
  },
  {
    icon: "search" as const,
    title: "Discover",
    body: "Queries are built from your material's concepts and sent to whatever free providers are configured — OpenAlex, Crossref, arXiv, Wikipedia, World Bank, GDELT.",
  },
  {
    icon: "scale" as const,
    title: "Compare",
    body: "Contested claims are paired with supporting and challenging positions, each traceable to a stored source. Lattice never invents a counter-argument.",
  },
  {
    icon: "shield" as const,
    title: "Verify",
    body: "Every recommendation shows publisher, date, source type, quality tier and an outbound link. AI output, where enabled, is labelled separately.",
  },
  {
    icon: "graph" as const,
    title: "Connect",
    body: "A navigable knowledge map built from real extracted concepts and stored relationships. Clicking a node re-queries the database, never a model.",
  },
  {
    icon: "compass" as const,
    title: "Continue",
    body: "“Where should you go next?” is derived from concepts, cases and ideas already found — so every suggestion leads to a working action.",
  },
];

export default function LandingPage() {
  const stats = libraryStats();
  const providers = providerSummary();
  const enabled = providers.filter((p) => p.enabled);
  const mode = runtimeMode();

  return (
    <div>
      <Hero />

      {/* Capability strip — honest about what is configured */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="surface flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={mode === "live" ? "aurora" : "amber"}>
              {mode === "live" ? "Live mode" : "Demo mode"}
            </Badge>
            <span className="text-xs text-parchment-400">
              {mode === "live"
                ? `${enabled.length} keyless source provider${enabled.length === 1 ? "" : "s"} enabled`
                : "No external providers enabled — the internal demonstration library is used"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-parchment-500">
            <span>{stats.concepts} indexed concepts</span>
            <span>·</span>
            <span>{stats.cases} cases</span>
            <span>·</span>
            <span>{stats.ideas} research directions</span>
          </div>
        </div>
      </section>

      {/* Discovery showcase */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-labelledby="showcase">
        <SectionHeading
          id="showcase"
          eyebrow="Discovery"
          title="Any discipline, not a fixed list"
          description="Lattice recognises concepts in arbitrary material. These disciplines are examples of what it handles — not a whitelist. Niche and unanticipated subjects work the same way."
        />
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {DISCIPLINES.map((d) => (
            <li key={d.name}>
              <Link
                href={`/explore?q=${encodeURIComponent(d.name)}`}
                className="group flex h-full flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.04]"
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.05] text-signal-300">
                  <Icon name={d.icon} className="h-4 w-4" />
                </span>
                <span className="mt-3 text-sm font-medium text-parchment-100">{d.name}</span>
                <span className="mt-1.5 text-[0.72rem] leading-relaxed text-parchment-500">{d.example}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-[0.72rem] text-signal-300 opacity-0 transition-opacity group-hover:opacity-100">
                  Explore <Icon name="chevron-right" className="h-3 w-3" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Features */}
      <section className="border-y border-white/[0.06] bg-ink-950/40" aria-labelledby="features">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <SectionHeading
            id="features"
            eyebrow="How it works"
            title="Understand → Explore → Verify → Connect"
            description="The recommendation engine is arithmetic over database fields, not a language model. That is what keeps it free, fast, and explainable."
          />
          <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <li key={f.title}>
                <Card className="h-full">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-signal-500/20 to-aurora-500/20 text-signal-300">
                      <Icon name={f.icon} className="h-4 w-4" />
                    </span>
                    <span className="text-[0.68rem] font-mono text-parchment-600">0{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-parchment-100">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-parchment-400">{f.body}</p>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Sources */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6" aria-labelledby="sources">
        <SectionHeading
          id="sources"
          eyebrow="Source ecosystem"
          title="Grounded in real, traceable sources"
          description="Lattice is a discovery tool, not a republisher. It stores metadata and links out to the original. Providers that need a key stay disabled until you configure them."
        />
        <div className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <h3 className="text-sm font-semibold text-parchment-100">Configured providers</h3>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {providers.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                  <span className="truncate text-xs text-parchment-300">{p.label}</span>
                  <Badge tone={p.enabled ? "aurora" : "outline"}>
                    {p.enabled ? (p.keyless ? "free" : "keyed") : "off"}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.72rem] leading-relaxed text-parchment-500">
              Every provider sits behind a replaceable interface. Disabled providers degrade gracefully:
              the exploration still completes using cached or internal results.
            </p>
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-parchment-100">Quality tiers</h3>
            <ul className="mt-4 space-y-2.5">
              {[
                ["PRIMARY", "Official statistics and original datasets", "aurora"],
                ["ACADEMIC", "Peer-reviewed papers and preprints", "signal"],
                ["HIGH-QUALITY JOURNALISM", "Established news organisations", "neutral"],
                ["GENERAL REFERENCE", "Encyclopaedic and educational sources", "outline"],
                ["DEBATE / PERSPECTIVE", "Pro/contra framing, incl. Britannica ProCon", "amber"],
              ].map(([tier, desc, tone]) => (
                <li key={tier} className="flex items-start gap-3">
                  <Badge tone={tone as "aurora"}>{tier.replace("HIGH-QUALITY ", "")}</Badge>
                  <span className="text-xs leading-relaxed text-parchment-400">{desc}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* Honest limitations */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <Card className="border-amber-500/20 bg-amber-500/[0.04]">
          <div className="flex items-start gap-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/15 text-amber-400">
              <Icon name="alert" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-parchment-100">What this platform does not claim</h2>
              <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-parchment-400 sm:grid-cols-2">
                <li>· It does not have access to every source on the internet.</li>
                <li>· It does not fabricate sources, statistics or counter-arguments.</li>
                <li>· It is not a substitute for legal, medical or financial advice.</li>
                <li>· Demonstration-library records are clearly labelled as fictional.</li>
              </ul>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
