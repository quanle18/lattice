import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, EmptyState, Icon, LinkButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Saved items" };

export default async function SavedPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const items = await getStore().listSaved(user.id);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-parchment-100">Saved items</h1>
        <p className="mt-2 text-sm text-parchment-400">
          Cases, ideas and sources you have bookmarked. {items.length} item{items.length === 1 ? "" : "s"}.
        </p>
      </header>

      {items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="When you explore, use the bookmark button on any case, idea or source to keep it here."
          action={<LinkButton href="/explore">Start exploring</LinkButton>}
          icon={<Icon name="bookmark" className="h-8 w-8" />}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="flex h-full flex-col">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="signal">{item.kind}</Badge>
                  <span className="text-[0.68rem] text-parchment-600">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-parchment-100">{item.title}</p>
                {item.url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-2 inline-flex items-center gap-1 text-xs text-signal-300 hover:text-signal-200"
                  >
                    Open original <Icon name="external" className="h-3 w-3" />
                  </a>
                ) : null}
                <Link
                  href={`/explore?q=${encodeURIComponent(item.title)}`}
                  className="mt-auto pt-3 text-xs text-parchment-400 hover:text-parchment-200"
                >
                  Explore this again →
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
