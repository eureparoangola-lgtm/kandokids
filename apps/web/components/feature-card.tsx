"use client";

import { useState, useTransition } from "react";
import { MODE_LABELS, formatKz, type Feature, type FeatureMode } from "@kandokids/shared";
import { updateFeature } from "@/app/painel/funcionalidades/actions";

interface Props {
  feature: Feature;
  mode: FeatureMode;
  priceKz: number | null;
  locked: boolean;
  activeSubscribers: number;
  canEdit: boolean;
}

export function FeatureCard({ feature, mode: initialMode, priceKz: initialPrice, locked, activeSubscribers, canEdit }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [price, setPrice] = useState(String(initialPrice ?? feature.suggested_price_kz ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const modes: FeatureMode[] = ["off", ...(feature.allows_included ? ["included" as const] : []), ...(feature.allows_addon ? ["addon" as const] : [])];
  const disabled = locked || !canEdit || pending;
  const priceChanged = mode === "addon" && Number(price) !== Number(initialPrice);

  function save(nextMode: FeatureMode, nextPrice = price) {
    setError(null);
    setSaved(false);
    const previous = mode;
    setMode(nextMode);
    startTransition(async () => {
      const result = await updateFeature({
        key: feature.key,
        mode: nextMode,
        priceKz: nextPrice === "" ? null : Number(nextPrice),
      });
      if (result.error) {
        setMode(previous);
        setError(result.error);
      } else {
        setSaved(true);
      }
    });
  }

  return (
    <article className={`rounded-xl border bg-white p-4 transition ${mode === "off" ? "border-slate-200" : "border-ink-700/30 shadow-sm"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
            {feature.name_pt}
            {locked && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600" title="Gerido pela Kandokids">
                🔒 Bloqueado pela Kandokids
              </span>
            )}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{feature.description_pt}</p>
          {mode === "addon" && (
            <p className="mt-2 text-xs text-slate-500">
              {activeSubscribers === 1 ? "1 encarregado subscreve" : `${activeSubscribers} encarregados subscrevem`} este extra.
            </p>
          )}
        </div>

        <div role="radiogroup" aria-label={`Modo de ${feature.name_pt}`}
          className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {modes.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={disabled}
              onClick={() => m !== mode && save(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
                mode === m
                  ? m === "off" ? "bg-white text-slate-700 shadow-sm" : m === "included" ? "bg-ink-900 text-white shadow-sm" : "bg-brand-500 text-ink-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"}`}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {mode === "addon" && (
        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
          <label className="text-sm">
            <span className="block text-slate-600">Preço mensal para o encarregado</span>
            <span className="mt-1 flex items-center rounded-lg border border-slate-300 focus-within:border-ink-700">
              <input type="number" min={0} step={50} inputMode="numeric" value={price} disabled={disabled}
                onChange={(e) => { setPrice(e.target.value); setSaved(false); }}
                className="w-28 rounded-lg px-3 py-1.5 outline-none" />
              <span className="pr-3 text-slate-500">Kz</span>
            </span>
          </label>
          {priceChanged && (
            <button type="button" disabled={disabled} onClick={() => save("addon", price)}
              className="rounded-lg bg-ink-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-60">
              Guardar preço
            </button>
          )}
          {feature.suggested_price_kz !== null && (
            <span className="text-xs text-slate-500">Sugestão: {formatKz(feature.suggested_price_kz)}/mês</span>
          )}
        </div>
      )}

      <div aria-live="polite" className="text-sm">
        {pending && <p className="mt-2 text-slate-500">A guardar…</p>}
        {saved && !pending && <p className="mt-2 text-green-700">Guardado ✓</p>}
        {error && <p className="mt-2 text-red-700">{error}</p>}
      </div>
    </article>
  );
}
