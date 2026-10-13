"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteAccount, signIn, signOut, signUp } from "@/lib/auth";
import { getStore } from "@/lib/store";

export interface ActionState {
  error?: string;
  ok?: boolean;
}

export async function signUpAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    marketingOptIn: formData.get("marketing") === "on",
    acceptTerms: formData.get("terms") === "on",
  });
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  redirect("/explore");
}

export async function signInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const result = await signIn(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  redirect("/explore");
}

export async function signOutAction(): Promise<void> {
  await signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  if (formData.get("confirm") !== "DELETE") {
    return { error: 'Type DELETE exactly to confirm.' };
  }
  const result = await deleteAccount();
  if (!result.ok) return { error: result.error };
  revalidatePath("/", "layout");
  redirect("/");
}

export async function adminSuspendUserAction(formData: FormData): Promise<void> {
  const { getCurrentUser, isAdmin } = await import("@/lib/auth");
  const actor = await getCurrentUser();
  if (!isAdmin(actor)) return;
  const id = String(formData.get("userId") ?? "");
  const status = formData.get("status") === "suspended" ? "suspended" : "active";
  if (!id) return;
  await getStore().updateUser(id, { status: status as "active" | "suspended" });
  revalidatePath("/admin");
}

export async function adminUpdatePrivacyAction(formData: FormData): Promise<void> {
  const { getCurrentUser, isAdmin } = await import("@/lib/auth");
  const actor = await getCurrentUser();
  if (!isAdmin(actor)) return;
  const id = String(formData.get("requestId") ?? "");
  const status = String(formData.get("status") ?? "REQUESTED") as
    | "REQUESTED" | "UNDER REVIEW" | "PROCESSING" | "COMPLETED";
  if (!id) return;
  await getStore().updatePrivacyRequestStatus(id, status);
  revalidatePath("/admin");
}

export async function updateConsentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { getCurrentUser } = await import("@/lib/auth");
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in." };
  await getStore().updateUser(user.id, { marketingOptIn: formData.get("marketing") === "on" });
  revalidatePath("/settings");
  return { ok: true };
}
