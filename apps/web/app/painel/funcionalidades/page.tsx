import { CATEGORY_LABELS, type CompanyFeature, type Feature, type FeatureCategory } from "@kandokids/shared";
import { FeatureCard } from "@/components/feature-card";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const CATEGORY_ORDER: FeatureCategory[] = ["tracking", "safety", "communication", "operations", "extra"];

export default async function FuncionalidadesPage() {
  const session = await requireManager();
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Luanda" }).format(new Date());

  const [{ data: features }, { data: companyFeatures }, { data: addons }] = await Promise.all([
    supabase.from("features").select("*").order("sort_order").returns<Feature[]>(),
    supabase.from("company_features").select("*").eq("company_id", session.companyId).returns<CompanyFeature[]>(),
    supabase.from("guardian_addons").select("feature_key")
      .eq("company_id", session.companyId).eq("status", "active").gte("ends_on", today),
  ]);

  const byKey = new Map((companyFeatures ?? []).map((cf) => [cf.feature_key, cf]));
  const subscribers = new Map<string, number>();
  for (const a of addons ?? []) subscribers.set(a.feature_key, (subscribers.get(a.feature_key) ?? 0) + 1);

  const active = (companyFeatures ?? []).filter((cf) => cf.mode !== "off").length;
  const paid = (companyFeatures ?? []).filter((cf) => cf.mode === "addon").length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Funcionalidades</h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          Escolha o que está disponível para os encarregados e para a equipa. <strong>Incluído</strong> fica ativo para todos;{" "}
          <strong>Extra pago</strong> só funciona para os encarregados que pagarem a mensalidade do extra.
        </p>
        <p className="mt-3 text-sm text-slate-500">{active} ativas · {paid} vendidas como extra</p>
        {!session.canAdmin && (
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-ink-800">Apenas o administrador da empresa pode alterar estas definições.</p>
        )}
      </header>

      {CATEGORY_ORDER.map((category) => {
        const list = (features ?? []).filter((f) => f.category === category);
        if (!list.length) return null;
        return (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">{CATEGORY_LABELS[category]}</h2>
            <div className="space-y-3">
              {list.map((f) => {
                const cf = byKey.get(f.key);
                return (
                  <FeatureCard key={f.key} feature={f}
                    mode={cf?.mode ?? f.default_mode}
                    priceKz={cf?.addon_price_kz === null || cf?.addon_price_kz === undefined ? null : Number(cf.addon_price_kz)}
                    locked={cf?.locked_by_platform ?? false}
                    activeSubscribers={subscribers.get(f.key) ?? 0}
                    canEdit={session.canAdmin} />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
