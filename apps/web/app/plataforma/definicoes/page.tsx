import { revalidatePath } from "next/cache";
import { ActionForm, inputClass, labelClass, type ActionState } from "@/components/action-form";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const KEYS = ["payment_instructions", "support_phone", "support_whatsapp"] as const;

async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert(
    KEYS.map((key) => ({ key, value: String(formData.get(key) ?? "").trim(), updated_at: new Date().toISOString() })));
  if (error) return { error: error.message };
  revalidatePath("/plataforma/definicoes");
  return { ok: "Definições guardadas." };
}

export default async function SettingsPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("platform_settings").select("key, value");
  const v = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Definições</h1>
        <p className="mt-1 text-slate-600">Informação mostrada aos encarregados e às empresas.</p>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <ActionForm action={saveSettings} submitLabel="Guardar" className="space-y-4">
          <label className={labelClass}>Instruções de pagamento dos extras (aparecem na app dos pais)
            <textarea name="payment_instructions" rows={4} defaultValue={v.payment_instructions} className={inputClass}
              placeholder="ex.: Pague por Multicaixa Express para o número 9XX XXX XXX (Kandokids) e envie o comprovativo por WhatsApp." />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Telefone de apoio<input name="support_phone" type="tel" defaultValue={v.support_phone} className={inputClass} placeholder="+244 9XX XXX XXX" /></label>
            <label className={labelClass}>WhatsApp de apoio<input name="support_whatsapp" type="tel" defaultValue={v.support_whatsapp} className={inputClass} placeholder="+244 9XX XXX XXX" /></label>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
