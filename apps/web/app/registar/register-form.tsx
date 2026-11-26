"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerCompany } from "./actions";

const input = "mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/20";

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerCompany, undefined);
  const v = state?.values ?? {};

  if (state?.checkEmail) {
    return (
      <div role="status" className="space-y-3 rounded-xl bg-green-50 p-5 text-green-900">
        <p className="font-semibold">Conta criada! Falta confirmar o email.</p>
        <p className="text-sm">Enviámos um link para <strong>{state.checkEmail}</strong>. Depois de confirmar, entre no painel e a sua empresa fica pronta.</p>
        <Link href="/login" className="inline-block font-semibold text-ink-800 underline">Ir para o login</Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wider text-slate-500">A empresa</legend>
        <label className="block"><span className="text-sm font-medium text-slate-700">Nome da empresa *</span>
          <input name="company" required defaultValue={v.company} className={input} placeholder="ex.: Transportes Escolares Kianda" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-medium text-slate-700">Telefone *</span>
            <input name="phone" required type="tel" defaultValue={v.phone ?? "+244 "} className={input} /></label>
          <label className="block"><span className="text-sm font-medium text-slate-700">NIF</span>
            <input name="nif" defaultValue={v.nif} className={input} /></label>
        </div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold uppercase tracking-wider text-slate-500">O seu acesso (administrador)</legend>
        <label className="block"><span className="text-sm font-medium text-slate-700">O seu nome *</span>
          <input name="name" required autoComplete="name" defaultValue={v.name} className={input} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Email *</span>
          <input name="email" type="email" required autoComplete="email" defaultValue={v.email} className={input} /></label>
        <label className="block"><span className="text-sm font-medium text-slate-700">Palavra-passe * <span className="font-normal text-slate-500">(mín. 8 caracteres)</span></span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className={input} /></label>
      </fieldset>
      {state?.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-brand-500 py-3 font-semibold text-ink-900 transition hover:bg-brand-400 disabled:opacity-60">
        {pending ? "A criar…" : "Criar conta grátis"}
      </button>
      <p className="text-center text-sm text-slate-500">Já tem conta? <Link href="/login" className="font-semibold text-ink-800 underline">Entrar</Link></p>
    </form>
  );
}
