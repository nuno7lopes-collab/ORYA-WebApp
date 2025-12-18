"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { DASHBOARD_LABEL } from "./dashboardUi";

const baseTabHref = (tab: string) => `/organizador?tab=${tab}`;

type Props = {
  organizerName?: string | null;
  organizerAvatarUrl?: string | null;
};

export function OrganizerSidebar({ organizerName, organizerAvatarUrl }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") || "overview";
  const allowedTabs = ["overview", "events", "sales", "finance", "invoices", "marketing", "padel", "staff", "settings"] as const;
  const tabParam = allowedTabs.includes(tabParamRaw as any) ? tabParamRaw : "overview";
  const [catsOpen, setCatsOpen] = useState(true);

  const linkClass = (active: boolean) =>
    `flex items-center justify-between rounded-xl px-3 py-2 transition ${
      active ? "bg-white/10 text-white font-semibold border border-white/20" : "hover:bg-white/10"
    }`;

  const currentKey = (() => {
    if (pathname?.startsWith("/organizador/pagamentos/invoices")) return "invoices";
    if (pathname?.startsWith("/organizador/eventos/novo") || pathname?.endsWith("/edit")) return "create";
    if (pathname?.startsWith("/organizador/eventos/")) return "events";
    if (pathname?.startsWith("/organizador/staff")) return "staff";
    if (pathname?.startsWith("/organizador/settings")) return "settings";
    if (pathname === "/organizador") return tabParam;
    return tabParam;
  })();

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
          <p className={DASHBOARD_LABEL}>Dashboard</p>
          <p className="text-sm font-semibold text-white">{organizerName || "Organizador"}</p>
        </div>
      </div>
      <nav className="mt-4 space-y-1">
        <p className="px-2 text-[10px] uppercase tracking-[0.25em] text-white/40">Operação</p>
        <Link href={baseTabHref("overview")} className={linkClass(currentKey === "overview")}>
          <span>Resumo</span>
        </Link>
        <Link href={baseTabHref("events")} className={linkClass(currentKey === "events")}>
          <span>Eventos</span>
        </Link>
        <Link
          href="/organizador/eventos/novo"
          className={linkClass(currentKey === "create")}
          data-tour="criar-evento"
        >
          <span>Criar evento</span>
        </Link>
        <Link href={baseTabHref("sales")} className={linkClass(currentKey === "sales")}>
          <span>Vendas</span>
        </Link>
        <Link href={baseTabHref("finance")} className={linkClass(currentKey === "finance")} data-tour="finance">
          <span>Finanças</span>
        </Link>
        <Link href={baseTabHref("invoices")} className={linkClass(currentKey === "invoices")}>
          <span>Faturação</span>
        </Link>
        <Link href={baseTabHref("marketing")} className={linkClass(currentKey === "marketing")} data-tour="marketing">
          <span>Marketing</span>
        </Link>

        <div className="border-t border-white/10 pt-2" />
        <button
          type="button"
          onClick={() => setCatsOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-white/10"
        >
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">Categorias</span>
          <span className="text-white/60">{catsOpen ? "▴" : "▾"}</span>
        </button>
        {catsOpen && (
          <div className="space-y-1">
            <Link href={baseTabHref("padel")} className={linkClass(currentKey === "padel")}>
              <span>Padel</span>
            </Link>
            {[
              { key: "restauracao", label: "Restauração" },
              { key: "solidario", label: "Solidário" },
              { key: "festas", label: "Festas" },
              { key: "outro", label: "Outro tipo" },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-xl px-3 py-2 text-white/60">
                <span>{item.label}</span>
                <span className="rounded-full border border-amber-300/30 bg-amber-400/15 px-2 py-[1px] text-[10px] uppercase tracking-[0.12em] text-amber-100">
                  Em breve
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="px-2 pt-2 text-[10px] uppercase tracking-[0.25em] text-white/40">Estrutura</p>
        <Link href={baseTabHref("staff")} className={linkClass(currentKey === "staff")}>
          <span>Staff</span>
        </Link>
        <Link href={baseTabHref("settings")} className={linkClass(currentKey === "settings")}>
          <span>Definições</span>
        </Link>
      </nav>
    </aside>
  );
}
