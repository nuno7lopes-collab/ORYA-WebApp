"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { CTA_PRIMARY } from "@/app/organizacao/dashboardUi";

type AdminLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
};

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/organizacoes", label: "Organizações" },
  { href: "/admin/eventos", label: "Eventos" },
  { href: "/admin/tickets", label: "Bilhetes" },
  { href: "/admin/payments", label: "Pagamentos" },
  { href: "/admin/refunds", label: "Refunds" },
  { href: "/admin/settings", label: "Configurações" },
];

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="min-h-screen text-white pb-16">
      <header className="border-b border-white/10 bg-gradient-to-r from-black/70 via-[#0c1224]/70 to-black/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-[11px] font-extrabold tracking-[0.15em] shadow-[0_10px_40px_rgba(0,0,0,0.45)]">
              AD
            </span>
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/60">Admin</p>
              <p className="text-base font-semibold text-white/90 leading-tight">{title}</p>
              {subtitle && <p className="text-[12px] text-white/65">{subtitle}</p>}
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[12px] text-white/70 md:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" aria-hidden />
            <span>Sessão administrativa ativa</span>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-3 md:hidden">
          <div className="flex gap-2 overflow-x-auto pb-1 text-[12px]">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full transition ${
                    active
                      ? `${CTA_PRIMARY} px-3 py-1.5 text-[12px]`
                      : "border border-white/15 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-5 pt-6">
        <nav className="sticky top-6 hidden h-fit w-56 flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-white/80 backdrop-blur md:flex">
          <p className="px-1 text-[11px] uppercase tracking-[0.18em] text-white/50">
            Navegação
          </p>
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl text-[13px] transition ${
                  active
                    ? `${CTA_PRIMARY} px-3 py-2 text-[13px]`
                    : "border border-transparent px-3 py-2 hover:border-white/10 hover:bg-white/5"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}
