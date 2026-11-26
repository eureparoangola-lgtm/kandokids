export function Stat({ label, value, hint, highlight = false }: { label: string; value: string | number; hint?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-brand-400 bg-brand-50" : "border-slate-200 bg-white"}`}>
      <p className="text-3xl font-bold text-ink-900">{value}</p>
      <p className="text-sm text-slate-600">{label}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
