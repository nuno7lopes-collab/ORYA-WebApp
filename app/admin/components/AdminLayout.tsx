"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { useUser } from "@/app/hooks/useUser";
import { cn } from "@/lib/utils";

type AdminLayoutProps = {
  children: ReactNode;
  title: string;
  subtitle?: string;
};

const navGroups = [
  {
    label: "Visão geral",
    items: [{ href: "/admin", label: "Dashboard" }],
  },
  {
    label: "Plataforma",
    items: [
      { href: "/admin/utilizadores", label: "Utilizadores" },
      { href: "/admin/organizacoes", label: "Organizações" },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { href: "/admin/eventos", label: "Eventos" },
      { href: "/admin/tickets", label: "Bilhetes" },
    ],
  },
  {
    label: "Financeiro",
    items: [{ href: "/admin/finance", label: "Financeiro" }],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/audit", label: "Auditoria" },
      { href: "/admin/settings", label: "Configurações" },
      { href: "/admin/infra", label: "Infra" },
    ],
  },
];

const navItemClass = (active: boolean) =>
  cn(
    "flex items-center justify-between rounded-xl px-3 py-2 text-[12px] transition border border-transparent",
    active
      ? "bg-white/10 text-white font-semibold border-white/20 shadow-[0_12px_24px_rgba(4,8,16,0.35)]"
      : "text-white/70 hover:bg-white/8 hover:text-white",
  );

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
  useEffect(() => {
    const prev = document.body.getAttribute("data-nav-hidden");
    document.body.setAttribute("data-nav-hidden", "true");
    return () => {
      if (prev) {
        document.body.setAttribute("data-nav-hidden", prev);
      } else {
        document.body.removeAttribute("data-nav-hidden");
      }
    };
  }, []);

  const pathname = usePathname();
  const [hydratedPathname, setHydratedPathname] = useState<string | null>(null);
  const { profile, user } = useUser();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mfaGate, setMfaGate] = useState<{
    loading: boolean;
    required: boolean;
    verified: boolean;
    reason?: string | null;
  }>({ loading: true, required: false, verified: true, reason: null });
  const adminName = profile?.fullName || profile?.username || user?.email || "Admin ORYA";
  const adminEmail = user?.email || null;
  const avatarUrl = profile?.avatarUrl ?? null;

  useEffect(() => {
    setHydratedPathname(pathname ?? null);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/mfa/session", { cache: "no-store" });
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (json?.ok) {
          setMfaGate({
            loading: false,
            required: Boolean(json.data?.required),
            verified: Boolean(json.data?.verified),
            reason: json.data?.reason ?? null,
          });
          return;
        }
      } catch {
        // ignore
      }
      if (!cancelled) {
        setMfaGate({ loading: false, required: false, verified: true, reason: null });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const navItems = useMemo(() => navGroups.flatMap((group) => group.items), []);
  const activePath = hydratedPathname ?? "";
  const mfaBlocking = mfaGate.required && !mfaGate.verified;

  useEffect(() => {
    if (!mfaBlocking) return;
    if (activePath === "/admin/mfa") return;
    if (typeof window === "undefined") return;
    const next = activePath && activePath !== "/admin" ? `?redirectTo=${encodeURIComponent(activePath)}` : "";
    window.location.href = `/admin/mfa${next}`;
  }, [mfaBlocking, activePath]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (err) {
      console.warn("[admin] logout falhou", err);
    } finally {
      window.location.href = "/login?logout=1";
    }
  }, [loggingOut]);

  return (
    <div className="admin-shell relative min-h-screen text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(120,160,255,0.18),transparent_52%),radial-gradient(circle_at_88%_14%,rgba(140,255,214,0.12),transparent_55%),linear-gradient(160deg,rgba(7,10,18,0.98),rgba(10,14,23,0.96))]" />
        <div className="admin-grid absolute inset-0 opacity-50" />
      </div>

      <header className="relative z-20 border-b border-white/10 bg-[rgba(8,12,20,0.82)] backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
          <Link href="/admin" className="flex items-center gap-3 text-white/90 hover:text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-sm font-semibold">
              OR
            </span>
            <div className="hidden sm:block">
              <p className="text-[11px] uppercase tracking-[0.24em] text-white/50">Admin Console</p>
              <p className="text-sm font-semibold text-white/90">ORYA Platform</p>
            </div>
          </Link>

          <nav className="hidden lg:flex flex-wrap items-center gap-1">
            {navItems.map((item) => {
              const active = activePath === item.href || activePath.startsWith(`${item.href}/`);
              return (
                <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={navItemClass(active)}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <details className="relative lg:hidden">
              <summary className="list-none cursor-pointer rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-[12px] text-white/80 shadow-[0_10px_30px_rgba(0,0,0,0.3)]">
                Menu ▾
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-2xl orya-menu-surface p-2 backdrop-blur-2xl">
                {navGroups.map((group) => (
                  <div key={group.label} className="space-y-2 py-2">
                    <p className="px-2 text-[10px] uppercase tracking-[0.2em] text-white/45">{group.label}</p>
                    <div className="orya-menu-list">
                      {group.items.map((item) => {
                        const active = activePath === item.href || activePath.startsWith(`${item.href}/`);
                        return (
                          <Link key={item.href} href={item.href} className={navItemClass(active)}>
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </details>

            <details className="relative">
              <summary className="list-none cursor-pointer rounded-full border border-white/15 bg-white/5 px-2 py-1.5 text-sm text-white/80 shadow-[0_12px_38px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-2">
                  <Avatar
                    src={avatarUrl}
                    name={adminName}
                    className="h-8 w-8 rounded-full border border-white/10"
                    textClassName="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80"
                    fallbackText="AD"
                  />
                  <span className="hidden text-[12px] text-white/70 md:inline">{adminName}</span>
                  <span className="text-white/50">▾</span>
                </div>
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-2xl orya-menu-surface p-2 backdrop-blur-2xl">
                <div className="px-2 pb-2">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-white/50">Conta</p>
                  <p className="mt-2 truncate text-sm font-semibold text-white/90">{adminName}</p>
                  {adminEmail && <p className="truncate text-[12px] text-white/60">{adminEmail}</p>}
                </div>
                <div className="border-t border-[var(--orya-menu-divider)] pt-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[12px] text-rose-100 transition hover:bg-rose-500/15"
                  >
                    <span>{loggingOut ? "A terminar sessão…" : "Terminar sessão"}</span>
                    <span className="text-[10px] text-rose-200">×</span>
                  </button>
                </div>
              </div>
            </details>
          </div>
        </div>

        <div className="px-4 pb-3 md:hidden">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Admin</p>
          <p className="text-sm font-semibold text-white/90 leading-tight">{title}</p>
          {subtitle && <p className="text-[11px] text-white/55">{subtitle}</p>}
        </div>
      </header>

      {mfaBlocking && activePath === "/admin/mfa" && (
        <div className="relative z-20 border-b border-amber-400/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          2FA obrigatório para aceder ao admin. Finaliza a verificação abaixo para continuar.
        </div>
      )}

      <main className="relative z-10 w-full px-1 pb-14 pt-6 md:px-2">
        <div className="relative isolate overflow-hidden">{children}</div>
      </main>
    </div>
  );
}
