"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/painel", label: "Início" },
  { href: "/painel/alunos", label: "Alunos" },
  { href: "/painel/viaturas", label: "Viaturas" },
  { href: "/painel/rotas", label: "Rotas" },
  { href: "/painel/equipa", label: "Equipa" },
  { href: "/painel/funcionalidades", label: "Funcionalidades" },
];

export function SidebarNav() {
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
          </Link>
        );
      })}
    </nav>
  );
}
