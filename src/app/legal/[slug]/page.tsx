import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { LEGAL_DOCUMENTS, getLegalDocument } from "@/data/legal";

export function generateStaticParams() {
  return LEGAL_DOCUMENTS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = getLegalDocument(slug);
  return { title: doc?.title ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getLegalDocument(slug);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <nav aria-label="Legal documents" className="no-print mb-8 flex flex-wrap gap-2">
        {LEGAL_DOCUMENTS.map((d) => (
          <Link
            key={d.slug}
            href={`/legal/${d.slug}`}
            className={
              d.slug === doc.slug
                ? "rounded-full border border-signal-400/30 bg-signal-500/10 px-3 py-1 text-[0.72rem] text-signal-200"
                : "rounded-full border border-white/10 px-3 py-1 text-[0.72rem] text-parchment-400 hover:border-white/20 hover:text-parchment-200"
            }
          >
            {d.title}
          </Link>
        ))}
        <Link
          href="/legal/privacy-request"
          className="rounded-full border border-white/10 px-3 py-1 text-[0.72rem] text-parchment-400 hover:border-white/20 hover:text-parchment-200"
        >
          Privacy Request
        </Link>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-parchment-100">{doc.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-parchment-400">{doc.summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Badge tone="outline">Version {doc.version}</Badge>
          <Badge tone="outline">Effective {doc.effectiveDate}</Badge>
          <Badge tone="outline">Last updated {doc.lastUpdated}</Badge>
        </div>
      </header>

      <Card className="border-amber-500/20 bg-amber-500/[0.04]">
        <p className="text-xs leading-relaxed text-parchment-400">
          <strong className="text-amber-400">Template notice.</strong> This document is a structured
          template written to match what the software actually does. It is not legal advice and does not
          claim compliance with any specific jurisdiction&apos;s requirements. Have qualified counsel
          review and adapt it for the markets you operate in before commercial launch.
        </p>
      </Card>

      <article className="mt-8 space-y-8">
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-semibold text-parchment-100">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-3 text-sm leading-relaxed text-parchment-400">
                {p}
              </p>
            ))}
            {s.list ? (
              <ul className="mt-3 space-y-2">
                {s.list.map((item, i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-parchment-400">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-parchment-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>

      <p className="mt-12 border-t border-white/[0.06] pt-6 text-xs text-parchment-600">
        Versions accepted at sign-up are stored against your account. Material changes are published
        with a new version number and effective date.
      </p>
    </div>
  );
}
