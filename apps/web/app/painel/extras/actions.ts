"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function activateAddon(_prev: { error?: string; ok?: boolean } | undefined, formData: FormData) {
  const session = await requireManager();
  if (!session.canAdmin) return { error: "Apenas o administrador pode confirmar pagamentos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("activate_addon", {
    p_addon_id: String(formData.get("addon_id")),
    p_months: Number(formData.get("months") ?? 1),
    p_payment_reference: String(formData.get("reference") ?? "").trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/painel", "layout");
  return { ok: true };
}

export async function cancelAddon(formData: FormData) {
  const session = await requireManager();
  if (!session.canAdmin) return;
  const supabase = await createClient();
  await supabase.from("guardian_addons").update({ status: "cancelled" })
    .eq("id", String(formData.get("addon_id"))).eq("company_id", session.companyId);
  revalidatePath("/painel", "layout");
}
