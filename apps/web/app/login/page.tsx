import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

const NOTICES: Record<string, string> = {
  confirmado: "Email confirmado! Entre com o seu email e palavra-passe para abrir o painel.",
  "sem-acesso": "Esta conta não tem acesso ao painel de gestão. Encarregados e assistentes usam a app móvel.",
  "sem-empresa": "Esta conta ainda não está associada a uma empresa.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-ink-900 p-12 text-white lg:flex">
        <Logo className="text-xl" />
        <div>
          <h1 className="text-4xl font-bold leading-tight">
            Cada criança, <span className="text-brand-400">na viatura certa</span>, a cada viagem.
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            Gestão de transporte escolar com localização em tempo real, registo de recolhas e entregas e comunicação direta com os encarregados.
          </p>
        </div>
        <p className="text-sm text-slate-400">© Kandokids · Luanda</p>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 text-xl text-ink-900 lg:hidden" />
          <h2 className="text-2xl font-bold text-ink-900">Entrar no painel</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">Para administradores e operadores das empresas de transporte.</p>
          <LoginForm next={params.next ?? "/painel"} notice={params.erro ? NOTICES[params.erro] : undefined} success={params.confirmado ? NOTICES.confirmado : undefined} />
          <p className="mt-6 text-center text-sm text-slate-500">
            É uma empresa de transporte escolar? <a href="/registar" className="font-semibold text-ink-800 underline">Registe-se grátis</a>
          </p>
        </div>
      </section>
    </main>
  );
}
