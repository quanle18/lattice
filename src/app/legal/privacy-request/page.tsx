import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { PrivacyRequestForm } from "@/components/legal/privacy-request-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Privacy Request" };

export default async function PrivacyRequestPage() {
  const user = await getCurrentUser().catch(() => null);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold text-parchment-100">Data deletion & privacy request</h1>
      <p className="mt-3 text-sm leading-relaxed text-parchment-400">
        Use this form to request access to, correction of, or deletion of your personal data, or to ask
        a privacy question. Requests are tracked through a defined workflow.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-[0.7rem] text-parchment-500">
        {["REQUESTED", "UNDER REVIEW", "PROCESSING", "COMPLETED"].map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span className="rounded-full border border-white/10 px-2.5 py-1">{s}</span>
            {i < 3 ? <span aria-hidden="true">→</span> : null}
          </span>
        ))}
      </div>

      <Card className="mt-8">
        <PrivacyRequestForm defaultEmail={user?.email ?? ""} />
      </Card>

      <p className="mt-6 text-xs leading-relaxed text-parchment-600">
        If you are signed in, you can delete your account immediately from Settings — that removes your
        profile, saved items, exploration history and uploaded material without waiting for a manual
        review.
      </p>
    </div>
  );
}
