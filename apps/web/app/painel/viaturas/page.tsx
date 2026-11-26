import { revalidatePath } from "next/cache";
import { ActionForm, inputClass, labelClass, type ActionState } from "@/components/action-form";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

async function addVehicle(_prev: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  const session = await requireManager();
  const plate = String(formData.get("plate") ?? "").trim().toUpperCase();
  if (!plate) return { error: "Indique a matrícula." };
  const supabase = await createClient();
  const { error } = await supabase.from("vehicles").insert({
    company_id: session.companyId,
    plate,
    nickname: String(formData.get("nickname") ?? "").trim() || null,
    model: String(formData.get("model") ?? "").trim() || null,
    color: String(formData.get("color") ?? "").trim() || null,
    capacity: Number(formData.get("capacity") || 15),
  });
  if (error) return { error: error.code === "23505" ? "Já existe uma viatura com esta matrícula." : error.message };
  revalidatePath("/painel", "layout");
  return { ok: `Viatura ${plate} adicionada.` };
}

async function toggleVehicle(formData: FormData) {
  "use server";
  await requireManager();
  const supabase = await createClient();
  await supabase.from("vehicles").update({ active: formData.get("active") === "true" }).eq("id", String(formData.get("id")));
  revalidatePath("/painel", "layout");
}

type Vehicle = { id: string; plate: string; nickname: string | null; model: string | null; color: string | null; capacity: number; active: boolean };

export default async function VehiclesPage() {
  const session = await requireManager();
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select("id, plate, nickname, model, color, capacity, active")
    .eq("company_id", session.companyId).order("active", { ascending: false }).order("plate").returns<Vehicle[]>();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Viaturas</h1>
        <p className="mt-1 text-slate-600">As viaturas aparecem aos pais com o nome e a matrícula, para saberem exatamente em que carro está o filho.</p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {(data ?? []).length === 0 && <p className="p-6 text-sm text-slate-500">Ainda não tem viaturas. Adicione a primeira abaixo.</p>}
        <ul className="divide-y divide-slate-100">
          {(data ?? []).map((v) => (
            <li key={v.id} className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${v.active ? "" : "opacity-50"}`}>
              <div>
                <p className="font-semibold">{v.nickname ?? v.plate} <span className="font-normal text-slate-500">· {v.plate}</span></p>
                <p className="text-sm text-slate-500">{[v.model, v.color, `${v.capacity} lugares`].filter(Boolean).join(" · ")}</p>
              </div>
              <form action={toggleVehicle}>
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="active" value={String(!v.active)} />
                <button className="text-sm text-slate-500 underline-offset-4 hover:text-ink-900 hover:underline">{v.active ? "Desativar" : "Reativar"}</button>
              </form>
            </li>
          ))}
        </ul>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-ink-900">Adicionar viatura</h2>
        <ActionForm action={addVehicle} submitLabel="Adicionar viatura" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Matrícula *<input name="plate" required className={inputClass} placeholder="LD-00-00-AA" /></label>
            <label className={labelClass}>Nome (como os pais a conhecem)<input name="nickname" className={inputClass} placeholder="ex.: Autocarro Azul" /></label>
            <label className={labelClass}>Modelo<input name="model" className={inputClass} placeholder="ex.: Toyota Hiace" /></label>
            <label className={labelClass}>Cor<input name="color" className={inputClass} /></label>
            <label className={labelClass}>Lugares<input name="capacity" type="number" min={1} defaultValue={15} className={inputClass} /></label>
          </div>
        </ActionForm>
        {!session.plan.isPro && <p className="mt-3 text-xs text-slate-500">Plano gratuito: 1 viatura ativa.</p>}
      </section>
    </div>
  );
}
