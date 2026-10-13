import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, Icon } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/explore");

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-signal-400 to-aurora-500 text-void">
          <Icon name="sparkle" className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-parchment-100">Create your account</h1>
        <p className="mt-2 text-sm text-parchment-400">
          We collect only your email. No name, phone number, location or date of birth.
        </p>
      </div>

      <Card>
        <AuthForm mode="signup" />
      </Card>

      <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-parchment-600">
        By creating an account you can delete it at any time from Settings. Uploaded documents are
        private to your account and are removed when you delete your account.
      </p>
    </div>
  );
}
