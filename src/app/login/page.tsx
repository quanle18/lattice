import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { Card, Icon } from "@/components/ui";
import { authBackend, getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect("/explore");

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="mb-6 text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-signal-400 to-aurora-500 text-void">
          <Icon name="user" className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold text-parchment-100">Welcome back</h1>
        <p className="mt-2 text-sm text-parchment-400">Log in to save research and keep your explorations.</p>
      </div>

      <Card>
        <AuthForm mode="login" />
      </Card>

      <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-parchment-600">
        Authentication backend: <span className="text-parchment-400">{authBackend()}</span>.
        {authBackend() === "builtin"
          ? " The built-in backend uses scrypt password hashing and httpOnly session cookies. Configure Supabase Auth for managed credentials."
          : " Credentials are managed by Supabase Auth; Lattice never handles your password."}
      </p>
    </div>
  );
}
