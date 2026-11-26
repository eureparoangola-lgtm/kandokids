import { guardianInviteMessage, whatsappLink } from "@kandokids/shared";
import { ActionForm, inputClass, labelClass } from "@/components/action-form";
import { StudentImport } from "@/components/student-import";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { addStudent, newInvite } from "./actions";

type StudentRow = {
  id: string;
  full_name: string;
  grade: string | null;
  home_address: string | null;
  home_lat: number | null;
  schools: { name: string } | null;
  student_guardians: { profiles: { full_name: string; phone: string | null } | null }[];
  guardian_invites: { code: string; phone: string; accepted_at: string | null; expires_at: string }[];
};

export default async function StudentsPage() {
  const session = await requireManager();
  const supabase = await createClient();
  const [{ data: students }, { data: routes }] = await Promise.all([
    supabase.from("students")
      .select("id, full_name, grade, home_address, home_lat, schools(name), student_guardians(profiles(full_name, phone)), guardian_invites(code, phone, accepted_at, expires_at)")
      .eq("company_id", session.companyId).eq("active", true).order("full_name").returns<StudentRow[]>(),
    supabase.from("routes").select("id, name").eq("company_id", session.companyId).eq("active", true).order("name"),
  ]);
  const now = new Date().toISOString();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Alunos</h1>
        <p className="mt-1 text-slate-600">
          {students?.length ?? 0} alunos{session.plan.maxStudents ? ` de ${session.plan.maxStudents} no plano gratuito` : ""}.
          Cada encarregado recebe um código de convite para ligar a sua conta ao filho.
        </p>
      </header>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        {(students ?? []).length === 0 && <p className="p-6 text-sm text-slate-500">Ainda não tem alunos. Importe a lista do Excel ou adicione um a um.</p>}
        <ul className="divide-y divide-slate-100">
          {(students ?? []).map((s) => {
            const linked = s.student_guardians.map((g) => g.profiles?.full_name).filter(Boolean);
            const pending = s.guardian_invites.filter((i) => !i.accepted_at && i.expires_at > now);
            return (
              <li key={s.id} data-testid={`aluno-${s.full_name}`} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-semibold">{s.full_name}</p>
                  <p className="text-sm text-slate-500">
                    {[s.grade, s.schools?.name, s.home_address].filter(Boolean).join(" · ") || "—"}
                    {s.home_lat == null && <span title="A casa é registada automaticamente na primeira recolha com GPS"> · 📍 casa por registar</span>}
                  </p>
                  {linked.length > 0 && <p className="text-sm text-green-700">✓ {linked.join(", ")}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {pending.map((inv) => (
                    <a key={inv.code} target="_blank" rel="noreferrer"
                      href={whatsappLink(inv.phone, guardianInviteMessage({ company: session.companyName, student: s.full_name.split(" ")[0], code: inv.code }))}
                      className="rounded-lg bg-green-600 px-3 py-1 font-semibold text-white hover:bg-green-700" title={`Código ${inv.code} · ${inv.phone}`}>
                      Convidar {inv.phone} por WhatsApp
                    </a>
                  ))}
                  {pending.length === 0 && (
                    <form action={newInvite} className="flex items-center gap-2">
                      <input type="hidden" name="student_id" value={s.id} />
                      <input name="phone" type="tel" placeholder="Telefone do encarregado" aria-label={`Telefone do encarregado de ${s.full_name}`}
                        className="w-44 rounded-lg border border-slate-300 px-2 py-1 text-sm" />
                      <button className="rounded-lg border border-slate-300 px-3 py-1 font-medium hover:bg-slate-50">Criar convite</button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-ink-900">Importar do Excel</h2>
        <StudentImport companyName={session.companyName} routes={routes ?? []} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-ink-900">Adicionar um aluno</h2>
        <ActionForm action={addStudent} submitLabel="Adicionar aluno" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>Nome do aluno *<input name="full_name" required className={inputClass} /></label>
            <label className={labelClass}>Classe<input name="grade" className={inputClass} placeholder="ex.: 3ª classe" /></label>
            <label className={labelClass}>Escola<input name="school_name" className={inputClass} /></label>
            <label className={labelClass}>Morada<input name="home_address" className={inputClass} placeholder="ex.: Kilamba, Bloco Q" /></label>
            <label className={labelClass}>Nome do encarregado<input name="guardian_name" className={inputClass} /></label>
            <label className={labelClass}>Telefone do encarregado<input name="guardian_phone" type="tel" className={inputClass} placeholder="+244 9XX XXX XXX" /></label>
            <label className={labelClass}>Parentesco<input name="relationship" className={inputClass} placeholder="ex.: Mãe" /></label>
            {(routes ?? []).length > 0 && (
              <label className={labelClass}>Rota
                <select name="route_id" className={inputClass}>
                  <option value="">— Nenhuma —</option>
                  {(routes ?? []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
            )}
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
