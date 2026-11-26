"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";

export type ActionState = { error?: string; ok?: string } | undefined;
type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export const inputClass =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-ink-700 focus:ring-2 focus:ring-ink-700/20";
export const labelClass = "block text-sm font-medium text-slate-700";

/** Formulário com server action: mostra erro/sucesso e limpa os campos após sucesso. */
export function ActionForm({ action, children, submitLabel, className = "", variant = "primary" }: {
  action: Action; children: ReactNode; submitLabel: string; className?: string; variant?: "primary" | "brand" | "danger-link";
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  const btn =
    variant === "danger-link"
      ? "text-sm text-slate-500 underline-offset-4 hover:text-red-700 hover:underline"
      : `rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
          variant === "brand" ? "bg-brand-500 text-ink-900 hover:bg-brand-400" : "bg-ink-900 text-white hover:bg-ink-800"}`;

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={btn}>{pending ? "A guardar…" : submitLabel}</button>
        <span aria-live="polite" className="text-sm">
          {state?.error && <span role="alert" className="text-red-700">{state.error}</span>}
          {state?.ok && <span className="text-green-700">{state.ok}</span>}
        </span>
      </div>
    </form>
  );
}
