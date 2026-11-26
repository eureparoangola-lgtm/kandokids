import { CATEGORY_LABELS, type CompanyFeature, type Feature, type FeatureCategory } from "@kandokids/shared";
import { FeatureCard } from "@/components/feature-card";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

const CATEGORY_ORDER: FeatureCategory[] = ["tracking", "safety", "communication", "operations", "extra"];

export default async function FuncionalidadesPage() {
  const session = await requireManager();
  const supabase = await createClient();

  const [{ data: allFeatures }, { data: companyFeatures }] = await Promise.all([
    supabase.from("features").select("*").order("sort_order").returns<Feature[]>(),
    supabase.from("company_features").select("*").eq("company_id", session.companyId).returns<CompanyFeature[]>(),
  ]);

  const byKey = new Map((companyFeatures ?? []).map((cf) => [cf.feature_key, cf]));
  // Os extras pagos pelos pais são vendidos pela Kandokids: não aparecem às empresas.
  const features = (allFeatures ?? []).filter((f) => f.default_mode !== "addon" && byKey.get(f.key)?.mode !== "addon");
  const active = features.filter((f) => (byKey.get(f.key)?.mode ?? f.default_mode) !== "off").length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Funcionalidades</h1>
        <p className="mt-1 max-w-2xl text-slate-600">
          Escolha o que está disponível para os encarregados e para a equipa da sua empresa.
        </p>
        <p className="mt-3 text-sm text-slate-500">{active} de {features.length} ativas</p>
        {!session.canAdmin && (
          <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-ink-800">Apenas o administrador da empresa pode alterar estas definições.</p>
        )}
      </header>

      {CATEGORY_ORDER.map((category) => {
        const list = features.filter((f) => f.category === category);
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
                    locked={cf?.locked_by_platform ?? false}
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
