import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, Icon, LinkButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "My Research" };

export default async function MyResearchPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const [explorations, usage] = await Promise.all([
    getStore().listExplorations(user.id),
    getStore().usageSummary(user.id),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-parchment-100">My Research</h1>
          <p className="mt-2 text-sm text-parchment-400">
            {explorations.length} exploration{explorations.length === 1 ? "" : "s"} recorded.
          </p>
        </div>
        <LinkButton href="/explore" variant="secondary" size="sm">
          <Icon name="compass" className="h-3.5 w-3.5" /> New exploration
        </LinkButton>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Explorations", value: usage.explorations },
          { label: "Source searches", value: usage.searchCalls },
          { label: "Deep AI operations", value: usage.aiCalls },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-[0.68rem] uppercase tracking-wide text-parchment-500">{s.label}</p>
            <p className="mt-1.5 text-2xl font-semibold text-parchment-100">{s.value}</p>
          </Card>
        ))}
      </div>

      {explorations.length === 0 ? (
        <EmptyState
          title="No explorations yet"
          description="Explorations you run while signed in appear here so you can return to them."
          action={<LinkButton href="/explore">Start exploring</LinkButton>}
          icon={<Icon name="book" className="h-8 w-8" />}
        />
      ) : (
        <ul className="space-y-2.5">
          {explorations.map((e) => (
            <li key={e.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-parchment-100">{e.label}</p>
                  <p className="mt-0.5 text-[0.7rem] text-parchment-500">
                    {e.kind} · {new Date(e.createdAt).toLocaleString()}
                  </p>
                </div>
                <Badge tone="outline">{e.kind}</Badge>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-center text-xs text-parchment-600">
        Need something else?{" "}
        <Link href="/saved" className="text-signal-300 hover:text-signal-200">See saved items</Link>.
      </p>
    </div>
  );
}
