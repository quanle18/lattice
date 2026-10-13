"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, type ActionState } from "@/app/actions";
import { Button, Icon } from "@/components/ui";

const initial: ActionState = {};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initial);

  return (
    <form action={formAction} className="space-y-4">
      {state.error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2.5">
          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
          <p className="text-xs text-rose-400">{state.error}</p>
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-parchment-300">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="h-11 w-full rounded-lg border border-white/10 bg-ink-900 px-3.5 text-sm text-parchment-100 placeholder:text-parchment-600 focus:border-signal-500/50 focus:outline-none focus:ring-2 focus:ring-signal-500/20"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-parchment-300">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="h-11 w-full rounded-lg border border-white/10 bg-ink-900 px-3.5 text-sm text-parchment-100 placeholder:text-parchment-600 focus:border-signal-500/50 focus:outline-none focus:ring-2 focus:ring-signal-500/20"
          placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
        />
      </div>

      {mode === "signup" ? (
        <div className="space-y-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5">
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-parchment-400">
            <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-ink-900 accent-signal-500" />
            <span>
              I agree to the{" "}
              <Link href="/legal/terms" className="text-signal-300 hover:text-signal-200">Terms of Service</Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="text-signal-300 hover:text-signal-200">Privacy Policy</Link>. (Required)
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-parchment-400">
            <input type="checkbox" name="marketing" className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-ink-900 accent-signal-500" />
            <span>Send me occasional product updates. (Optional — never required to create an account.)</span>
          </label>
        </div>
      ) : null}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </Button>

      <p className="text-center text-xs text-parchment-500">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href="/signup" className="text-signal-300 hover:text-signal-200">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-signal-300 hover:text-signal-200">Log in</Link>
          </>
        )}
      </p>
    </form>
  );
}
