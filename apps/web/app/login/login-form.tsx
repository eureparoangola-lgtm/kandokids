"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  const error = state?.error ?? notice;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input name="email" type="email" required autoComplete="email" defaultValue={state?.email}
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/20" />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Palavra-passe</span>
        <input name="password" type="password" required autoComplete="current-password"
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/20" />
      </label>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={pending}
        className="w-full rounded-lg bg-ink-900 py-2.5 font-semibold text-white transition hover:bg-ink-800 disabled:opacity-60">
        {pending ? "A entrar…" : "Entrar"}
      </button>
    </form>
  );
}
