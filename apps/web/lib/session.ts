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
  plan: { isPro: boolean; maxVehicles: number | null; maxStudents: number | null };
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

  if (profile?.role === "platform_admin") redirect("/plataforma");
  if (!profile || !MANAGER_ROLES.includes(profile.role)) redirect("/login?erro=sem-acesso");

  const { data: company } = await supabase.from("companies").select("id, name, license_status")
    .eq("id", profile.company_id).single();
  if (!company) redirect("/login?erro=sem-empresa");
  if (company.license_status === "suspended") redirect("/suspensa");

  const { data: limits } = await supabase.rpc("company_limits", { p_company_id: company.id }).single<{
    max_vehicles: number | null; max_students: number | null; is_pro: boolean }>();

  return {
    userId: profile.id,
    fullName: profile.full_name,
    role: profile.role,
    companyId: company.id,
    companyName: company.name,
    canAdmin: profile.role === "company_admin" || profile.role === "platform_admin",
    plan: { isPro: Boolean(limits?.is_pro), maxVehicles: limits?.max_vehicles ?? null, maxStudents: limits?.max_students ?? null },
  };
}

export interface PlatformSession { userId: string; fullName: string }

/** Equipa Kandokids (painel da plataforma). */
export async function requirePlatformAdmin(): Promise<PlatformSession> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login?next=/plataforma");
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", auth.user.id).single();
  if (profile?.role !== "platform_admin") redirect("/painel");
  return { userId: profile.id, fullName: profile.full_name };
}
