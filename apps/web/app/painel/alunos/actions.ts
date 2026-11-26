"use server";

import { revalidatePath } from "next/cache";
import type { StudentImportRow } from "@kandokids/shared";
import type { ActionState } from "@/components/action-form";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type ImportResult = { error?: string; created?: { student_id: string; full_name: string; guardian_name: string | null; guardian_phone: string | null; invite_code: string | null }[] };

export async function importStudents(rows: StudentImportRow[], routeId: string | null): Promise<ImportResult> {
  const session = await requireManager();
  if (!rows.length) return { error: "O ficheiro não tem alunos." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_students", { p_company_id: session.companyId, p_rows: rows, p_route_id: routeId });
  if (error) return { error: error.message };
  revalidatePath("/painel", "layout");
  return { created: data };
}

export async function addStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  if (!get("full_name")) return { error: "Indique o nome do aluno." };
  const result = await importStudents(
    [{ full_name: get("full_name"), grade: get("grade"), school_name: get("school_name"), home_address: get("home_address"),
       guardian_name: get("guardian_name"), guardian_phone: get("guardian_phone"), relationship: get("relationship") }],
    get("route_id") || null,
  );
  if (result.error) return { error: result.error };
  return { ok: `${get("full_name")} adicionado(a).${get("guardian_phone") ? " Envie o convite ao encarregado na lista acima." : ""}` };
}

export async function newInvite(formData: FormData) {
  const session = await requireManager();
  const supabase = await createClient();
  const phone = String(formData.get("phone") ?? "").replace(/[^0-9+]/g, "");
  if (!phone) return;
  await supabase.from("guardian_invites").insert({
    company_id: session.companyId, student_id: String(formData.get("student_id")), phone, created_by: session.userId,
  });
  revalidatePath("/painel/alunos");
}
