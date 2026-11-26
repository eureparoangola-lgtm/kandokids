import { DIRECTION_LABELS, type TripDirection } from "@kandokids/shared";
import { ActionForm, inputClass, labelClass } from "@/components/action-form";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { generateToday, saveRoute } from "./actions";

type Route = {
  id: string; name: string; direction: TripDirection; scheduled_time: string | null; weekdays: number[];
  school_id: string | null; default_vehicle_id: string | null; default_assistant_id: string | null; default_driver_id: string | null;
  route_stops: { student_id: string; position: number }[];
};
type Option = { id: string; label: string };
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export default async function RoutesPage() {
  const session = await requireManager();
  const supabase = await createClient();
  const [{ data: routes }, { data: vehicles }, { data: staff }, { data: students }, { data: schools }] = await Promise.all([
    supabase.from("routes").select("id, name, direction, scheduled_time, weekdays, school_id, default_vehicle_id, default_assistant_id, default_driver_id, route_stops(student_id, position)")
      .eq("company_id", session.companyId).eq("active", true).order("scheduled_time").returns<Route[]>(),
    supabase.from("vehicles").select("id, plate, nickname").eq("company_id", session.companyId).eq("active", true),
    supabase.from("profiles").select("id, full_name, role").eq("company_id", session.companyId).in("role", ["assistant", "driver", "dispatcher", "company_admin"]),
    supabase.from("students").select("id, full_name").eq("company_id", session.companyId).eq("active", true).order("full_name"),
    supabase.from("schools").select("id, name").eq("company_id", session.companyId).order("name"),
  ]);
  const opts = {
    vehicles: (vehicles ?? []).map((v) => ({ id: v.id, label: v.nickname ? `${v.nickname} · ${v.plate}` : v.plate })),
    assistants: (staff ?? []).filter((p) => p.role !== "driver").map((p) => ({ id: p.id, label: p.full_name })),
    drivers: (staff ?? []).filter((p) => p.role === "driver").map((p) => ({ id: p.id, label: p.full_name })),
    students: (students ?? []).map((s) => ({ id: s.id, label: s.full_name })),
    schools: (schools ?? []).map((s) => ({ id: s.id, label: s.name })),
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Rotas</h1>
          <p className="mt-1 max-w-2xl text-slate-600">
            Cada rota gera automaticamente a viagem do dia (às 05:00), com a viatura, o assistente e os alunos.
          </p>
        </div>
        <ActionForm action={generateToday} submitLabel="Criar as viagens de hoje agora" variant="brand"><span /></ActionForm>
      </header>

      {opts.vehicles.length === 0 && (
        <p className="rounded-lg bg-brand-50 px-4 py-3 text-sm text-ink-900">Adicione primeiro uma viatura em <a href="/painel/viaturas" className="font-semibold underline">Viaturas</a>.</p>
      )}

      {(routes ?? []).map((r) => (
        <details key={r.id} className="group rounded-xl border border-slate-200 bg-white">
          <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-5 py-4">
            <span>
              <span className="font-semibold text-ink-900">{r.name}</span>
              <span className="ml-2 text-sm text-slate-500">{DIRECTION_LABELS[r.direction]}{r.scheduled_time ? ` · ${r.scheduled_time.slice(0, 5)}` : ""}</span>
            </span>
            <span className="text-sm text-slate-500">
              {r.route_stops.length} alunos · {opts.vehicles.find((v) => v.id === r.default_vehicle_id)?.label ?? "sem viatura"} · {r.weekdays.map((d) => DAYS[d - 1]).join(", ")}
            </span>
          </summary>
          <div className="border-t border-slate-100 p-5">
            <RouteForm route={r} opts={opts} />
          </div>
        </details>
      ))}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-ink-900">Nova rota</h2>
        <RouteForm opts={opts} />
      </section>
    </div>
  );
}

function Select({ name, label, options, value, empty = "— Nenhum —" }: { name: string; label: string; options: Option[]; value?: string | null; empty?: string }) {
  return (
    <label className={labelClass}>{label}
      <select name={name} defaultValue={value ?? ""} className={inputClass}>
        <option value="">{empty}</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
}

function RouteForm({ route, opts }: { route?: Route; opts: Record<"vehicles" | "assistants" | "drivers" | "students" | "schools", Option[]> }) {
  const selected = new Set(route?.route_stops.map((s) => s.student_id));
  const days = new Set(route?.weekdays ?? [1, 2, 3, 4, 5]);
  return (
    <ActionForm action={saveRoute} submitLabel={route ? "Guardar rota" : "Criar rota"} className="space-y-4">
      {route && <input type="hidden" name="id" value={route.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>Nome *<input name="name" required defaultValue={route?.name} className={inputClass} placeholder="ex.: Kilamba → Colégio (manhã)" /></label>
        <label className={labelClass}>Sentido
          <select name="direction" defaultValue={route?.direction ?? "to_school"} className={inputClass}>
            <option value="to_school">Ida para a escola</option>
            <option value="to_home">Regresso a casa</option>
          </select>
        </label>
        <label className={labelClass}>Hora de partida<input name="scheduled_time" type="time" defaultValue={route?.scheduled_time?.slice(0, 5)} className={inputClass} /></label>
        <Select name="school_id" label="Escola" options={opts.schools} value={route?.school_id} />
        <Select name="vehicle_id" label="Viatura *" options={opts.vehicles} value={route?.default_vehicle_id} empty="— Escolha —" />
        <Select name="assistant_id" label="Assistente" options={opts.assistants} value={route?.default_assistant_id} />
        <Select name="driver_id" label="Motorista" options={opts.drivers} value={route?.default_driver_id} />
      </div>
      <fieldset>
        <legend className={labelClass}>Dias</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {DAYS.map((d, i) => (
            <label key={d} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-sm">
              <input type="checkbox" name="weekdays" value={i + 1} defaultChecked={days.has(i + 1)} /> {d}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className={labelClass}>Alunos ({opts.students.length})</legend>
        {opts.students.length === 0 ? <p className="text-sm text-slate-500">Adicione alunos primeiro.</p> : (
          <div className="mt-1 grid max-h-64 gap-1 overflow-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-2">
            {opts.students.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="students" value={s.id} defaultChecked={selected.has(s.id)} /> {s.label}</label>
            ))}
          </div>
        )}
      </fieldset>
    </ActionForm>
  );
}
