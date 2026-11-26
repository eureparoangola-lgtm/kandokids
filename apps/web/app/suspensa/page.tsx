import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

export default async function SuspendedPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", auth.user.id).single();
  const { data: company } = await supabase.from("companies").select("name, license_status, suspended_reason").eq("id", profile?.company_id).single();
  if (company?.license_status !== "suspended") redirect("/painel");
  const { data: settings } = await supabase.from("platform_settings").select("key, value").in("key", ["support_phone", "support_whatsapp"]);
  const contact = settings?.find((s) => s.key === "support_whatsapp" && s.value)?.value ?? settings?.find((s) => s.key === "support_phone" && s.value)?.value;

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <Logo className="justify-center text-xl text-ink-900" />
        <h1 className="text-xl font-bold text-ink-900">A conta de {company.name} está suspensa</h1>
        {company.suspended_reason && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">Motivo: {company.suspended_reason}</p>}
        <p className="text-sm text-slate-600">
          Enquanto a conta estiver suspensa, as viagens não podem ser iniciadas na app.
          {contact ? <> Contacte a equipa Kandokids: <strong>{contact}</strong>.</> : " Contacte a equipa Kandokids."}
        </p>
        <form action={signOut}><button className="text-sm text-slate-500 underline">Terminar sessão</button></form>
      </div>
    </main>
  );
}
