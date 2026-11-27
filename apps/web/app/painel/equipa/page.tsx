import { revalidatePath } from "next/cache";
import { ROLE_LABELS, staffInviteMessage, whatsappLink, type AppRole } from "@kandokids/shared";
import { ActionForm, inputClass, labelClass, type ActionState } from "@/components/action-form";
import { siteOrigin } from "@/lib/origin";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

async function inviteStaff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  const session = await requireManager();
  if (!session.canAdmin) return { error: "Apenas o administrador pode convidar a equipa." };
  const full_name = String(formData.get("full_name") ?? "").trim();
  if (!full_name) return { error: "Indique o nome." };
  const supabase = await createClient();
  const { error } = await supabase.from("staff_invites").insert({
    company_id: session.companyId, created_by: session.userId, full_name,
    phone: String(formData.get("phone") ?? "").replace(/[^0-9+]/g, "") || null,
    role: String(formData.get("role") ?? "assistant"),
  });
  if (error) return { error: error.message };
  revalidatePath("/painel/equipa");
  return { ok: `Convite criado para ${full_name}. Envie-o por WhatsApp na lista acima.` };
}

export default async function TeamPage() {
  const session = await requireManager();
  const supabase = await createClient();
  const origin = await siteOrigin();
  const [{ data: staff }, { data: invites }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, role").eq("company_id", session.companyId).order("full_name"),
    supabase.from("staff_invites").select("id, full_name, phone, role, code, expires_at")
      .eq("company_id", session.companyId).is("accepted_at", null).gt("expires_at", new Date().toISOString()),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Equipa</h1>
        <p className="mt-1 text-slate-600">Assistentes e motoristas usam a app Kandokids no telemóvel. Convide-os com um código.</p>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {(staff ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span><strong>{p.full_name || "—"}</strong> <span className="text-sm text-slate-500">· {p.phone ?? "sem telefone"}</span></span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{ROLE_LABELS[p.role as AppRole]}</span>
            </li>
          ))}
          {(invites ?? []).map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 bg-brand-50/50 px-4 py-3">
              <span><strong>{i.full_name}</strong> <span className="text-sm text-slate-500">· {ROLE_LABELS[i.role as AppRole]} · convite pendente · código <span className="font-mono">{i.code}</span></span></span>
              {i.phone && (
                <a target="_blank" rel="noreferrer" className="rounded-lg bg-green-600 px-3 py-1 text-sm font-semibold text-white hover:bg-green-700"
                  href={whatsappLink(i.phone, staffInviteMessage({ company: session.companyName, name: i.full_name, role: ROLE_LABELS[i.role as AppRole], code: i.code, origin }))}>
                  Enviar por WhatsApp
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      {session.canAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-ink-900">Convidar alguém</h2>
          <ActionForm action={inviteStaff} submitLabel="Criar convite" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className={labelClass}>Nome *<input name="full_name" required className={inputClass} /></label>
              <label className={labelClass}>Telefone<input name="phone" type="tel" className={inputClass} placeholder="+244 9XX XXX XXX" /></label>
              <label className={labelClass}>Função
                <select name="role" defaultValue="assistant" className={inputClass}>
                  <option value="assistant">Assistente</option>
                  <option value="driver">Motorista</option>
                  <option value="dispatcher">Operador (painel)</option>
                  <option value="company_admin">Administrador (painel)</option>
                </select>
              </label>
            </div>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
