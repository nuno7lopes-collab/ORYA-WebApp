"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const baseTabHref = (tab: string) => `/organizador?tab=${tab}`;

export function OrganizerSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") || "overview";

  const items = [
    {
      label: "Resumo",
      href: baseTabHref("overview"),
      isActive: pathname === "/organizador" ? tabParam === "overview" : pathname === "/organizador",
    },
    {
      label: "Eventos",
      href: baseTabHref("events"),
      isActive:
        (pathname === "/organizador" && tabParam === "events") ||
        pathname === "/organizador/eventos",
    },
    {
      label: "Criar evento",
      href: "/organizador/(dashboard)/eventos/novo",
      isActive: pathname.startsWith("/organizador/eventos/novo") || pathname.includes("/organizador/eventos/") && pathname.endsWith("/edit"),
    },
    {
      label: "Bilhetes & Vendas",
      href: baseTabHref("sales"),
      isActive:
        (pathname === "/organizador" && tabParam === "sales") ||
        pathname.startsWith("/organizador/estatisticas"),
    },
    {
      label: "Finanças & Payouts",
      href: baseTabHref("finance"),
      isActive:
        (pathname === "/organizador" && tabParam === "finance") ||
        pathname.startsWith("/organizador/pagamentos"),
    },
    {
      label: "Marketing",
      href: baseTabHref("marketing"),
      isActive:
        (pathname === "/organizador" && tabParam === "marketing") ||
        pathname.startsWith("/organizador/promo"),
    },
    {
      label: "Staff",
      href: "/organizador/(dashboard)/staff",
      isActive: pathname.startsWith("/organizador/staff"),
    },
    {
      label: "Categorias",
      href: "/organizador?tab=events&view=categories",
      isActive:
        pathname.startsWith("/organizador/categorias") ||
        (pathname === "/organizador" && tabParam === "events" && searchParams?.get("view") === "categories"),
    },
    {
      label: "Definições",
      href: "/organizador/settings",
      isActive: pathname.startsWith("/organizador/settings"),
    },
  ];

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col gap-2 border-r border-white/10 bg-black/40 backdrop-blur-xl px-4 py-6 text-[13px] text-white/80 shadow-[0_18px_60px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-2 px-2">
        <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1224] flex items-center justify-center text-xs font-black tracking-[0.2em] text-[#6BFFFF] shadow-[0_0_14px_rgba(107,255,255,0.3)]">
          OY
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">Dashboard</p>
          <p className="text-sm font-semibold text-white">Organizador</p>
        </div>
      </div>
      <nav className="mt-4 space-y-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-xl px-3 py-2 transition ${
              item.isActive ? "bg-white/10 text-white font-semibold border border-white/20" : "hover:bg-white/10"
            }`}
          >
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
