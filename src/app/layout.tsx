import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site/nav";
import { SiteFooter } from "@/components/site/footer";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { runtimeMode, persistenceMode, config } from "@/lib/config";

export const metadata: Metadata = {
  title: {
    default: "Lattice — One idea. A world of connections.",
    template: "%s · Lattice",
  },
  description:
    "Explore any subject, connect ideas across disciplines, and discover the research, evidence, cases and perspectives worth exploring next.",
  applicationName: "Lattice",
  metadataBase: new URL(config.siteUrl),
  openGraph: {
    title: "Lattice — One idea. A world of connections.",
    description:
      "A knowledge exploration platform: start with one piece of knowledge and discover what to explore next.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07080c",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The nav needs auth state; this is a server read of an httpOnly cookie.
  const user = await getCurrentUser().catch(() => null);
  const mode = runtimeMode();

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-dvh flex-col bg-void">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-signal-500 focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        <SiteNav email={user?.email ?? null} isAdmin={isAdmin(user)} mode={mode} />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        {persistenceMode() === "local-json" ? (
          <div className="border-t border-amber-500/20 bg-amber-500/[0.06] px-4 py-2 text-center text-[0.7rem] text-amber-400/90 no-print">
            Storage: local JSON (single instance). Configure Supabase for durable, serverless-safe persistence.
          </div>
        ) : null}
      </body>
    </html>
  );
}
