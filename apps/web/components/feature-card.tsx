"use client";

import { useState, useTransition } from "react";
import type { Feature, FeatureMode } from "@kandokids/shared";
import { updateFeature } from "@/app/painel/funcionalidades/actions";

interface Props {
  feature: Feature;
  mode: FeatureMode;
  locked: boolean;
  canEdit: boolean;
}

const LABELS: Record<"off" | "included", string> = { off: "Desligado", included: "Ativo" };

export function FeatureCard({ feature, mode: initialMode, locked, canEdit }: Props) {
  const [mode, setMode] = useState(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const disabled = locked || !canEdit || pending;

  function save(next: "off" | "included") {
    setError(null);
    setSaved(false);
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const result = await updateFeature({ key: feature.key, mode: next });
      if (result.error) {
        setMode(previous);
        setError(result.error);
      } else setSaved(true);
    });
  }

  return (
    <article className={`rounded-xl border bg-white p-4 transition ${mode === "off" ? "border-slate-200" : "border-ink-700/30 shadow-sm"}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
            {feature.name_pt}
            {locked && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">🔒 Gerido pela Kandokids</span>}
          </h3>
          <p className="mt-1 text-sm text-slate-600">{feature.description_pt}</p>
        </div>
        <div role="radiogroup" aria-label={`Estado de ${feature.name_pt}`} className="flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(["off", "included"] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} disabled={disabled} onClick={() => m !== mode && save(m)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed ${
                mode === m ? (m === "off" ? "bg-white text-slate-700 shadow-sm" : "bg-ink-900 text-white shadow-sm") : "text-slate-500 hover:text-slate-800"}`}>
              {LABELS[m]}
            </button>
          ))}
        </div>
      </div>
      <div aria-live="polite" className="text-sm">
        {pending && <p className="mt-2 text-slate-500">A guardar…</p>}
        {saved && !pending && <p className="mt-2 text-green-700">Guardado ✓</p>}
        {error && <p className="mt-2 text-red-700">{error}</p>}
      </div>
    </article>
  );
}
