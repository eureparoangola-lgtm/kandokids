import { ADDON_STATUS_LABELS, MODE_LABELS, PAYMENT_METHOD_LABELS, formatKz, type AddonStatus, type Feature } from "@kandokids/shared";
import { ActionForm, inputClass, labelClass } from "@/components/action-form";
import { Stat } from "@/components/stat";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { activateAddon, rejectAddon, saveExtra } from "./actions";

type AddonRow = {
  id: string; feature_key: string; status: AddonStatus; starts_on: string | null; ends_on: string | null;
  amount_kz: number; payment_method: string | null; payment_reference: string | null; created_at: string;
  profiles: { full_name: string; phone: string | null } | null; features: { name_pt: string } | null;
};
const fmtDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-AO") : "—");

export default async function PlatformExtrasPage() {
  await requirePlatformAdmin();
  const supabase = await createClient();
  const [{ data: rows }, { data: features }] = await Promise.all([
    supabase.from("guardian_addons")
      .select("id, feature_key, status, starts_on, ends_on, amount_kz, payment_method, payment_reference, created_at, profiles(full_name, phone), features(name_pt)")
      .order("created_at", { ascending: false }).limit(300).returns<AddonRow[]>(),
    supabase.from("features").select("*").eq("allows_addon", true).order("sort_order").returns<Feature[]>(),
  ]);
  const all = rows ?? [];
  const pending = all.filter((r) => r.status === "pending_payment");
  const active = all.filter((r) => r.status === "active");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Extras</h1>
        <p className="mt-1 max-w-2xl text-slate-600">Serviços pagos pelos encarregados diretamente à Kandokids. Um pagamento vale para todos os filhos do encarregado.</p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Pagamentos por confirmar" value={pending.length} highlight={pending.length > 0} />
        <Stat label="Extras ativos" value={active.length} />
        <Stat label="Valor recebido (histórico)" value={formatKz(all.filter((r) => r.status !== "pending_payment" && r.status !== "cancelled").reduce((s, r) => s + Number(r.amount_kz), 0))} />
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-ink-900">Por confirmar</h2>
        {pending.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Não há pedidos pendentes.</p> : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="rounded-xl border border-brand-400 bg-brand-50/50 p-4">
                <p className="font-semibold">{r.profiles?.full_name} <span className="font-normal text-slate-500">· {r.profiles?.phone}</span></p>
                <p className="text-sm text-slate-600">{r.features?.name_pt} · {formatKz(r.amount_kz)}/mês · {PAYMENT_METHOD_LABELS[r.payment_method ?? ""] ?? r.payment_method} · pedido a {new Date(r.created_at).toLocaleDateString("pt-AO")}</p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                  <ActionForm action={activateAddon} submitLabel="Confirmar pagamento" className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="addon_id" value={r.id} />
                    <label className="text-xs text-slate-600">Meses
                      <select name="months" defaultValue="1" className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                        {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} {m === 1 ? "mês" : "meses"} · {formatKz(Number(r.amount_kz) * m)}</option>)}
                      </select>
                    </label>
                    <label className="text-xs text-slate-600">Referência do pagamento
                      <input name="reference" placeholder="ex.: MCX-123456" className="mt-1 block w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    </label>
                  </ActionForm>
                  <form action={rejectAddon}><input type="hidden" name="addon_id" value={r.id} />
                    <button className="text-sm text-slate-500 underline-offset-4 hover:text-red-700 hover:underline">Recusar</button></form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-semibold text-ink-900">Catálogo e preços</h2>
        <p className="mb-3 text-sm text-slate-500">Aplica-se a todas as empresas. As empresas não veem nem alteram estes serviços.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {(features ?? []).map((f) => (
            <div key={f.key} data-testid={`catalogo-${f.key}`} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold text-ink-900">{f.name_pt}</h3>
              <p className="mb-3 text-sm text-slate-600">{f.description_pt}</p>
              <ActionForm action={saveExtra} submitLabel="Guardar" className="space-y-3">
                <input type="hidden" name="key" value={f.key} />
                <div className="grid grid-cols-2 gap-3">
                  <label className={labelClass}>Modo
                    <select name="mode" defaultValue={f.default_mode} className={inputClass}>
                      <option value="addon">{MODE_LABELS.addon}</option>
                      {f.allows_included && <option value="included">Grátis para todos</option>}
                      <option value="off">{MODE_LABELS.off}</option>
                    </select>
                  </label>
                  <label className={labelClass}>Preço mensal (Kz)
                    <input name="price" type="number" min={0} step={50} defaultValue={f.addon_price_kz ?? ""} className={inputClass} />
                  </label>
                </div>
              </ActionForm>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-ink-900">Histórico</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="px-4 py-2">Encarregado</th><th className="px-4 py-2">Extra</th><th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Válido</th><th className="px-4 py-2">Referência</th><th className="px-4 py-2 text-right">Valor</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {all.filter((r) => r.status !== "pending_payment").map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">{r.profiles?.full_name}</td><td className="px-4 py-2">{r.features?.name_pt}</td>
                  <td className="px-4 py-2">{ADDON_STATUS_LABELS[r.status]}</td>
                  <td className="px-4 py-2 text-slate-600">{fmtDate(r.starts_on)} → {fmtDate(r.ends_on)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.payment_reference ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{formatKz(r.amount_kz)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
