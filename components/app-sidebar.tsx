"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { SidebarRail } from "@/components/ui/sidebar";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { cn } from "@/lib/utils";
import { CTA_PRIMARY } from "@/app/organizador/dashboardUi";

type OrgOption = {
  organizerId: number;
  role: string;
  organizer: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    entityType: string | null;
    organizationKind?: string | null;
    organizationCategory?: string | null;
    status: string | null;
    brandingAvatarUrl?: string | null;
  };
};

type ActiveOrg = {
  id: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  organizationKind?: string | null;
  organizationCategory?: string | null;
};

type UserInfo = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

type ObjectiveTab = "create" | "manage" | "promote" | "analyze";
type OrgCategory = "EVENTOS" | "PADEL" | "VOLUNTARIADO";

const OBJECTIVE_TABS = ["create", "manage", "promote", "analyze"] as const;

const baseTabHref = (tab: ObjectiveTab) =>
  tab === "create" ? "/organizador?tab=overview" : `/organizador?tab=${tab}`;

const mapTabToObjective = (tab?: string | null): ObjectiveTab => {
  if (OBJECTIVE_TABS.includes((tab as ObjectiveTab) || "create")) {
    return (tab as ObjectiveTab) || "create";
  }
  switch (tab) {
    case "overview":
      return "create";
    case "events":
    case "padel":
    case "staff":
      return "manage";
    case "marketing":
      return "promote";
    case "sales":
    case "finance":
    case "invoices":
      return "analyze";
    default:
      return "create";
  }
};

const normalizeOrganizationCategory = (category?: string | null): OrgCategory => {
  const normalized = category?.toUpperCase() ?? "";
  if (normalized === "PADEL") return "PADEL";
  if (normalized === "VOLUNTARIADO") return "VOLUNTARIADO";
  return "EVENTOS";
};

const CATEGORY_LABELS: Record<OrgCategory, string> = {
  EVENTOS: "Eventos",
  PADEL: "Padel",
  VOLUNTARIADO: "Voluntariado",
};

const CATEGORY_CTA: Record<OrgCategory, { label: string; href: string }> = {
  EVENTOS: { label: "Criar evento", href: "/organizador/eventos/novo" },
  PADEL: { label: "Criar evento", href: "/organizador/eventos/novo?preset=padel" },
  VOLUNTARIADO: { label: "Criar evento", href: "/organizador/eventos/novo?preset=voluntariado" },
};

function buildNav() {
  const linkClass = (active: boolean) =>
    cn(
      "flex items-center justify-between rounded-xl px-3 py-2 transition border border-transparent text-sm",
      active
        ? "bg-white/10 text-white font-semibold border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        : "text-white/75 hover:bg-white/10 hover:text-white",
    );

  const subLinkClass = (active: boolean) =>
    cn(
      "flex items-center justify-between rounded-xl px-3 py-2 transition border border-transparent text-sm",
      active
        ? "bg-white/10 text-white font-semibold border-white/20 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
        : "text-white/75 hover:bg-white/10 hover:text-white",
    );

  return {
    linkClass,
    subLinkClass,
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
  const tabParamRaw = searchParams?.get("tab");
  const tabParam = mapTabToObjective(tabParamRaw);
  const [orgOpen, setOrgOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [switchingOrgId, setSwitchingOrgId] = useState<number | null>(null);

  const currentObjective = useMemo(() => {
    if (pathname?.startsWith("/organizador/updates")) return "promote";
    if (pathname?.startsWith("/organizador/inscricoes")) return "manage";
    if (pathname?.startsWith("/organizador/calendario")) return "manage";
    if (pathname?.startsWith("/organizador/scan")) return "manage";
    if (pathname?.startsWith("/organizador/staff")) return "manage";
    if (pathname?.startsWith("/organizador/settings")) return "manage";
    if (pathname?.startsWith("/organizador/faturacao")) return "analyze";
    if (pathname?.startsWith("/organizador/pagamentos/invoices")) return "analyze";
    if (pathname?.startsWith("/organizador/tournaments/") && pathname?.endsWith("/finance")) return "analyze";
    if (pathname?.startsWith("/organizador/tournaments/")) return "manage";
    if (pathname?.startsWith("/organizador/eventos/novo") || pathname?.startsWith("/organizador/padel/torneios/novo")) return "create";
    if (pathname?.startsWith("/organizador/eventos/")) return "manage";
    if (pathname?.startsWith("/organizador/padel")) return "manage";
    if (pathname === "/organizador") return tabParam;
    return tabParam;
  }, [pathname, tabParam]);

  const currentSubKey = useMemo(() => {
    if (pathname?.startsWith("/organizador/updates")) return "updates";
    if (pathname?.startsWith("/organizador/staff")) return "staff";
    if (pathname?.startsWith("/organizador/settings")) return "settings";
    return null;
  }, [pathname]);

  const { linkClass, subLinkClass } = buildNav();

  const orgDisplay = activeOrg?.name ?? "Organização";
  const orgAvatar = activeOrg?.avatarUrl ?? null;

  const switchOrg = async (orgId: number) => {
    if (switchingOrgId) return;
    setSwitchingOrgId(orgId);
    try {
      const res = await fetch("/api/organizador/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizerId: orgId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        console.warn("[org switch] falhou", json?.error ?? res.statusText);
        return;
      }
      try {
        document.cookie = `orya_org=${orgId}; path=/; SameSite=Lax`;
      } catch {
        /* ignore */
      }
      setOrgOpen(false);
      router.replace(`/organizador?tab=overview&org=${orgId}`);
      router.refresh();
    } catch (err) {
      console.error("[org switch] erro inesperado", err);
    } finally {
      setSwitchingOrgId(null);
    }
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
  const orgButtonAvatar = orgCurrent?.organizer.brandingAvatarUrl || orgAvatar;
  const orgCategoryValue =
    orgCurrent?.organizer.organizationCategory ?? activeOrg?.organizationCategory ?? null;
  const orgCategory = normalizeOrganizationCategory(orgCategoryValue);
  const categoryLabel = CATEGORY_LABELS[orgCategory];
  const categoryCta = CATEGORY_CTA[orgCategory];

  return (
    <>
      <SidebarRail>
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
              {orgButtonAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={orgButtonAvatar}
                  alt={orgCurrent?.organizer.publicName || orgDisplay || "Organização"}
                  className="h-8 w-8 rounded-lg border border-white/10 object-cover"
                />
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-semibold">
                  {(orgCurrent?.organizer.publicName || orgCurrent?.organizer.businessName || "O")[0]}
                </span>
              )}
              <div className="text-left">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/50">Organização</p>
                <p className="text-sm font-semibold text-white">
                  {orgCurrent?.organizer.publicName ||
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
                      {item.organizer.publicName || item.organizer.businessName}
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
        <div className="rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm text-white/80 backdrop-blur-xl">
          <p className="text-[10px] uppercase tracking-[0.24em] text-white/55">Categoria ativa</p>
          <p className="text-sm font-semibold text-white">{categoryLabel}</p>
        </div>

        <Link
          href={categoryCta.href}
          className={cn(CTA_PRIMARY, "w-full justify-center")}
          data-tour="criar-evento"
        >
          {categoryCta.label}
        </Link>

        <p className="px-2 pt-2 text-[10px] uppercase tracking-[0.24em] text-white/45">Objetivo</p>
        <Link href={baseTabHref("create")} className={linkClass(currentObjective === "create")} data-tour="overview">
          <span>Resumo</span>
        </Link>
        <Link href={baseTabHref("manage")} className={linkClass(currentObjective === "manage")}>
          <span>Gerir</span>
        </Link>
        <Link href={baseTabHref("promote")} className={linkClass(currentObjective === "promote")} data-tour="marketing">
          <span>Promover</span>
        </Link>
        <Link href={baseTabHref("analyze")} className={linkClass(currentObjective === "analyze")} data-tour="finance">
          <span>Analisar</span>
        </Link>

        <div className="pt-2">
          <p className="px-2 text-[10px] uppercase tracking-[0.24em] text-white/45">Secundário</p>
          <Link href="/organizador/staff" className={subLinkClass(currentSubKey === "staff")} data-tour="staff">
            <span>Staff</span>
          </Link>
          <Link href="/organizador/settings" className={subLinkClass(currentSubKey === "settings")}>
            <span>Definições</span>
          </Link>
        </div>
      </nav>

      {/* Utilizador */}
      <div className="space-y-2 px-3 pb-4 pt-3">
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
