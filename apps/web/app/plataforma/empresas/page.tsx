import { whatsappLink } from "@kandokids/shared";
import { ActionForm, inputClass, labelClass } from "@/components/action-form";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { setPlan, setStatus } from "./actions";

type Company = {
  id: string; name: string; phone: string | null; email: string | null; nif: string | null; city: string | null;
  plan: "free" | "pro"; license_status: string; license_expires_at: string | null; suspended_reason: string | null; created_at: string;
  vehicles: number; students: number; guardians: number; staff: number; trips_7d: number; last_activity: string | null;
  admin: { full_name: string; phone: string | null; email: string } | null;
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("pt-AO") : "—");

export default async function CompaniesPage({ searchParams }: { searchParams: Promise<{ filtro?: string }> }) {
  await requirePlatformAdmin();
  const { filtro } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_companies");
  const all = (data ?? []) as Company[];
  const companies = all.filter((c) =>
    filtro === "pro" ? c.plan === "pro" : filtro === "gratuito" ? c.plan === "free" : filtro === "suspensas" ? c.license_status === "suspended" : true);
  const tabs = [["", "Todas", all.length], ["pro", "Pro", all.filter((c) => c.plan === "pro").length],
    ["gratuito", "Gratuito", all.filter((c) => c.plan === "free").length], ["suspensas", "Suspensas", all.filter((c) => c.license_status === "suspended").length]] as const;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Empresas</h1>
        <p className="mt-1 text-slate-600">Todas as empresas de transporte registadas.</p>
      </header>
      <nav className="flex flex-wrap gap-2" aria-label="Filtro">
        {tabs.map(([key, label, n]) => (
          <a key={key} href={key ? `?filtro=${key}` : "?"} aria-current={(filtro ?? "") === key ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-sm ${(filtro ?? "") === key ? "border-ink-900 bg-ink-900 text-white" : "border-slate-300 bg-white text-slate-700"}`}>
            {label} · {n}
          </a>
        ))}
      </nav>

      {companies.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Nenhuma empresa.</p>}
      <ul className="space-y-3">
        {companies.map((c) => {
          const suspended = c.license_status === "suspended";
          return (
            <li key={c.id} data-testid={`empresa-${c.name}`} className={`rounded-xl border bg-white ${suspended ? "border-red-300" : "border-slate-200"}`}>
              <details>
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <span className="min-w-0">
                    <span className="font-semibold text-ink-900">{c.name}</span>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${c.plan === "pro" ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-700"}`}>
                      {c.plan === "pro" ? `PRO até ${fmt(c.license_expires_at)}` : "GRATUITO"}
                    </span>
                    {suspended && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">SUSPENSA</span>}
                    <span className="block text-sm text-slate-500">{[c.city, c.phone, `registada a ${fmt(c.created_at)}`].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="text-sm text-slate-600">
                    {c.vehicles} viat. · {c.students} alunos · {c.guardians} pais · {c.trips_7d} viagens/7d · ativa {fmt(c.last_activity)}
                  </span>
                </summary>
                <div className="grid gap-6 border-t border-slate-100 p-5 md:grid-cols-3">
                  <div className="space-y-1 text-sm">
                    <h3 className="font-semibold text-ink-900">Contacto</h3>
                    <p>{c.admin?.full_name ?? "—"} (administrador)</p>
                    <p>{c.admin?.email ?? c.email ?? "—"}</p>
                    <p>{c.admin?.phone ?? c.phone ?? "—"}</p>
                    {c.nif && <p>NIF {c.nif}</p>}
                    {(c.admin?.phone ?? c.phone) && (
                      <a target="_blank" rel="noreferrer" className="inline-block font-semibold text-green-700 underline"
                        href={whatsappLink(c.admin?.phone ?? c.phone, `Olá! Fala a equipa Kandokids, sobre a ${c.name}.`)}>WhatsApp</a>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-ink-900">Plano</h3>
                    <ActionForm action={setPlan} submitLabel="Guardar plano" className="space-y-3">
                      <input type="hidden" name="company_id" value={c.id} />
                      <label className={labelClass}>Plano
                        <select name="plan" defaultValue={c.plan} className={inputClass}>
                          <option value="free">Gratuito (1 viatura, 15 alunos)</option>
                          <option value="pro">Pro (sem limites)</option>
                        </select>
                      </label>
                      <label className={labelClass}>Pro pago até
                        <input type="date" name="expires_on" defaultValue={c.license_expires_at ?? ""} className={inputClass} />
                      </label>
                    </ActionForm>
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-ink-900">{suspended ? "Conta suspensa" : "Suspender conta"}</h3>
                    {suspended ? (
                      <ActionForm action={setStatus} submitLabel="Reativar empresa" variant="brand" className="space-y-3">
                        <input type="hidden" name="company_id" value={c.id} />
                        <input type="hidden" name="suspend" value="false" />
                        <p className="text-sm text-red-800">Motivo: {c.suspended_reason}</p>
                      </ActionForm>
                    ) : (
                      <ActionForm action={setStatus} submitLabel="Suspender" className="space-y-3">
                        <input type="hidden" name="company_id" value={c.id} />
                        <input type="hidden" name="suspend" value="true" />
                        <label className={labelClass}>Motivo *
                          <input name="reason" required className={inputClass} placeholder="ex.: falta de pagamento" />
                        </label>
                        <p className="text-xs text-slate-500">Bloqueia o painel e as viagens; os pais veem um aviso. O administrador é notificado.</p>
                      </ActionForm>
                    )}
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
