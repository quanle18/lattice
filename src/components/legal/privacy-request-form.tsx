"use client";

import { useState } from "react";
import { Button, Card, Icon } from "@/components/ui";

const TYPES = [
  { id: "access", label: "Access my data" },
  { id: "correction", label: "Correct my data" },
  { id: "deletion", label: "Delete my data" },
  { id: "closure", label: "Close my account" },
  { id: "question", label: "Ask a privacy question" },
];

export function PrivacyRequestForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const [type, setType] = useState("access");
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/privacy-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type, message }),
      });
      const data = (await res.json()) as { request?: { id: string }; error?: string };
      if (!res.ok || !data.request) {
        setError(data.error ?? "Could not submit the request.");
        setState("error");
        return;
      }
      setRequestId(data.request.id);
      setState("done");
    } catch {
      setError("Could not reach the server.");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <Card className="border-aurora-500/25 bg-aurora-500/[0.05]">
        <div className="flex items-start gap-3">
          <Icon name="check" className="mt-0.5 h-5 w-5 shrink-0 text-aurora-400" />
          <div>
            <h2 className="text-sm font-semibold text-parchment-100">Request received</h2>
            <p className="mt-2 text-sm leading-relaxed text-parchment-400">
              Your request has been logged with status <span className="text-parchment-200">REQUESTED</span>.
              You can delete your account immediately from Settings if you prefer not to wait.
            </p>
            {requestId ? (
              <p className="mt-2 font-mono text-xs text-parchment-500">Reference: {requestId}</p>
            ) : null}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label htmlFor="pr-email" className="mb-1.5 block text-xs font-medium text-parchment-300">
          Your email
        </label>
        <input
          id="pr-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 w-full rounded-lg border border-white/10 bg-ink-900 px-3.5 text-sm text-parchment-100 focus:border-signal-500/50 focus:outline-none"
          placeholder="you@example.com"
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-xs font-medium text-parchment-300">Request type</legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setType(t.id)}
              aria-pressed={type === t.id}
              className={
                type === t.id
                  ? "rounded-full border border-signal-400/40 bg-signal-500/15 px-3.5 py-1.5 text-xs text-signal-200"
                  : "rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-parchment-400 hover:border-white/20"
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="pr-message" className="mb-1.5 block text-xs font-medium text-parchment-300">
          Details <span className="text-parchment-600">(optional)</span>
        </label>
        <textarea
          id="pr-message"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full resize-y rounded-lg border border-white/10 bg-ink-900 p-3.5 text-sm text-parchment-100 focus:border-signal-500/50 focus:outline-none"
          placeholder="Anything that helps us identify and process your request."
        />
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-rose-500/25 bg-rose-500/[0.07] px-3 py-2 text-xs text-rose-400">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
