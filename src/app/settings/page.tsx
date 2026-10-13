import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, Icon } from "@/components/ui";
import { ConsentForm, DeleteAccountForm } from "@/components/account/settings-forms";
import { authBackend, getCurrentUser } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { persistenceMode, runtimeMode, config } from "@/lib/config";
import { aiStatus } from "@/lib/providers/ai";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");

  const [usage, saved, explorations] = await Promise.all([
    getStore().usageSummary(user.id),
    getStore().listSaved(user.id),
    getStore().listExplorations(user.id),
  ]);

  const quota = config.limits.freeAiQuota;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold text-parchment-100">Account & privacy</h1>
      <p className="mt-2 text-sm text-parchment-400">
        Everything we hold about you, and the controls to change or remove it.
      </p>

      <div className="mt-8 space-y-4">
        <Card>
          <h2 className="text-sm font-semibold text-parchment-100">Profile</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Email", user.email],
              ["Account created", new Date(user.createdAt).toLocaleString()],
              ["Plan", user.plan],
              ["Account status", user.status],
              ["Consent", user.consentStatus],
              ["Auth backend", authBackend()],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[0.68rem] uppercase tracking-wide text-parchment-500">{k}</dt>
                <dd className="mt-0.5 text-sm text-parchment-200">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[0.72rem] leading-relaxed text-parchment-500">
            We do not store your name, phone number, precise location, date of birth or contacts.
          </p>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-parchment-100">Usage</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              { label: "Explorations", value: usage.explorations },
              { label: "Source searches", value: usage.searchCalls },
              { label: "Saved items", value: saved.length },
              { label: "Recorded sessions", value: explorations.length },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-[0.68rem] uppercase tracking-wide text-parchment-500">{s.label}</p>
                <p className="mt-1 text-xl font-semibold text-parchment-100">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-parchment-300">Deep AI operations</span>
              <Badge tone={aiStatus().enabled ? "signal" : "outline"}>
                {aiStatus().enabled ? `${usage.aiCalls} / ${quota}` : "AI disabled"}
              </Badge>
            </div>
            <p className="mt-2 text-[0.72rem] leading-relaxed text-parchment-500">
              {aiStatus().enabled
                ? `You have ${Math.max(0, quota - usage.aiCalls)} deep AI operation(s) remaining this month. Basic exploration is unlimited and always free.`
                : "AI synthesis is disabled on this deployment. Every feature you have used so far ran without any AI provider."}
            </p>
          </div>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-parchment-100">Consent & communications</h2>
          <div className="mt-3">
            <ConsentForm marketingOptIn={user.marketingOptIn} />
          </div>
        </Card>

        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-parchment-100">
            <Icon name="shield" className="h-4 w-4 text-parchment-400" /> Data & privacy
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-parchment-400">
            <li>
              · Your uploaded documents are private to your account and are never publicly accessible.
            </li>
            <li>
              · Runtime mode: <span className="text-parchment-200">{runtimeMode()}</span>; storage:{" "}
              <span className="text-parchment-200">{persistenceMode()}</span>.
            </li>
            <li>
              · {aiStatus().enabled
                ? "AI synthesis is enabled; only relevant excerpts — never whole documents — are sent to the configured provider."
                : "No content is sent to any AI provider, because AI is disabled on this deployment."}
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/legal/privacy" className="text-xs text-signal-300 hover:text-signal-200">Privacy Policy →</Link>
            <Link href="/legal/privacy-request" className="text-xs text-signal-300 hover:text-signal-200">Submit a privacy request →</Link>
            <Link href="/legal/copyright" className="text-xs text-signal-300 hover:text-signal-200">Copyright policy →</Link>
          </div>
        </Card>

        <Card className="border-rose-500/20">
          <h2 className="text-sm font-semibold text-rose-300">Delete account</h2>
          <div className="mt-3">
            <DeleteAccountForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
