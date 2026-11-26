"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/painel", label: "Início" },
  { href: "/painel/funcionalidades", label: "Funcionalidades" },
  { href: "/painel/extras", label: "Extras pagos" },
];
const SOON = ["Viagens", "Viaturas", "Alunos", "Rotas", "Equipa"];

export function SidebarNav({ pendingAddons }: { pendingAddons: number }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map((item) => {
        const active = item.href === "/painel" ? path === item.href : path.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}
            className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
            {item.label}
            {item.href === "/painel/extras" && pendingAddons > 0 && (
              <span className="rounded-full bg-brand-500 px-2 text-xs font-bold text-ink-900">{pendingAddons}</span>
            )}
          </Link>
        );
      })}
      <p className="mt-6 hidden px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 lg:block">Em breve</p>
      {SOON.map((label) => (
        <span key={label} className="hidden px-3 py-2 text-sm text-slate-500 lg:block">{label}</span>
      ))}
    </nav>
  );
}
