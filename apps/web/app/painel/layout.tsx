import { ROLE_LABELS } from "@kandokids/shared";
import { Logo } from "@/components/logo";
import { SidebarNav } from "@/components/sidebar-nav";
import { requireManager } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireManager();
  const supabase = await createClient();
  const [{ count: vehicles }, { count: students }] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("company_id", session.companyId).eq("active", true),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("company_id", session.companyId).eq("active", true),
  ]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-6 bg-ink-900 p-4 text-white lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:p-5">
        <div className="flex items-center justify-between lg:block">
          <Logo className="text-lg" />
          <p className="text-sm text-slate-300 lg:mt-4">{session.companyName}</p>
        </div>
        <SidebarNav />
        <div className="mt-auto hidden border-t border-white/10 pt-4 text-sm lg:block">
          <p className="font-medium">{session.fullName}</p>
          <p className="text-slate-400">{ROLE_LABELS[session.role]}</p>
          <form action={signOut}>
            <button className="mt-3 text-slate-300 underline-offset-4 hover:text-white hover:underline">Terminar sessão</button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 lg:px-10">
        {!session.plan.isPro && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-400 bg-brand-50 px-4 py-3 text-sm text-ink-900">
            <span>
              <strong>Plano gratuito</strong> · {vehicles ?? 0}/{session.plan.maxVehicles} viatura · {students ?? 0}/{session.plan.maxStudents} alunos
            </span>
            <a href="/painel/plano" className="font-semibold underline underline-offset-4">Passar para o plano Pro</a>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
