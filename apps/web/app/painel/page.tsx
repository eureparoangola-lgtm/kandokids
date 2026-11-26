import Link from "next/link";
import { DIRECTION_LABELS, TRIP_STATUS_LABELS, type BoardingStatus, type TripDirection, type TripStatus } from "@kandokids/shared";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type TripRow = {
  id: string;
  direction: TripDirection;
  status: TripStatus;
  vehicles: { plate: string; nickname: string | null } | null;
  routes: { name: string } | null;
  trip_students: { status: BoardingStatus }[];
};

const STATUS_STYLE: Record<TripStatus, string> = {
  scheduled: "bg-slate-100 text-slate-700",
  in_progress: "bg-green-100 text-green-800",
  completed: "bg-ink-900/10 text-ink-800",
  cancelled: "bg-red-100 text-red-700",
};

export default async function PainelHome() {
  const session = await requireManager();
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(new Date());

  const [{ data: trips }, { data: incidents }] = await Promise.all([
    supabase
      .from("trips")
      .select("id, direction, status, vehicles(plate, nickname), routes(name), trip_students(status)")
      .eq("company_id", session.companyId)
      .eq("service_date", today)
      .order("direction")
      .returns<TripRow[]>(),
    supabase
      .from("incidents")
      .select("id, type, message, created_at, vehicles(plate)")
      .eq("company_id", session.companyId)
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<{ id: string; type: string; message: string | null; created_at: string; vehicles: { plate: string } | null }[]>(),
  ]);

  const [{ count: nVehicles }, { count: nStudents }, { count: nRoutes }, { count: nStaff }, { count: nParents }] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("company_id", session.companyId).eq("active", true),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("company_id", session.companyId).eq("active", true),
    supabase.from("routes").select("id", { count: "exact", head: true }).eq("company_id", session.companyId).eq("active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", session.companyId).in("role", ["assistant", "driver"]),
    supabase.from("guardian_invites").select("id", { count: "exact", head: true }).eq("company_id", session.companyId).not("accepted_at", "is", null),
  ]);
  const steps = [
    { done: (nVehicles ?? 0) > 0, label: "Adicionar a viatura", href: "/painel/viaturas" },
    { done: (nStudents ?? 0) > 0, label: "Importar ou adicionar os alunos", href: "/painel/alunos" },
    { done: (nStaff ?? 0) > 0, label: "Convidar o assistente da viatura", href: "/painel/equipa" },
    { done: (nRoutes ?? 0) > 0, label: "Criar a rota (viatura + assistente + alunos)", href: "/painel/rotas" },
    { done: (nParents ?? 0) > 0, label: "Convidar os pais por WhatsApp", href: "/painel/alunos" },
  ];
  const all = (trips ?? []).flatMap((t) => t.trip_students);
  const stats = [
    { label: "Viagens hoje", value: trips?.length ?? 0 },
    { label: "Crianças a bordo agora", value: all.filter((s) => s.status === "on_board").length },
    { label: "Entregues", value: all.filter((s) => s.status === "delivered").length },
    { label: "Ausentes hoje", value: all.filter((s) => s.status === "absent").length },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Bom dia 👋</h1>
        <p className="text-slate-500">Resumo de hoje, {new Date().toLocaleDateString("pt-AO", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Luanda" })}.</p>
      </header>

      {steps.some((s) => !s.done) && (
        <section className="rounded-xl border border-brand-400 bg-white p-5" aria-labelledby="primeiros-passos">
          <h2 id="primeiros-passos" className="font-semibold text-ink-900">Primeiros passos ({steps.filter((s) => s.done).length}/{steps.length})</h2>
          <ol className="mt-3 space-y-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3 text-sm">
                <span className={`grid size-6 place-items-center rounded-full text-xs font-bold ${s.done ? "bg-green-600 text-white" : "bg-slate-100 text-slate-600"}`}>{s.done ? "✓" : i + 1}</span>
                {s.done ? <span className="text-slate-500 line-through">{s.label}</span>
                  : <Link href={s.href} className="font-medium text-ink-800 underline underline-offset-4">{s.label}</Link>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-3xl font-bold text-ink-900">{s.value}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </section>

      {incidents && incidents.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="font-semibold text-red-800">Incidentes por resolver</h2>
          <ul className="mt-2 space-y-1 text-sm text-red-900">
            {incidents.map((i) => (
              <li key={i.id}>
                <strong>{i.vehicles?.plate}</strong> · {i.message ?? i.type} ·{" "}
                {new Date(i.created_at).toLocaleTimeString("pt-AO", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Luanda" })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-ink-900">Viagens de hoje</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {(trips ?? []).length === 0 && <p className="p-6 text-sm text-slate-500">Sem viagens agendadas para hoje.</p>}
          <ul className="divide-y divide-slate-100">
            {(trips ?? []).map((t) => {
              const onBoard = t.trip_students.filter((s) => s.status === "on_board").length;
              const total = t.trip_students.filter((s) => s.status !== "transferred").length;
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{t.vehicles?.nickname ?? t.vehicles?.plate} <span className="text-slate-400">· {t.vehicles?.plate}</span></p>
                    <p className="text-sm text-slate-500">{t.routes?.name ?? DIRECTION_LABELS[t.direction]}</p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-slate-600">{onBoard} a bordo · {total} {total === 1 ? "criança" : "crianças"}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[t.status]}`}>{TRIP_STATUS_LABELS[t.status]}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {session.canAdmin && (
        <p className="text-sm text-slate-500">
          Configure o que os encarregados podem usar em <Link href="/painel/funcionalidades" className="font-medium text-ink-700 underline">Funcionalidades</Link>.
        </p>
      )}
    </div>
  );
}
