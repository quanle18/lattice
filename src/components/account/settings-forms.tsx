"use client";

import { useActionState } from "react";
import { deleteAccountAction, updateConsentAction, type ActionState } from "@/app/actions";
import { Button, Card, Icon } from "@/components/ui";

const initial: ActionState = {};

export function ConsentForm({ marketingOptIn }: { marketingOptIn: boolean }) {
  const [state, action, pending] = useActionState(updateConsentAction, initial);
  return (
    <form action={action} className="space-y-4">
      <label className="flex items-start gap-3 text-sm leading-relaxed text-parchment-300">
        <input
          type="checkbox"
          name="marketing"
          defaultChecked={marketingOptIn}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-ink-900 accent-signal-500"
        />
        <span>
          Send me occasional product updates.
          <span className="mt-1 block text-xs text-parchment-500">
            Optional. Turning this off never affects your access to the service.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save preferences"}
        </Button>
        {state.ok ? <span className="text-xs text-aurora-400">Saved.</span> : null}
        {state.error ? <span className="text-xs text-rose-400">{state.error}</span> : null}
      </div>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccountAction, initial);
  return (
    <form action={action} className="space-y-4">
      <div className="rounded-lg border border-rose-500/25 bg-rose-500/[0.05] p-3.5">
        <p className="text-xs leading-relaxed text-parchment-300">
          Deleting your account permanently removes your profile, saved items, exploration history and
          uploaded documents. This cannot be undone. Items you have not saved are removed immediately;
          nothing is retained beyond what a legal or security obligation requires.
        </p>
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-xs font-medium text-parchment-300">
          Type <span className="font-mono text-rose-400">DELETE</span> to confirm
        </label>
        <input
          id="confirm"
          name="confirm"
          className="h-10 w-full max-w-xs rounded-lg border border-white/10 bg-ink-900 px-3 text-sm text-parchment-100 focus:border-rose-500/50 focus:outline-none"
          placeholder="DELETE"
          autoComplete="off"
        />
      </div>
      {state.error ? <p className="text-xs text-rose-400">{state.error}</p> : null}
      <Button type="submit" variant="danger" size="sm" disabled={pending}>
        <Icon name="alert" className="h-3.5 w-3.5" />
        {pending ? "Deleting…" : "Delete my account"}
      </Button>
    </form>
  );
}

export function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="text-sm font-semibold text-parchment-100">{title}</h2>
      <div className="mt-3">{children}</div>
    </Card>
  );
}
