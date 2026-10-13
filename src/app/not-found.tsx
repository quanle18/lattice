import Link from "next/link";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
      <p className="font-mono text-sm text-parchment-600">404</p>
      <h1 className="mt-3 text-2xl font-semibold text-parchment-100">This page does not exist</h1>
      <p className="mt-3 text-sm leading-relaxed text-parchment-400">
        The page you were looking for could not be found. It may have moved, or the link may be
        incorrect.
      </p>
      <div className="mt-6 flex gap-3">
        <LinkButton href="/explore">Start exploring</LinkButton>
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-xl border border-white/12 px-5 text-sm text-parchment-200 hover:bg-white/5"
        >
          Back home
        </Link>
      </div>
    </div>
  );
}
