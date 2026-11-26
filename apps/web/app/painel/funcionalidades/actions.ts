"use server";

import { revalidatePath } from "next/cache";
import type { FeatureKey, FeatureMode } from "@kandokids/shared";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function updateFeature(input: { key: FeatureKey; mode: FeatureMode; priceKz: number | null }) {
  const session = await requireManager();
  if (!session.canAdmin) return { error: "Apenas o administrador da empresa pode alterar funcionalidades." };

  if (input.mode === "addon" && (input.priceKz === null || !Number.isFinite(input.priceKz) || input.priceKz < 0)) {
    return { error: "Indique o preço mensal do extra em kwanzas." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_features")
    .update({
      mode: input.mode,
      ...(input.mode === "addon" ? { addon_price_kz: Math.round(input.priceKz!) } : {}),
    })
    .eq("company_id", session.companyId)
    .eq("feature_key", input.key)
    .select("feature_key");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Sem permissão para alterar esta funcionalidade." };

  revalidatePath("/painel/funcionalidades");
  return { ok: true as const };
}
