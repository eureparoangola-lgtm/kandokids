"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/plataforma", label: "Visão geral" },
  { href: "/plataforma/empresas", label: "Empresas" },
  { href: "/plataforma/encarregados", label: "Encarregados" },
  { href: "/plataforma/extras", label: "Extras" },
  { href: "/plataforma/definicoes", label: "Definições" },
];

export function PlatformNav({ pendingExtras }: { pendingExtras: number }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {ITEMS.map((item) => {
        const active = item.href === "/plataforma" ? path === item.href : path.startsWith(item.href);
        return (
          <Link key={item.href} href={item.href}
            className={`flex shrink-0 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"}`}>
            {item.label}
            {item.href === "/plataforma/extras" && pendingExtras > 0 && (
              <span className="rounded-full bg-brand-500 px-2 text-xs font-bold text-ink-900">{pendingExtras}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
