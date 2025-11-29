"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

type AdminLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
};

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/organizadores", label: "Organizadores" },
  { href: "/admin/eventos", label: "Eventos" },
  { href: "/admin/tickets", label: "Bilhetes" },
  { href: "/admin/payments", label: "Pagamentos" },
  { href: "/admin/settings", label: "Configurações" },
];

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="orya-body-bg min-h-screen text-white pb-16">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-xs font-extrabold tracking-[0.15em]">
              AD
            </span>
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Admin</p>
              <p className="text-sm text-white/85">{title}</p>
              {subtitle && <p className="text-[11px] text-white/60">{subtitle}</p>}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl px-5 pt-6 gap-6">
        <nav className="hidden flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-[12px] text-white/80 backdrop-blur md:flex">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-3 py-2 transition ${
                  active ? "bg-gradient-to-r from-[#FF00C8] via-[#6BFFFF] to-[#1646F5] text-black font-semibold" : "hover:bg-white/10"
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
