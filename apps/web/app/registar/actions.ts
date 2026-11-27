"use server";

import { redirect } from "next/navigation";
import { siteOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export type RegisterState = { error?: string; checkEmail?: string; values?: Record<string, string> } | undefined;

export async function registerCompany(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const v = Object.fromEntries(["name", "email", "company", "phone", "nif"].map((k) => [k, String(formData.get(k) ?? "").trim()]));
  const password = String(formData.get("password") ?? "");
  if (!v.name || !v.email || !v.company || !v.phone) return { error: "Preencha todos os campos obrigatórios.", values: v };
  if (password.length < 8) return { error: "A palavra-passe deve ter pelo menos 8 caracteres.", values: v };

  const supabase = await createClient();
  const pending = { name: v.company, phone: v.phone, nif: v.nif || undefined };
  const { data, error } = await supabase.auth.signUp({
    email: v.email,
    password,
    options: {
      data: { full_name: v.name, phone: v.phone, pending_company: pending },
      emailRedirectTo: `${await siteOrigin()}/login?confirmado=1`,
    },
  });
  if (error) {
    return { error: /registered|already/i.test(error.message) ? "Já existe uma conta com este email. Entre com ela." : error.message, values: v };
  }

  // Sem confirmação de email: a sessão já existe e criamos a empresa agora.
  if (data.session) {
    const { error: rpcError } = await supabase.rpc("register_company", { p_name: pending.name, p_phone: pending.phone, p_nif: pending.nif ?? null });
    if (rpcError) return { error: rpcError.message, values: v };
    await supabase.auth.updateUser({ data: { pending_company: null } });
    redirect("/painel?bemvindo=1");
  }
  return { checkEmail: v.email };
}
