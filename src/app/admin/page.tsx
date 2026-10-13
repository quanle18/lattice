import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminSuspendUserAction, adminUpdatePrivacyAction } from "@/app/actions";
import { Badge, Card, Icon } from "@/components/ui";
import { getCurrentUser, isAdmin } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { libraryStats } from "@/lib/kb/repository";
import { providerSummary } from "@/lib/providers/registry";
import { internalMetrics } from "@/lib/limits";
import { aiStatus } from "@/lib/providers/ai";

export const metadata: Metadata = { title: "Admin" };

const PRIVACY_STATUSES = ["REQUESTED", "UNDER REVIEW", "PROCESSING", "COMPLETED"] as const;

export default async function AdminPage() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect("/login");
  if (!isAdmin(user)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6">
        <Icon name="shield" className="mx-auto h-8 w-8 text-parchment-500" />
        <h1 className="mt-4 text-xl font-semibold text-parchment-100">Admin access required</h1>
        <p className="mt-2 text-sm text-parchment-400">
          Your account is not listed in ADMIN_EMAILS. Admin access is separate from normal user
          permissions and is granted by configuration only.
        </p>
      </div>
    );
  }

  const store = getStore();
  const [users, privacyRequests] = await Promise.all([store.listUsers(), store.listPrivacyRequests()]);
  const stats = libraryStats();
  const providers = providerSummary();
  const metrics = internalMetrics();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-parchment-100">Admin</h1>
        <p className="mt-2 text-sm text-parchment-400">
          Knowledge-base status, source providers, accounts and privacy requests.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <h2 className="text-sm font-semibold text-parchment-100">Knowledge base</h2>
          <dl className="mt-4 space-y-2.5">
            {[
              ["Sources", stats.sources],
              ["Cases", stats.cases],
              ["Ideas", stats.ideas],
              ["Perspectives", stats.perspectives],
              ["Indexed concepts", stats.concepts],
              ["Demonstration records", stats.synthetic],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-between gap-3">
                <dt className="text-xs text-parchment-500">{k}</dt>
                <dd className="text-sm text-parchment-200">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-parchment-100">Source providers</h2>
          <ul className="mt-4 space-y-2">
            {providers.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-xs text-parchment-300">{p.label}</span>
                <Badge tone={p.enabled ? (p.keyless ? "aurora" : "signal") : "outline"}>
                  {p.enabled ? (p.keyless ? "free" : "keyed") : "off"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-parchment-100">Cost & performance</h2>
          <dl className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-parchment-500">AI enabled</dt>
              <dd className="text-sm text-parchment-200">{aiStatus().enabled ? "yes" : "no"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-parchment-500">Cache hit rate</dt>
              <dd className="text-sm text-parchment-200">{(metrics.cache.hitRate * 100).toFixed(0)}%</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-parchment-500">Cache entries</dt>
              <dd className="text-sm text-parchment-200">{metrics.cache.size}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-parchment-500">Cost per exploration</dt>
              <dd className="text-sm text-aurora-400">$0.0000</dd>
            </div>
          </dl>
          <p className="mt-3 text-[0.68rem] leading-relaxed text-parchment-500">
            Deterministic exploration has no marginal cost by construction. Only enabled AI operations
            would carry cost.
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-parchment-100">Accounts ({users.length})</h2>
        {users.length === 0 ? (
          <p className="mt-3 text-sm text-parchment-500">No accounts yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-[0.68rem] uppercase tracking-wide text-parchment-500">
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Created</th>
                  <th className="py-2 pr-4 font-medium">Plan</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.04]">
                    <td className="py-2.5 pr-4 text-parchment-200">{u.email}</td>
                    <td className="py-2.5 pr-4 text-parchment-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5 pr-4 text-parchment-400">{u.plan}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={u.status === "active" ? "aurora" : "rose"}>{u.status}</Badge>
                    </td>
                    <td className="py-2.5">
                      <form action={adminSuspendUserAction}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input type="hidden" name="status" value={u.status === "active" ? "suspended" : "active"} />
                        <button type="submit" className="text-xs text-signal-300 hover:text-signal-200">
                          {u.status === "active" ? "Suspend" : "Reactivate"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[0.68rem] text-parchment-600">
          Private user documents are never exposed here. Admin access is separate from user permissions
          and is granted by configuration.
        </p>
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold text-parchment-100">Privacy requests ({privacyRequests.length})</h2>
        {privacyRequests.length === 0 ? (
          <p className="mt-3 text-sm text-parchment-500">No requests filed.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {privacyRequests.map((r) => (
              <li key={r.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-parchment-200">{r.email}</p>
                    <p className="mt-0.5 text-[0.7rem] text-parchment-500">
                      {r.type} · {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={r.status === "COMPLETED" ? "aurora" : "amber"}>{r.status}</Badge>
                </div>
                {r.message ? <p className="mt-2 text-xs leading-relaxed text-parchment-400">{r.message}</p> : null}
                <form action={adminUpdatePrivacyAction} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="requestId" value={r.id} />
                  <label className="text-[0.68rem] text-parchment-500" htmlFor={`status-${r.id}`}>
                    Update status
                  </label>
                  <select
                    id={`status-${r.id}`}
                    name="status"
                    defaultValue={r.status}
                    className="rounded-md border border-white/10 bg-ink-900 px-2 py-1 text-xs text-parchment-200"
                  >
                    {PRIVACY_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="text-xs text-signal-300 hover:text-signal-200">
                    Save
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
