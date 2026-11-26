export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span className="grid size-8 place-items-center rounded-lg bg-brand-500 text-ink-900" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
          <path d="M4 16V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v9a2 2 0 0 1-1 1.73V19a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H8v1a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-1.27A2 2 0 0 1 4 16Zm2-8v4h12V8H6Zm1.5 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
        </svg>
      </span>
      Kandokids
    </span>
  );
}
