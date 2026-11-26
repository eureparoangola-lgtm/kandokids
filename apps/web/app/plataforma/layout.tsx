import { Logo } from "@/components/logo";
import { PlatformNav } from "@/components/platform-nav";
import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

export const metadata = { title: "Kandokids — Plataforma" };

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePlatformAdmin();
  const supabase = await createClient();
  const { count } = await supabase.from("guardian_addons").select("id", { count: "exact", head: true }).eq("status", "pending_payment");

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-6 bg-ink-900 p-4 text-white lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:p-5">
        <div className="flex items-center justify-between lg:block">
          <Logo className="text-lg" />
          <p className="text-sm font-semibold text-brand-400 lg:mt-4">Plataforma</p>
        </div>
        <PlatformNav pendingExtras={count ?? 0} />
        <div className="mt-auto hidden border-t border-white/10 pt-4 text-sm lg:block">
          <p className="font-medium">{session.fullName}</p>
          <p className="text-slate-400">Equipa Kandokids</p>
          <form action={signOut}>
            <button className="mt-3 text-slate-300 underline-offset-4 hover:text-white hover:underline">Terminar sessão</button>
          </form>
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-10">{children}</main>
    </div>
  );
}
