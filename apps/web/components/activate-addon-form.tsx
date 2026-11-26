"use client";

import { useActionState } from "react";
import { formatKz } from "@kandokids/shared";
import { activateAddon } from "@/app/painel/extras/actions";

export function ActivateAddonForm({ addonId, monthlyKz }: { addonId: string; monthlyKz: number }) {
  const [state, action, pending] = useActionState(activateAddon, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="addon_id" value={addonId} />
      <label className="text-xs text-slate-600">
        Meses
        <select name="months" defaultValue="1" className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
          {[1, 3, 6, 12].map((m) => (
            <option key={m} value={m}>{m} {m === 1 ? "mês" : "meses"} · {formatKz(monthlyKz * m)}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-600">
        Referência do pagamento
        <input name="reference" placeholder="ex.: MCX-123456" className="mt-1 block w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
      </label>
      <button disabled={pending} className="rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60">
        {pending ? "A ativar…" : "Confirmar pagamento"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}
