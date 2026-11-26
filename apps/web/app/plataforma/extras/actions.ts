"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function activateAddon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_addon", {
    p_addon_id: String(formData.get("addon_id")),
    p_months: Number(formData.get("months") ?? 1),
    p_payment_reference: String(formData.get("reference") ?? "").trim() || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/plataforma", "layout");
  return { ok: "Extra ativado." };
}

export async function rejectAddon(formData: FormData) {
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.from("guardian_addons").update({ status: "cancelled" }).eq("id", String(formData.get("addon_id")));
  revalidatePath("/plataforma", "layout");
}

/** Preço e modo de um extra para todas as empresas (exceto as bloqueadas individualmente). */
export async function saveExtra(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePlatformAdmin();
  const key = String(formData.get("key"));
  const mode = String(formData.get("mode"));
  const price = Number(formData.get("price"));
  if (mode === "addon" && !(price > 0)) return { error: "Indique o preço mensal." };
  const supabase = await createClient();
  const { error } = await supabase.from("features").update({ default_mode: mode, addon_price_kz: price || null }).eq("key", key);
  if (error) return { error: error.message };
  const { error: e2 } = await supabase.from("company_features").update({ mode }).eq("feature_key", key).eq("locked_by_platform", false);
  if (e2) return { error: e2.message };
  revalidatePath("/plataforma", "layout");
  return { ok: "Guardado para todas as empresas." };
}
