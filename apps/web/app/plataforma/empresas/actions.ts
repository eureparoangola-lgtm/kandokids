"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function setStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const suspend = formData.get("suspend") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_set_company_status", {
    p_company_id: String(formData.get("company_id")), p_suspend: suspend,
    p_reason: String(formData.get("reason") ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/plataforma", "layout");
  return { ok: suspend ? "Empresa suspensa." : "Empresa reativada." };
}

export async function setPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const plan = String(formData.get("plan"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_set_company_plan", {
    p_company_id: String(formData.get("company_id")), p_plan: plan,
    p_expires_on: String(formData.get("expires_on") ?? "") || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/plataforma", "layout");
  return { ok: plan === "pro" ? "Plano Pro ativado." : "Passou para o plano gratuito." };
}
