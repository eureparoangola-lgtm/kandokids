import { Logo } from "@/components/logo";
import { RegisterForm } from "./register-form";

export const metadata = { title: "Registar empresa — Kandokids" };

export default function RegisterPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink-900 p-12 text-white lg:flex">
        <Logo className="text-xl" />
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight">Comece hoje, <span className="text-brand-400">grátis</span>.</h1>
          <ul className="space-y-3 text-slate-200">
            <li>✓ 1 viatura e até 15 alunos, grátis para sempre</li>
            <li>✓ Todas as funcionalidades, sem anúncios</li>
            <li>✓ Importe os alunos do Excel e convide os pais por WhatsApp</li>
            <li>✓ Ganhe com os extras pagos pelos pais (SMS, alertas…)</li>
          </ul>
          <p className="text-sm text-slate-400">Mais viaturas? Passe para o plano Pro quando precisar.</p>
        </div>
        <p className="text-sm text-slate-400">© Kandokids · Luanda</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Logo className="mb-8 text-xl text-ink-900 lg:hidden" />
          <h2 className="text-2xl font-bold text-ink-900">Registar a sua empresa</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">Plano gratuito: 1 viatura e até 15 alunos, para sempre.</p>
          <RegisterForm />
        </div>
      </section>
    </main>
  );
}
