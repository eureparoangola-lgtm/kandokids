"use server";

import { revalidatePath } from "next/cache";
import type { FeatureKey } from "@kandokids/shared";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function updateFeature(input: { key: FeatureKey; mode: "off" | "included" }) {
  const session = await requireManager();
  if (!session.canAdmin) return { error: "Apenas o administrador da empresa pode alterar funcionalidades." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("company_features").update({ mode: input.mode })
    .eq("company_id", session.companyId).eq("feature_key", input.key).select("feature_key");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "Sem permissão para alterar esta funcionalidade." };
  revalidatePath("/painel/funcionalidades");
  return { ok: true as const };
}
