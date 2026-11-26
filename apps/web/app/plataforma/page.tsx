import Link from "next/link";
import { revalidatePath } from "next/cache";
import { formatKz } from "@kandokids/shared";
import { Stat } from "@/components/stat";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Overview = {
  companies: number; companies_pro: number; companies_free: number; companies_suspended: number; companies_new_30d: number;
  guardians: number; guardians_active_7d: number; staff: number; students: number; vehicles: number;
  trips_today: number; trips_live: number; addons_active: number; addons_pending: number; addons_monthly_kz: number;
  pro_requests: { id: string; body: string; created_at: string; company_id: string }[];
};

async function markHandled(formData: FormData) {
  "use server";
  await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", String(formData.get("id")));
  revalidatePath("/plataforma");
}

export default async function PlatformHome() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_overview");
  if (error || !data) return <p className="text-red-700">{error?.message ?? "Sem dados."}</p>;
  const o = data as Overview;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Visão geral</h1>
        <p className="mt-1 text-slate-600">Como a Kandokids está a ser usada, agora.</p>
      </header>

      <section aria-label="Empresas">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Empresas</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Empresas" value={o.companies} hint={`${o.companies_new_30d} ${o.companies_new_30d === 1 ? "nova" : "novas"} nos últimos 30 dias`} />
          <Stat label="Plano Pro" value={o.companies_pro} />
          <Stat label="Plano gratuito" value={o.companies_free} />
          <Stat label="Suspensas" value={o.companies_suspended} highlight={o.companies_suspended > 0} />
        </div>
      </section>

      <section aria-label="Utilizadores">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Utilizadores e operação</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Encarregados" value={o.guardians} hint={`${o.guardians_active_7d} ${o.guardians_active_7d === 1 ? "ativo" : "ativos"} nos últimos 7 dias`} />
          <Stat label="Equipa das empresas" value={o.staff} hint="administradores, assistentes, motoristas" />
          <Stat label="Alunos" value={o.students} hint={`${o.vehicles} viaturas`} />
          <Stat label="Viagens hoje" value={o.trips_today} hint={`${o.trips_live} em curso agora`} />
        </div>
      </section>

      <section aria-label="Extras">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Extras pagos pelos pais</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Receita mensal dos extras" value={formatKz(o.addons_monthly_kz)} />
          <Stat label="Extras ativos" value={o.addons_active} />
          <Stat label="Pagamentos por confirmar" value={o.addons_pending} highlight={o.addons_pending > 0} />
        </div>
        {o.addons_pending > 0 && (
          <Link href="/plataforma/extras" className="mt-3 inline-block text-sm font-semibold text-ink-800 underline">Confirmar pagamentos →</Link>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-ink-900">Pedidos de plano Pro</h2>
        {o.pro_requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Sem pedidos pendentes.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-brand-400 bg-white">
            {o.pro_requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>{r.body} <span className="text-slate-500">· {new Date(r.created_at).toLocaleDateString("pt-AO")}</span></span>
                <span className="flex gap-3">
                  <Link href="/plataforma/empresas" className="font-semibold text-ink-800 underline">Mudar plano</Link>
                  <form action={markHandled}><input type="hidden" name="id" value={r.id} />
                    <button className="text-slate-500 underline">Marcar como tratado</button></form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
