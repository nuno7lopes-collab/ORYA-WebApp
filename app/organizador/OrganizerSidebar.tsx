"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

const baseTabHref = (tab: string) => `/organizador?tab=${tab}`;

type Props = {
  organizerName?: string | null;
  organizerAvatarUrl?: string | null;
};

export function OrganizerSidebar({ organizerName, organizerAvatarUrl }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") || "overview";
  const [catsOpen, setCatsOpen] = useState(() => ["padel", "restaurants", "volunteer", "night"].includes(tabParam));

  const linkClass = (active: boolean) =>
    `flex items-center justify-between rounded-xl px-3 py-2 transition ${
      active ? "bg-white/10 text-white font-semibold border border-white/20" : "hover:bg-white/10"
    }`;

  const isTab = (tab: string) => pathname === "/organizador" && tabParam === tab;
  const isCreateEvent = pathname?.startsWith("/organizador/eventos/novo");
  const isEventDetail = pathname?.startsWith("/organizador/eventos/") && !isCreateEvent;

  const categoryLinks = useMemo(
    () => [
      { key: "padel", label: "Padel", soon: false },
      { key: "restaurants", label: "Restaurantes", soon: true },
      { key: "volunteer", label: "Solidário", soon: true },
      { key: "night", label: "Festas", soon: true },
    ],
    [],
  );

  return (
    <aside className="hidden lg:flex w-60 shrink-0 flex-col gap-2 border-r border-white/10 bg-black/40 backdrop-blur-xl px-4 py-6 text-[13px] text-white/80 shadow-[0_18px_60px_rgba(0,0,0,0.55)] sticky top-0 h-screen overflow-y-auto">
      <div className="flex items-center gap-2 px-2">
        <div className="h-9 w-9 rounded-2xl bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1224] flex items-center justify-center text-xs font-black tracking-[0.2em] text-[#6BFFFF] shadow-[0_0_14px_rgba(107,255,255,0.3)] overflow-hidden border border-white/10">
          {organizerAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={organizerAvatarUrl} alt={organizerName || "Organizador"} className="h-full w-full object-cover" />
          ) : (
            "OY"
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/50">Dashboard</p>
          <p className="text-sm font-semibold text-white">{organizerName || "Organizador"}</p>
        </div>
      </div>
      <nav className="mt-4 space-y-1">
        <p className="px-2 text-[10px] uppercase tracking-[0.25em] text-white/40">Operação</p>
        <Link href={baseTabHref("overview")} className={linkClass(isTab("overview") || pathname === "/organizador")}>
          <span>Resumo</span>
        </Link>
        <Link
          href={baseTabHref("events")}
          className={linkClass(isTab("events") || (isEventDetail && !isCreateEvent))}
        >
          <span>Eventos</span>
        </Link>
        <Link
          href="/organizador/eventos/novo"
          className={linkClass(isCreateEvent || pathname.endsWith("/edit"))}
          data-tour="criar-evento"
        >
          <span>Criar evento</span>
        </Link>
        <Link href={baseTabHref("sales")} className={linkClass(isTab("sales"))}>
          <span>Bilhetes & Vendas</span>
        </Link>
        <Link href={baseTabHref("finance")} className={linkClass(isTab("finance"))} data-tour="finance">
          <span>Finanças</span>
        </Link>
        <Link href="/organizador/pagamentos/invoices" className={linkClass(pathname.startsWith("/organizador/pagamentos/invoices"))}>
          <span>Faturação</span>
        </Link>
        <Link href={baseTabHref("marketing")} className={linkClass(isTab("marketing"))} data-tour="marketing">
          <span>Marketing</span>
        </Link>

        <div className="space-y-1 pt-1 border-t border-white/10">
          <button
            type="button"
            onClick={() => setCatsOpen((p) => !p)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 transition ${
              catsOpen ? "text-white font-semibold" : "text-white/80 hover:bg-white/10"
            }`}
          >
            <span>Categorias</span>
            <span className="text-[10px] ml-1">{catsOpen ? "▲" : "▼"}</span>
          </button>
          {catsOpen && (
            <div className="ml-3 space-y-1">
              {categoryLinks.map((cat) => (
                <Link
                  key={cat.key}
                  href={baseTabHref(cat.key)}
                  className={linkClass(isTab(cat.key))}
                >
                  <span>{cat.label}</span>
                  {cat.soon && <span className="rounded-full bg-amber-300/20 px-2 py-[2px] text-[10px] text-amber-100">Em breve</span>}
                </Link>
              ))}
              <div className="h-px w-full bg-white/10" />
            </div>
          )}
        </div>

        <p className="px-2 pt-2 text-[10px] uppercase tracking-[0.25em] text-white/40">Estrutura</p>
        <Link href={baseTabHref("staff")} className={linkClass(isTab("staff") || pathname.startsWith("/organizador/staff"))}>
          <span>Staff</span>
        </Link>
        <Link href={baseTabHref("settings")} className={linkClass(isTab("settings") || pathname.startsWith("/organizador/settings"))}>
          <span>Definições</span>
        </Link>
      </nav>
    </aside>
  );
}
