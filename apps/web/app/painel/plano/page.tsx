import { ActionForm, inputClass, labelClass, type ActionState } from "@/components/action-form";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

async function requestPro(_prev: ActionState, formData: FormData): Promise<ActionState> {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_pro_plan", { p_message: String(formData.get("message") ?? "").trim() || null });
  return error ? { error: error.message } : { ok: "Pedido enviado. A equipa Kandokids vai contactá-lo pelo telefone da empresa." };
}

const ROWS = [
  ["Viaturas", "1", "Ilimitadas"],
  ["Alunos", "Até 15", "Ilimitados"],
  ["Todas as funcionalidades (mapa, PIN, SOS, mensagens…)", "✓", "✓"],
  ["Extras pagos pelos pais (receita para a empresa)", "✓", "✓"],
  ["Anúncios", "Nenhum", "Nenhum"],
  ["Apoio prioritário", "—", "✓"],
];

export default async function PlanPage() {
  const session = await requireManager();
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Plano</h1>
        <p className="mt-1 text-slate-600">Está no plano <strong>{session.plan.isPro ? "Pro" : "gratuito"}</strong>.</p>
      </header>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[32rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-3"></th><th className="px-4 py-3">Gratuito</th><th className="px-4 py-3 text-ink-900">Pro</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ROWS.map(([label, free, pro]) => (
              <tr key={label}><td className="px-4 py-3">{label}</td><td className="px-4 py-3">{free}</td><td className="px-4 py-3 font-semibold">{pro}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {!session.plan.isPro && session.canAdmin && (
        <section className="rounded-xl border border-brand-400 bg-brand-50 p-5">
          <h2 className="font-semibold text-ink-900">Pedir o plano Pro</h2>
          <p className="mb-4 mt-1 text-sm text-slate-600">Licença anual ou mensalidade. A equipa Kandokids contacta-o para combinar o pagamento.</p>
          <ActionForm action={requestPro} submitLabel="Pedir plano Pro" variant="brand" className="space-y-3">
            <label className={labelClass}>Mensagem (opcional)
              <textarea name="message" rows={2} className={inputClass} placeholder="ex.: temos 4 viaturas e 60 alunos" />
            </label>
          </ActionForm>
        </section>
      )}
    </div>
  );
}
