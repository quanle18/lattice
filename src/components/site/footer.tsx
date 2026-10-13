import Link from "next/link";
import { Icon } from "@/components/ui";

const LEGAL = [
  { href: "/legal/terms", label: "Terms of Service" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/cookies", label: "Cookie Policy" },
  { href: "/legal/copyright", label: "Copyright & Content Policy" },
  { href: "/legal/attribution", label: "Source Attribution" },
  { href: "/legal/privacy-request", label: "Data Deletion / Privacy Request" },
  { href: "/legal/contact", label: "Contact" },
];

const PRODUCT = [
  { href: "/explore", label: "Explore" },
  { href: "/my-research", label: "My Research" },
  { href: "/saved", label: "Saved Items" },
  { href: "/map", label: "Knowledge Map" },
  { href: "/settings", label: "Account & Privacy" },
];

export function SiteFooter({ version = "1.0" }: { version?: string }) {
  return (
    <footer className="mt-24 border-t border-white/[0.06] bg-ink-950 no-print">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-signal-400 to-aurora-500 text-void">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M12 3v18M5 8l14 8M19 8 5 16" />
                </svg>
              </span>
              <span className="font-semibold text-parchment-100">Lattice</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-parchment-500">
              A knowledge exploration platform. Start with one piece of knowledge and discover the
              research, evidence, cases and perspectives worth exploring next.
            </p>
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-parchment-600">
              <Icon name="shield" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-parchment-500" />
              <span>
                Lattice is a discovery tool. It links to original sources and does not republish
                them. It is not a substitute for professional legal, medical or financial advice.
              </span>
            </p>
          </div>

          <nav aria-labelledby="footer-product">
            <h2 id="footer-product" className="text-xs font-semibold uppercase tracking-[0.16em] text-parchment-400">
              Product
            </h2>
            <ul className="mt-4 space-y-2.5">
              {PRODUCT.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-parchment-500 transition-colors hover:text-parchment-200">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-legal">
            <h2 id="footer-legal" className="text-xs font-semibold uppercase tracking-[0.16em] text-parchment-400">
              Legal & Privacy
            </h2>
            <ul className="mt-4 space-y-2.5">
              {LEGAL.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-parchment-500 transition-colors hover:text-parchment-200">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="hairline my-8" />

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-parchment-600">
          <p>
            © {new Date().getFullYear()} Lattice. Open-source knowledge exploration. Legal documents
            v{version}.
          </p>
          <p className="flex items-center gap-2">
            <Icon name="scale" className="h-3.5 w-3.5" />
            <span>
              Legal pages are templates and require review by qualified counsel for your markets
              before commercial launch.
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
