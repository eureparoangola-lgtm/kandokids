import { redirect } from "next/navigation";
import type { AppRole } from "@kandokids/shared";
import { createClient } from "@/lib/supabase/server";

export const MANAGER_ROLES: AppRole[] = ["platform_admin", "company_admin", "dispatcher"];

export interface StaffSession {
  userId: string;
  fullName: string;
  role: AppRole;
  companyId: string;
  companyName: string;
  canAdmin: boolean; // funcionalidades, preços, extras
}

/** Garante que o utilizador é gestor de uma empresa; senão redireciona. */
export async function requireManager(): Promise<StaffSession> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id")
    .eq("id", auth.user.id)
    .single();

  if (!profile || !MANAGER_ROLES.includes(profile.role)) redirect("/login?erro=sem-acesso");

  // A equipa Kandokids não pertence a uma empresa: usa a primeira (seletor virá depois).
  const companyQuery = supabase.from("companies").select("id, name").order("name").limit(1);
  const { data: company } = profile.company_id
    ? await supabase.from("companies").select("id, name").eq("id", profile.company_id).single()
    : await companyQuery.single();

  if (!company) redirect("/login?erro=sem-empresa");

  return {
    userId: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    companyId: company.id,
    companyName: company.name,
    canAdmin: profile.role === "company_admin" || profile.role === "platform_admin",
  };
}
