"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SidebarRail, useSidebar } from "@/components/ui/sidebar";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { cn } from "@/lib/utils";

type OrgOption = {
  organizerId: number;
  role: string;
  organizer: {
    id: number;
    username: string | null;
    publicName?: string | null;
    displayName: string | null;
    businessName: string | null;
    city: string | null;
    entityType: string | null;
    status: string | null;
    brandingAvatarUrl?: string | null;
  };
};

type ActiveOrg = {
  id: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
};

type UserInfo = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

const baseTabHref = (tab: string) => {
  if (tab === "settings") return "/organizador/settings";
  return `/organizador?tab=${tab}`;
};

function buildNav(currentKey: string) {
  const linkClass = (key: string) =>
    cn(
      "flex items-center justify-between rounded-xl px-3 py-2 transition border border-transparent text-sm",
      currentKey === key
        ? "bg-white/10 text-white font-semibold border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        : "text-white/75 hover:bg-white/10 hover:text-white",
    );

  return {
    linkClass,
  };
}

export function AppSidebar({
  activeOrg,
  orgOptions,
  user,
}: {
  activeOrg: ActiveOrg | null;
  orgOptions: OrgOption[];
  user: UserInfo | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParamRaw = searchParams?.get("tab") || "overview";
  const allowedTabs = ["overview", "events", "sales", "finance", "invoices", "marketing", "padel", "staff", "settings"] as const;
  const tabParam = allowedTabs.includes(tabParamRaw as any) ? tabParamRaw : "overview";
  const [catsOpen, setCatsOpen] = useState(true);
  const [orgOpen, setOrgOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [switchingOrgId, setSwitchingOrgId] = useState<number | null>(null);

  const currentKey = useMemo(() => {
    if (pathname?.startsWith("/organizador/pagamentos/invoices")) return "invoices";
    if (pathname?.startsWith("/organizador/eventos/novo") || pathname?.endsWith("/edit")) return "create";
    if (pathname?.startsWith("/organizador/eventos/")) return "events";
    if (pathname?.startsWith("/organizador/staff")) return "staff";
    if (pathname?.startsWith("/organizador/settings")) return "settings";
    if (pathname === "/organizador") return tabParam;
    return tabParam;
  }, [pathname, tabParam]);

  const { linkClass } = buildNav(currentKey);

  const orgDisplay = activeOrg?.name ?? "Organização";
  const orgAvatar = activeOrg?.avatarUrl ?? null;

  const switchOrg = (orgId: number) => {
    setSwitchingOrgId(orgId);
    try {
      document.cookie = `orya_org=${orgId}; path=/; SameSite=Lax`;
    } catch {
      /* ignore */
    }
    setOrgOpen(false);
    router.replace(`/organizador?tab=overview&org=${orgId}`);
    router.refresh();
  };

  const goUserMode = () => {
    try {
      document.cookie = "orya_org=; path=/; Max-Age=0; SameSite=Lax";
    } catch {
      /* ignore */
    }
    setUserOpen(false);
    router.push("/me");
  };

  const signOut = async () => {
    try {
      await supabaseBrowser.auth.signOut();
    } catch (err) {
      console.error("Erro no signOut", err);
    } finally {
      router.push("/login");
    }
  };

  const userLabel = user?.name || user?.email || "Utilizador";
  const userInitial = (userLabel || "U").charAt(0).toUpperCase();

  const orgList = orgOptions ?? [];
  const orgCurrent = orgList.find((o) => o.organizerId === activeOrg?.id) ?? orgList[0] ?? null;

  const { width } = useSidebar();

  return (
    <>
      <SidebarRail>
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="h-10 w-10 overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1224] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
          {orgAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={orgAvatar} alt={orgDisplay} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-black tracking-[0.18em] text-[#6BFFFF]">
              OY
            </div>
          )}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">Dashboard</p>
          <p className="text-sm font-semibold text-white">{orgDisplay}</p>
        </div>
      </div>

      {/* Organização switcher */}
      <div className="px-3" data-tour="org-switcher">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-xl">
          <button
            type="button"
            data-tour="org-switcher-button"
            onClick={() => setOrgOpen((v) => !v)}
            aria-expanded={orgOpen}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2">
              {orgCurrent?.organizer.brandingAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={orgCurrent.organizer.brandingAvatarUrl}
                  alt={orgCurrent.organizer.displayName || "Organização"}
                  className="h-8 w-8 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold">
                  {(orgCurrent?.organizer.publicName ||
                    orgCurrent?.organizer.displayName ||
                    orgCurrent?.organizer.businessName ||
                    "O")[0]}
                </span>
              )}
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Organização</p>
                <p className="text-sm font-semibold text-white">
                  {orgCurrent?.organizer.publicName ||
                    orgCurrent?.organizer.displayName ||
                    orgCurrent?.organizer.businessName ||
                    "Selecionar"}
                </p>
              </div>
            </div>
            <span className={cn("text-white/60 transition-transform", orgOpen ? "rotate-180" : "")}>▾</span>
          </button>
          {orgOpen && (
            <div className="mt-2 space-y-1">
              {orgList.map((item) => {
                const isActive = item.organizerId === orgCurrent?.organizerId;
                const isSwitching = switchingOrgId === item.organizerId;
                return (
                  <button
                    key={item.organizerId}
                    type="button"
                    disabled={isSwitching}
                    onClick={() => switchOrg(item.organizerId)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition",
                      isActive ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/10",
                      isSwitching && "opacity-70 cursor-progress",
                    )}
                  >
                    <span className="text-left">
                      {item.organizer.publicName || item.organizer.displayName || item.organizer.businessName}
                    </span>
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]">
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-[1px] text-white/70">
                        {item.role}
                      </span>
                      {isActive && <span className="text-emerald-200">ativo</span>}
                    </div>
                  </button>
                );
              })}
              <Link
                href="/organizador/become"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white/80 transition hover:bg-white/10"
                onClick={() => setOrgOpen(false)}
              >
                <span>Adicionar organização</span>
                <span className="text-[10px] text-white/60">+</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Navegação */}
      <nav className="mt-6 flex-1 space-y-3 px-3 text-sm">
        <p className="px-2 text-[10px] uppercase tracking-[0.24em] text-white/45">Operação</p>
        <Link href={baseTabHref("overview")} className={linkClass("overview")} data-tour="overview">
          <span>Resumos</span>
        </Link>
        <Link href={baseTabHref("events")} className={linkClass("events")}>
          <span>Eventos</span>
        </Link>
        <Link href="/organizador/eventos/novo" className={linkClass("create")} data-tour="criar-evento">
          <span>Criar Evento</span>
        </Link>
        <Link href={baseTabHref("sales")} className={linkClass("sales")}>
          <span>Vendas</span>
        </Link>
        <Link href={baseTabHref("finance")} className={linkClass("finance")} data-tour="finance">
          <span>Finanças</span>
        </Link>
        <Link href={baseTabHref("invoices")} className={linkClass("invoices")}>
          <span>Faturação</span>
        </Link>
        <Link href={baseTabHref("marketing")} className={linkClass("marketing")} data-tour="marketing">
          <span>Marketing</span>
        </Link>

        <div className="border-t border-white/10 pt-3" />
        <button
          type="button"
          onClick={() => setCatsOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[11px] uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/10"
        >
          <span>Categorias</span>
          <span className="text-white/60">{catsOpen ? "▴" : "▾"}</span>
        </button>
        {catsOpen && (
          <div className="space-y-1">
            <Link href={baseTabHref("padel")} className={linkClass("padel")}>
              <span>Padel</span>
            </Link>
            {[
              { key: "restauracao", label: "Restauração" },
              { key: "solidario", label: "Solidário" },
              { key: "festa", label: "Festa" },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-white/65"
              >
                <span>{item.label}</span>
                <span className="rounded-full border border-amber-300/30 bg-amber-400/15 px-2 py-[1px] text-[10px] uppercase tracking-[0.12em] text-amber-100">
                  Em breve
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="px-2 pt-3 text-[10px] uppercase tracking-[0.24em] text-white/45">Estrutura</p>
        <Link href={baseTabHref("staff")} className={linkClass("staff")} data-tour="staff">
          <span>Staff</span>
        </Link>
        <Link href={baseTabHref("settings")} className={linkClass("settings")}>
          <span>Definições</span>
        </Link>
      </nav>

      {/* Rodapé utilizador */}
      <div className="mt-auto space-y-2 px-3 pb-4">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            aria-expanded={userOpen}
            className="flex w-full cursor-pointer items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt={userLabel} className="h-8 w-8 rounded-lg border border-white/10 object-cover" />
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold">
                  {userInitial}
                </span>
              )}
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Utilizador</p>
                <p className="text-sm font-semibold text-white">{userLabel}</p>
              </div>
            </div>
            <span className={cn("text-white/60 transition-transform", userOpen ? "rotate-180" : "")}>▾</span>
          </button>
          {userOpen && (
            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={goUserMode}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white transition hover:bg-white/10"
              >
                <span>Voltar a utilizador</span>
                <span className="text-[10px] text-white/60">↺</span>
              </button>
              <Link
                href="/me/settings"
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-white transition hover:bg-white/10"
                onClick={() => setUserOpen(false)}
              >
                <span>Settings</span>
                <span className="text-[10px] text-white/60">↗</span>
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-rose-100 transition hover:bg-rose-500/15"
              >
                <span>Terminar sessão</span>
                <span className="text-[10px] text-rose-200">×</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </SidebarRail>
    </>
  );
}
