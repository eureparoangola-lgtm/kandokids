import { requirePlatformAdmin } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

type Guardian = {
  id: string; full_name: string; phone: string | null; email: string; created_at: string; last_sign_in_at: string | null;
  children: { name: string; company: string }[] | null; extras: string[];
};

export default async function GuardiansPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requirePlatformAdmin();
  const { q } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("platform_guardians", { p_search: q?.trim() || null });
  const guardians = (data ?? []) as Guardian[];
  const week = Date.now() - 7 * 864e5;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-ink-900">Encarregados</h1>
        <p className="mt-1 text-slate-600">Pais e encarregados ligados a pelo menos uma criança.</p>
      </header>
      <form className="flex gap-2" role="search">
        <input name="q" defaultValue={q} aria-label="Pesquisar" placeholder="Nome, telefone ou email"
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <button className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-semibold text-white">Pesquisar</button>
      </form>
      <p className="text-sm text-slate-500">{guardians.length} encarregados · {guardians.filter((g) => g.last_sign_in_at && new Date(g.last_sign_in_at).getTime() > week).length} ativos nos últimos 7 dias</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="px-4 py-2">Encarregado</th><th className="px-4 py-2">Contacto</th><th className="px-4 py-2">Crianças</th>
              <th className="px-4 py-2">Extras</th><th className="px-4 py-2">Último acesso</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {guardians.map((g) => (
              <tr key={g.id}>
                <td className="px-4 py-2 font-medium">{g.full_name || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{g.phone ?? "—"}<br />{g.email}</td>
                <td className="px-4 py-2">{(g.children ?? []).map((c) => `${c.name} (${c.company})`).join(", ")}</td>
                <td className="px-4 py-2">{g.extras.length ? g.extras.join(", ") : <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-2 text-slate-600">{g.last_sign_in_at ? new Date(g.last_sign_in_at).toLocaleDateString("pt-AO") : "nunca"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
