"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn, Icon } from "@/components/ui";

const NAV = [
  { href: "/explore", label: "Explore", icon: "compass" as const },
  { href: "/my-research", label: "My Research", icon: "book" as const },
  { href: "/saved", label: "Saved", icon: "bookmark" as const },
  { href: "/map", label: "Knowledge Map", icon: "graph" as const },
  { href: "/settings", label: "Settings", icon: "user" as const },
];

export function SiteNav({
  email,
  isAdmin,
  mode,
}: {
  email: string | null;
  isAdmin: boolean;
  mode: "demo" | "live";
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-void/80 backdrop-blur-xl no-print">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Lattice home">
          <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-signal-400 to-aurora-500 text-void">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M12 3v18M5 8l14 8M19 8 5 16" />
            </svg>
          </span>
          <span className="text-[0.95rem] font-semibold tracking-tight text-parchment-100">Lattice</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-white/[0.07] text-parchment-100" : "text-parchment-400 hover:bg-white/[0.04] hover:text-parchment-200",
                )}
              >
                <Icon name={item.icon} className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          {isAdmin ? (
            <Link href="/admin" className={cn("rounded-lg px-3 py-2 text-sm", pathname.startsWith("/admin") ? "bg-white/[0.07] text-parchment-100" : "text-parchment-400 hover:text-parchment-200")}>
              Admin
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={cn(
              "hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-wide sm:inline-flex",
              mode === "live"
                ? "border-aurora-500/25 bg-aurora-500/10 text-aurora-400"
                : "border-amber-500/25 bg-amber-500/10 text-amber-400",
            )}
            title={
              mode === "live"
                ? "Live mode: external keyless providers are enabled."
                : "Demo mode: internal library only, no external calls."
            }
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-soft" />
            {mode === "live" ? "Live" : "Demo"}
          </span>

          {email ? (
            <form action="/auth/signout" method="post" className="hidden sm:block">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-parchment-300 transition-colors hover:bg-white/5 hover:text-parchment-100"
              >
                <Icon name="logout" className="h-3.5 w-3.5" />
                <span className="max-w-[9rem] truncate">{email}</span>
              </button>
            </form>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-parchment-300 hover:text-parchment-100">
                Log in
              </Link>
              <Link href="/signup" className="rounded-lg bg-signal-500 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-signal-400">
                Sign up
              </Link>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label="Toggle navigation"
            className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-parchment-300 lg:hidden"
          >
            <Icon name={open ? "close" : "layers"} className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open ? (
        <nav id="mobile-nav" className="border-t border-white/[0.06] bg-ink-950 px-4 py-3 lg:hidden" aria-label="Mobile">
          <ul className="grid gap-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-parchment-300 hover:bg-white/5"
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            ))}
            {isAdmin ? (
              <li>
                <Link href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-parchment-300 hover:bg-white/5">
                  Admin
                </Link>
              </li>
            ) : null}
          </ul>
          <div className="mt-3 flex gap-2 border-t border-white/[0.06] pt-3">
            {email ? (
              <form action="/auth/signout" method="post" className="w-full">
                <button type="submit" className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-sm text-parchment-300">
                  Sign out ({email})
                </button>
              </form>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-white/10 px-3 py-2.5 text-center text-sm text-parchment-200">
                  Log in
                </Link>
                <Link href="/signup" onClick={() => setOpen(false)} className="flex-1 rounded-lg bg-signal-500 px-3 py-2.5 text-center text-sm font-medium text-white">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
