"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_prev: { error?: string; email?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/painel");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email ou palavra-passe incorretos.", email };

  // Registo feito com confirmação de email: a empresa é criada no primeiro login.
  const pending = data.user?.user_metadata?.pending_company as { name: string; phone: string; nif?: string } | undefined;
  if (pending) {
    const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", data.user!.id).single();
    if (!profile?.company_id) {
      await supabase.rpc("register_company", { p_name: pending.name, p_phone: pending.phone, p_nif: pending.nif ?? null });
    }
    await supabase.auth.updateUser({ data: { pending_company: null } });
  }

  redirect(next.startsWith("/painel") ? next : "/painel");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
