import { ADDON_STATUS_LABELS, PAYMENT_METHOD_LABELS, formatKz, type AddonStatus } from "@kandokids/shared";
import { ActivateAddonForm } from "@/components/activate-addon-form";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cancelAddon } from "./actions";

type AddonRow = {
  id: string;
  feature_key: string;
  status: AddonStatus;
  starts_on: string | null;
  ends_on: string | null;
  amount_kz: number;
  payment_method: string | null;
  payment_reference: string | null;
  created_at: string;
  profiles: { full_name: string; phone: string | null } | null;
  features: { name_pt: string } | null;
};

const fmtDate = (d: string | null) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-AO") : "—");

export default async function ExtrasPage() {
  const session = await requireManager();
  const supabase = await createClient();
  const { data } = await supabase
    .from("guardian_addons")
    .select("id, feature_key, status, starts_on, ends_on, amount_kz, payment_method, payment_reference, created_at, profiles(full_name, phone), features(name_pt)")
    .eq("company_id", session.companyId)
    .order("created_at", { ascending: false })
    .returns<AddonRow[]>();

  const rows = data ?? [];
  const pending = rows.filter((r) => r.status === "pending_payment");
  const active = rows.filter((r) => r.status === "active");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(new Date());
  const in7 = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(new Date(Date.now() + 7 * 864e5));
  const expiringSoon = active.filter((r) => r.ends_on && r.ends_on >= today && r.ends_on <= in7).length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Extras pagos</h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          Pedidos dos encarregados para extras (SMS, alertas de velocidade, etc.). Confirme o pagamento para ativar.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Pedidos por confirmar" value={String(pending.length)} highlight={pending.length > 0} />
        <Stat label="Extras ativos" value={String(active.length)} />
        <Stat label="Terminam em 7 dias" value={String(expiringSoon)} />
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-ink-900">Por confirmar</h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Não há pedidos pendentes.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="rounded-xl border border-brand-400 bg-brand-50/50 p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.profiles?.full_name} <span className="font-normal text-slate-500">· {r.profiles?.phone}</span></p>
                    <p className="text-sm text-slate-600">
                      {r.features?.name_pt} · {formatKz(r.amount_kz)}/mês · {PAYMENT_METHOD_LABELS[r.payment_method ?? ""] ?? r.payment_method}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">Pedido a {new Date(r.created_at).toLocaleDateString("pt-AO")}</p>
                </div>
                {session.canAdmin && (
                  <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                    <ActivateAddonForm addonId={r.id} monthlyKz={Number(r.amount_kz)} />
                    <form action={cancelAddon}>
                      <input type="hidden" name="addon_id" value={r.id} />
                      <button className="text-sm text-slate-500 underline-offset-4 hover:text-red-700 hover:underline">Recusar</button>
                    </form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-ink-900">Histórico</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2">Encarregado</th><th className="px-4 py-2">Extra</th>
                <th className="px-4 py-2">Estado</th><th className="px-4 py-2">Válido</th>
                <th className="px-4 py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.filter((r) => r.status !== "pending_payment").map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">{r.profiles?.full_name}</td>
                  <td className="px-4 py-2">{r.features?.name_pt}</td>
                  <td className="px-4 py-2">{ADDON_STATUS_LABELS[r.status]}</td>
                  <td className="px-4 py-2 text-slate-600">{fmtDate(r.starts_on)} → {fmtDate(r.ends_on)}</td>
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

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-white"}`}>
      <p className="text-3xl font-bold text-ink-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}
