"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/components/action-form";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const val = (f: FormData, k: string) => String(f.get(k) ?? "").trim() || null;

export async function saveRoute(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireManager();
  const supabase = await createClient();
  const id = val(formData, "id");
  const name = val(formData, "name");
  if (!name) return { error: "Indique o nome da rota." };
  const weekdays = formData.getAll("weekdays").map(Number);
  const route = {
    company_id: session.companyId,
    name,
    direction: val(formData, "direction") ?? "to_school",
    scheduled_time: val(formData, "scheduled_time"),
    school_id: val(formData, "school_id"),
    default_vehicle_id: val(formData, "vehicle_id"),
    default_assistant_id: val(formData, "assistant_id"),
    default_driver_id: val(formData, "driver_id"),
    weekdays: weekdays.length ? weekdays : [1, 2, 3, 4, 5],
  };
  const { data, error } = id
    ? await supabase.from("routes").update(route).eq("id", id).select("id").single()
    : await supabase.from("routes").insert(route).select("id").single();
  if (error) return { error: error.message };

  // Alunos da rota (ordem = ordem de seleção na lista)
  const students = formData.getAll("students").map(String);
  await supabase.from("route_stops").delete().eq("route_id", data.id);
  if (students.length) {
    const { error: e2 } = await supabase.from("route_stops").insert(students.map((student_id, i) => ({ route_id: data.id, student_id, position: i + 1 })));
    if (e2) return { error: e2.message };
  }
  revalidatePath("/painel", "layout");
  return { ok: id ? "Rota guardada." : "Rota criada." };
}

export async function generateToday(_prev: ActionState): Promise<ActionState> {
  const session = await requireManager();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_trips", { p_company_id: session.companyId });
  if (error) return { error: error.message };
  revalidatePath("/painel", "layout");
  return { ok: data === 0 ? "As viagens de hoje já existiam (ou nenhuma rota circula hoje)." : `${data} viagem(ns) criada(s) para hoje.` };
}
