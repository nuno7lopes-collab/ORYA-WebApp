"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type SyntheticEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  CORE_ORGANIZATION_MODULES,
  parseOrganizationModules,
  resolvePrimaryModule,
} from "@/lib/organizationCategories";
import { RoleBadge } from "@/app/organizacao/RoleBadge";
import { NotificationBell } from "@/app/components/notifications/NotificationBell";
import ObjectiveSubnav from "@/app/organizacao/ObjectiveSubnav";
import CrmSubnav from "@/app/organizacao/(dashboard)/crm/CrmSubnav";
import { type ObjectiveTab } from "@/app/organizacao/objectiveNav";
import { hasModuleAccess, resolveModuleAccess } from "@/lib/organizationRbac";
import { OrganizationMemberRole, OrganizationModule } from "@prisma/client";
import StoreAdminSubnav from "@/components/store/StoreAdminSubnav";
import { ORG_SHELL_GUTTER } from "@/app/organizacao/layoutTokens";
import { ModuleIcon } from "@/app/organizacao/moduleIcons";

const ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

type OrgOption = {
  organizationId: number;
  role: string;
  organization: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
    city: string | null;
    entityType: string | null;
    organizationKind?: string | null;
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
  primaryModule?: string | null;
  modules?: string[] | null;
};

type UserInfo = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | number | null;
};

type OperationModule = "EVENTOS" | "RESERVAS" | "TORNEIOS";

type OrganizationMeResponse = {
  ok: boolean;
  organization?: {
    officialEmail?: string | null;
    officialEmailVerifiedAt?: string | null;
  } | null;
  modulePermissions?: Array<{
    moduleKey: OrganizationModule;
    accessLevel: string;
    scopeType?: string | null;
    scopeId?: string | null;
  }>;
  paymentsStatus?: "NO_STRIPE" | "PENDING" | "READY";
  paymentsMode?: "CONNECT" | "PLATFORM";
};

const OPERATION_LABELS: Record<OperationModule, string> = {
  EVENTOS: "Eventos",
  RESERVAS: "Reservas",
  TORNEIOS: "Padel e torneios",
};

const MODULE_ICON_GRADIENTS: Record<string, string> = {
  EVENTOS: "from-[#FF7AD1]/45 via-[#7FE0FF]/35 to-[#6A7BFF]/45",
  RESERVAS: "from-[#6BFFFF]/40 via-[#6A7BFF]/30 to-[#0EA5E9]/40",
  TORNEIOS: "from-[#F59E0B]/35 via-[#FF7AD1]/35 to-[#6A7BFF]/35",
  CHECKIN: "from-[#22D3EE]/35 via-[#60A5FA]/30 to-[#A78BFA]/35",
  INSCRICOES: "from-[#34D399]/35 via-[#6BFFFF]/30 to-[#7FE0FF]/35",
  MENSAGENS: "from-[#A78BFA]/35 via-[#7FE0FF]/30 to-[#34D399]/35",
  STAFF: "from-[#60A5FA]/35 via-[#7FE0FF]/30 to-[#F59E0B]/35",
  FINANCEIRO: "from-[#F97316]/35 via-[#F59E0B]/30 to-[#FF7AD1]/35",
  CRM: "from-[#F97316]/35 via-[#38BDF8]/30 to-[#22D3EE]/35",
  MARKETING: "from-[#FF7AD1]/35 via-[#FB7185]/30 to-[#F59E0B]/35",
  LOJA: "from-[#F97316]/35 via-[#FB7185]/30 to-[#F59E0B]/35",
  PERFIL_PUBLICO: "from-[#22D3EE]/35 via-[#60A5FA]/30 to-[#A78BFA]/35",
  DEFINICOES: "from-[#94A3B8]/35 via-[#64748B]/25 to-[#94A3B8]/35",
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OrganizationTopBar({
  activeOrg,
  orgOptions,
  user,
  role,
}: {
  activeOrg: ActiveOrg | null;
  orgOptions: OrgOption[];
  user: UserInfo | null;
  role?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const orgMenuRef = useRef<HTMLDetailsElement | null>(null);
  const userMenuRef = useRef<HTMLDetailsElement | null>(null);
  const lastScrollYRef = useRef(0);
  const [switchingOrgId, setSwitchingOrgId] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<"org" | "user" | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);

  const orgDisplay = activeOrg?.name ?? "Organização";
  const orgAvatar = activeOrg?.avatarUrl ?? null;
  const userLabel = user?.name || user?.email || "Utilizador";

  const moduleState = useMemo(() => {
    const primary = resolvePrimaryModule(
      activeOrg?.primaryModule ?? null,
      activeOrg?.modules ?? null,
    ) as OperationModule;
    return { primary };
  }, [activeOrg?.primaryModule, activeOrg?.modules]);

  const currentApp = useMemo(() => {
    const setApp = (label: string, moduleKey: string | null) => ({ label, moduleKey });
    const tabParam = searchParams?.get("tab");
    const sectionParam = searchParams?.get("section");
    if (pathname === "/organizacao") {
      if (!tabParam || tabParam === "overview" || tabParam === "create") return setApp("Dashboard", null);
      if (tabParam === "manage") {
        if (sectionParam === "inscricoes") return setApp("Formulários", "INSCRICOES");
        if (sectionParam === "reservas") return setApp("Reservas", "RESERVAS");
        if (sectionParam === "padel-hub") return setApp("Padel e torneios", "TORNEIOS");
        return setApp(OPERATION_LABELS[moduleState.primary], moduleState.primary);
      }
      if (tabParam === "promote") return setApp("Promoções", "MARKETING");
      if (tabParam === "analyze") return setApp("Finanças", "FINANCEIRO");
      if (tabParam === "profile") return setApp("Perfil público", "PERFIL_PUBLICO");
      return setApp("Dashboard", null);
    }
    if (pathname?.startsWith("/organizacao/eventos")) return setApp("Eventos", "EVENTOS");
    if (
      pathname?.startsWith("/organizacao/torneios") ||
      pathname?.startsWith("/organizacao/padel") ||
      pathname?.startsWith("/organizacao/tournaments")
    ) {
      return setApp("Padel e torneios", "TORNEIOS");
    }
    if (pathname?.startsWith("/organizacao/reservas")) return setApp("Reservas", "RESERVAS");
    if (pathname?.startsWith("/organizacao/inscricoes")) return setApp("Formulários", "INSCRICOES");
    if (pathname?.startsWith("/organizacao/chat") || pathname?.startsWith("/organizacao/mensagens")) {
      return setApp("Chat interno", "MENSAGENS");
    }
    if (pathname?.startsWith("/organizacao/scan")) return setApp("Check-in", "CHECKIN");
    if (pathname?.startsWith("/organizacao/crm")) return setApp("CRM", "CRM");
    if (pathname?.startsWith("/organizacao/loja")) return setApp("Loja", "LOJA");
    if (pathname?.startsWith("/organizacao/staff") || pathname?.startsWith("/organizacao/treinadores")) {
      return setApp("Equipa", "STAFF");
    }
    if (pathname?.startsWith("/organizacao/settings")) return setApp("Definições", "DEFINICOES");
    if (
      pathname?.startsWith("/organizacao/faturacao") ||
      pathname?.startsWith("/organizacao/pagamentos") ||
      (pathname?.startsWith("/organizacao/tournaments/") && pathname?.endsWith("/finance"))
    ) {
      return setApp("Finanças", "FINANCEIRO");
    }
    if (pathname?.startsWith("/organizacao/organizations")) return setApp("Organizações", null);
    if (pathname?.startsWith("/organizacao/clube")) return setApp("Clube", null);
    return setApp("Dashboard", null);
  }, [moduleState.primary, pathname, searchParams]);

  const activeObjective = useMemo<ObjectiveTab | null>(() => {
    const tabParam = searchParams?.get("tab");
    if (pathname === "/organizacao") {
      if (!tabParam || tabParam === "overview" || tabParam === "create") return "create";
      if (tabParam === "manage") return "manage";
      if (tabParam === "promote") return "promote";
      if (tabParam === "analyze") return "analyze";
      if (tabParam === "profile") return "profile";
      return "create";
    }
    if (
      pathname?.startsWith("/organizacao/inscricoes") ||
      pathname?.startsWith("/organizacao/eventos") ||
      pathname?.startsWith("/organizacao/torneios") ||
      pathname?.startsWith("/organizacao/reservas") ||
      pathname?.startsWith("/organizacao/padel") ||
      pathname?.startsWith("/organizacao/tournaments") ||
      pathname?.startsWith("/organizacao/scan") ||
      pathname?.startsWith("/organizacao/crm")
    ) {
      return "manage";
    }
    if (pathname?.startsWith("/organizacao/promo")) return "promote";
    if (
      pathname?.startsWith("/organizacao/faturacao") ||
      pathname?.startsWith("/organizacao/pagamentos")
    ) {
      return "analyze";
    }
    return null;
  }, [pathname, searchParams]);

  const activeObjectiveSection = useMemo(() => {
    const sectionParam = searchParams?.get("section");
    const padelParam = searchParams?.get("padel");
    const eventIdParam = searchParams?.get("eventId");
    const hasEventId = eventIdParam ? Number.isFinite(Number(eventIdParam)) : false;
    const padelFallback = hasEventId ? "calendar" : "clubs";
    if (pathname?.startsWith("/organizacao/crm")) {
      if (pathname?.startsWith("/organizacao/crm/segmentos")) return "crm-segmentos";
      if (pathname?.startsWith("/organizacao/crm/campanhas")) return "crm-campanhas";
      if (pathname?.startsWith("/organizacao/crm/loyalty")) return "crm-loyalty";
      return "crm-clientes";
    }
    if (sectionParam && sectionParam !== "padel-hub") return sectionParam;
    if (!activeObjective) return null;
    if (activeObjective === "manage") {
      if (sectionParam === "padel-hub") return padelParam ?? padelFallback;
      if (pathname?.startsWith("/organizacao/reservas")) {
        if (pathname?.startsWith("/organizacao/reservas/novo")) return "servicos";
        if (pathname?.startsWith("/organizacao/reservas/servicos")) return "servicos";
        if (pathname?.startsWith("/organizacao/reservas/clientes")) return "clientes";
        if (pathname?.startsWith("/organizacao/reservas/profissionais")) return "profissionais";
        if (pathname?.startsWith("/organizacao/reservas/recursos")) return "recursos";
        if (pathname?.startsWith("/organizacao/reservas/politicas")) return "politicas";
        if (searchParams?.get("tab") === "availability") return "disponibilidade";
        return "agenda";
      }
      if (pathname?.startsWith("/organizacao/inscricoes")) {
        const formTab = searchParams?.get("tab");
        if (formTab === "respostas") return "respostas";
        if (formTab === "definicoes") return "definicoes";
        return "inscricoes";
      }
      if (pathname?.startsWith("/organizacao/scan")) return "checkin";
      if (pathname?.startsWith("/organizacao/padel")) return padelParam ?? padelFallback;
      if (pathname?.startsWith("/organizacao/eventos/novo")) return "create";
      if (pathname?.startsWith("/organizacao/torneios/novo")) return "torneios-criar";
      if (pathname?.startsWith("/organizacao/torneios") || pathname?.startsWith("/organizacao/tournaments")) {
        return "torneios";
      }
      if (pathname?.startsWith("/organizacao/eventos")) return "eventos";
      return moduleState.primary === "RESERVAS" ? "reservas" : "eventos";
    }
    if (activeObjective === "analyze") return "financas";
    if (activeObjective === "promote") return "overview";
    if (activeObjective === "profile") return "perfil";
    return "overview";
  }, [activeObjective, moduleState.primary, pathname, searchParams]);
  const isDashboardOverview = pathname === "/organizacao" && (!searchParams?.get("tab") || searchParams?.get("tab") === "overview");
  const isStoreRoute = pathname?.startsWith("/organizacao/loja");
  const isCrmRoute = pathname?.startsWith("/organizacao/crm");

  const objectiveModules = useMemo(() => {
    const rawModules = Array.isArray(activeOrg?.modules) ? activeOrg?.modules : [];
    const normalizedModules = parseOrganizationModules(rawModules) ?? [];
    const primary = resolvePrimaryModule(activeOrg?.primaryModule ?? null, normalizedModules);
    const base = new Set<string>([...normalizedModules, ...CORE_ORGANIZATION_MODULES, primary]);
    return { modules: Array.from(base), primary };
  }, [activeOrg?.modules, activeOrg?.primaryModule]);
  const subnavFocusId = currentApp.moduleKey === "INSCRICOES" ? "inscricoes" : null;
  const currentIconGradient = currentApp.moduleKey
    ? MODULE_ICON_GRADIENTS[currentApp.moduleKey] ?? "from-white/15 via-white/5 to-white/10"
    : null;

  const { data: orgData, error: orgDataError, mutate: mutateOrgData } = useSWR<OrganizationMeResponse>(
    activeOrg ? "/api/organizacao/me" : null,
    fetcher,
  );
  const moduleOverrides = useMemo(() => {
    if (!orgData?.modulePermissions) return [];
    return orgData.modulePermissions
      .filter((item) => item && item.moduleKey)
      .map((item) => ({
        moduleKey: item.moduleKey,
        accessLevel: item.accessLevel,
        scopeType: item.scopeType ?? null,
        scopeId: item.scopeId ?? null,
      }));
  }, [orgData?.modulePermissions]);
  const moduleAccess = useMemo(() => {
    if (!role) return null;
    if (!Object.values(OrganizationMemberRole).includes(role as OrganizationMemberRole)) return null;
    return resolveModuleAccess(role as OrganizationMemberRole, moduleOverrides);
  }, [moduleOverrides, role]);
  const objectiveModulesWithAccess = useMemo(() => {
    if (!moduleAccess) return objectiveModules.modules;
    return objectiveModules.modules.filter((moduleKey) => {
      if (!Object.values(OrganizationModule).includes(moduleKey as OrganizationModule)) return true;
      return hasModuleAccess(moduleAccess, moduleKey as OrganizationModule, "VIEW");
    });
  }, [moduleAccess, objectiveModules.modules]);
  const isOrgDataLoading = Boolean(activeOrg) && !orgData && !orgDataError;
  const shouldAutoRefreshOrg = useMemo(() => {
    if (!orgData) return false;
    const emailVerified = Boolean(orgData.organization?.officialEmailVerifiedAt);
    const paymentsMode = orgData.paymentsMode ?? null;
    const paymentsStatus = orgData.paymentsStatus ?? null;
    const paymentsReady = paymentsMode === "PLATFORM" || paymentsStatus === "READY";
    return !emailVerified || !paymentsReady;
  }, [orgData]);

  useEffect(() => {
    if (!shouldAutoRefreshOrg) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await mutateOrgData();
      } catch (err) {
        console.warn("[org/topbar] auto-refresh falhou", err);
      }
    };
    tick();
    const interval = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shouldAutoRefreshOrg, mutateOrgData]);

  const activationItems = useMemo(() => {
    if (!orgData) return [];
    const officialEmailVerifiedAt = orgData.organization?.officialEmailVerifiedAt ?? null;
    const officialEmail = orgData.organization?.officialEmail ?? null;
    const paymentsStatus = orgData.paymentsStatus ?? null;
    const paymentsMode = orgData.paymentsMode ?? null;
    const items: Array<{ key: string; label: string; href: string; tone: "danger" | "warning" }> = [];
    if (!officialEmailVerifiedAt) {
      items.push({
        key: "email",
        label: officialEmail ? "Email por verificar" : "Email obrigatório",
        href: "/organizacao/settings",
        tone: "danger",
      });
    }
    if (paymentsMode === "CONNECT" && paymentsStatus && paymentsStatus !== "READY") {
      items.push({
        key: "stripe",
        label: "Stripe recomendado",
        href: "/organizacao?tab=analyze&section=financas",
        tone: "warning",
      });
    }
    return items;
  }, [orgData]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (orgMenuRef.current?.contains(target)) return;
      if (userMenuRef.current?.contains(target)) return;
      if (orgMenuRef.current?.open) orgMenuRef.current.removeAttribute("open");
      if (userMenuRef.current?.open) userMenuRef.current.removeAttribute("open");
      setOpenMenu(null);
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const container = document.querySelector<HTMLElement>("[data-org-scroll]");
    const scrollTarget: HTMLElement | Window = container ?? window;
    const getScrollY = () => (container ? container.scrollTop : window.scrollY || 0);

    const handleScroll = () => {
      const currentY = getScrollY();
      const atTop = currentY < 12;
      setIsAtTop((prev) => (prev === atTop ? prev : atTop));

      const prevY = lastScrollYRef.current;

      if (atTop) {
        setIsVisible(true);
      } else {
        if (currentY > prevY + 12) {
          setIsVisible(false);
        } else if (currentY < prevY - 12) {
          setIsVisible(true);
        }
      }

      lastScrollYRef.current = currentY;
    };

    handleScroll();
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener("scroll", handleScroll);
  }, []);

  const handleMenuToggle = (key: "org" | "user") => (event: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = event.currentTarget.open;
    if (isOpen) {
      setOpenMenu(key);
      if (key === "org" && userMenuRef.current?.open) {
        userMenuRef.current.removeAttribute("open");
      }
      if (key === "user" && orgMenuRef.current?.open) {
        orgMenuRef.current.removeAttribute("open");
      }
    } else if (openMenu === key) {
      setOpenMenu(null);
    }
  };

  const switchOrg = async (orgId: number) => {
    if (switchingOrgId) return;
    setSwitchingOrgId(orgId);
    try {
      const res = await fetch("/api/organizacao/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        console.warn("[topbar][org switch] falhou", json?.error ?? res.statusText);
        return;
      }
      try {
        document.cookie = `orya_organization=${orgId}; path=/; Max-Age=${ORG_COOKIE_MAX_AGE}; SameSite=Lax`;
      } catch {
        /* ignore */
      }
      if (orgMenuRef.current) orgMenuRef.current.removeAttribute("open");
      router.replace(`/organizacao?tab=overview&organizationId=${orgId}`);
      router.refresh();
    } catch (err) {
      console.error("[topbar][org switch] erro", err);
    } finally {
      setSwitchingOrgId(null);
    }
  };

  const goUserMode = () => {
    try {
      document.cookie = "orya_organization=; path=/; Max-Age=0; SameSite=Lax";
    } catch {
      /* ignore */
    }
    if (userMenuRef.current) userMenuRef.current.removeAttribute("open");
    router.push("/me");
  };

  const signOut = async () => {
    try {
      await supabaseBrowser.auth.signOut();
    } catch (err) {
      console.error("Erro no signOut", err);
    } finally {
      try {
        document.cookie = "orya_organization=; path=/; Max-Age=0; SameSite=Lax";
      } catch {
        /* ignore */
      }
      router.push("/login");
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-transform duration-300 ease-out",
        isVisible ? "translate-y-0" : "-translate-y-full",
      )}
    >
      <div
        className={cn(
          "relative w-full border-b transition-all duration-300",
          isAtTop
            ? "border-transparent bg-transparent shadow-none backdrop-blur-[6px]"
            : "border-white/10 bg-[linear-gradient(120deg,rgba(8,10,20,0.62),rgba(8,10,20,0.82))] shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-[18px]",
        )}
      >
        <div
          className={cn(
            "relative flex min-h-[var(--org-topbar-height)] flex-wrap items-center gap-3 py-2 lg:h-[var(--org-topbar-height)] lg:flex-nowrap lg:py-0",
            ORG_SHELL_GUTTER,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/organizacao?tab=overview"
              className="group flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 text-sm text-white/85 shadow-[0_12px_38px_rgba(0,0,0,0.3)] transition hover:bg-white/10"
            >
              {currentApp.moduleKey ? (
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full border border-white/15 text-white/90",
                    currentIconGradient ? `bg-gradient-to-br ${currentIconGradient}` : "bg-white/10",
                  )}
                >
                  <ModuleIcon moduleKey={currentApp.moduleKey} className="h-4 w-4" aria-hidden="true" />
                </span>
              ) : null}
              <span className="text-sm font-semibold text-white">{currentApp.label}</span>
              <span className="text-white/50 opacity-0 transition group-hover:opacity-100">←</span>
            </Link>
          </div>
          <div className="order-3 flex w-full min-w-0 items-center gap-2 lg:order-none lg:flex-1">
            {isStoreRoute ? (
              <StoreAdminSubnav
                baseHref="/organizacao/loja"
                variant="topbar"
                className="w-full max-w-full"
              />
            ) : isCrmRoute ? (
              <CrmSubnav variant="topbar" className="max-w-full" />
            ) : activeObjective && !isDashboardOverview ? (
              <ObjectiveSubnav
                objective={activeObjective}
                activeId={activeObjectiveSection ?? undefined}
                focusSectionId={subnavFocusId ?? undefined}
                primaryModule={objectiveModules.primary}
                modules={objectiveModulesWithAccess}
                mode="dashboard"
                variant="topbar"
                className="w-full max-w-full"
              />
            ) : null}
          </div>

          <div className="order-2 ml-auto flex items-center gap-2 lg:order-none">
          {isOrgDataLoading ? (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-[26px] w-[120px] animate-pulse rounded-full border border-white/10 bg-white/5" />
              <span className="h-[26px] w-[88px] animate-pulse rounded-full border border-white/10 bg-white/5" />
            </div>
          ) : (
            activationItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "hidden rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] sm:inline-flex",
                  item.tone === "danger"
                    ? "border-rose-400/60 bg-rose-500/15 text-rose-100"
                    : "border-amber-400/60 bg-amber-500/15 text-amber-100",
                )}
              >
                {item.label}
              </Link>
            ))
          )}

          <NotificationBell organizationId={activeOrg?.id ?? null} />

          <details ref={orgMenuRef} className={cn("relative", openMenu === "org" && "z-50")} onToggle={handleMenuToggle("org")}>
            <summary className="list-none cursor-pointer rounded-full border border-white/15 bg-white/5 px-3 text-sm text-white/80 shadow-[0_12px_38px_rgba(0,0,0,0.3)] flex h-9 items-center">
              <div className="flex items-center gap-2">
                <Avatar
                  src={orgAvatar}
                  name={orgDisplay}
                  className="h-7 w-7 rounded-full border border-white/10"
                  textClassName="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80"
                />
                <span className="hidden max-w-[140px] truncate text-sm font-semibold text-white md:inline">
                  {orgDisplay}
                </span>
                <span className="text-white/50 hidden md:inline">▾</span>
              </div>
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-2xl orya-menu-surface p-2 backdrop-blur-2xl">
              <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.24em] text-white/50">Organizações</p>
              <div className="orya-menu-list">
                {orgOptions.map((item) => {
                  const label =
                    item.organization.publicName ||
                    item.organization.businessName ||
                    item.organization.username ||
                    "Organização";
                  const isActive = activeOrg?.id === item.organizationId;
                  return (
                    <button
                      key={item.organizationId}
                      type="button"
                      onClick={() => switchOrg(item.organizationId)}
                      disabled={switchingOrgId === item.organizationId}
                      className={cn(
                        "orya-menu-item text-[12px]",
                        isActive && "bg-[var(--orya-menu-hover)]",
                      )}
                    >
                      <span className="truncate">{label}</span>
                      {isActive && <span className="text-[10px] text-white/50">Ativa</span>}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 pt-2">
                <div className="orya-menu-divider mb-2" />
                <div className="orya-menu-list">
                  <Link
                    href="/organizacao/become"
                    className="orya-menu-item text-[12px] text-white/70"
                  >
                    Criar organização
                  </Link>
                  <Link
                    href="/organizacao/organizations"
                    className="orya-menu-item text-[12px] text-white/70"
                  >
                    Gerir organizações
                  </Link>
                </div>
              </div>
            </div>
          </details>

          <details ref={userMenuRef} className={cn("relative", openMenu === "user" && "z-50")} onToggle={handleMenuToggle("user")}>
            <summary className="list-none cursor-pointer rounded-full border border-white/15 bg-white/5 px-2.5 text-sm text-white/80 shadow-[0_12px_38px_rgba(0,0,0,0.3)] flex h-9 items-center">
              <div className="flex items-center gap-2">
                {role && (
                  <span className="hidden lg:inline-flex">
                    <RoleBadge role={role} subtle />
                  </span>
                )}
                <Avatar
                  src={user?.avatarUrl ?? null}
                  name={userLabel}
                  className="h-7 w-7 rounded-full border border-white/10"
                  textClassName="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80"
                />
                <span className="hidden text-[12px] text-white/70 md:inline">{userLabel}</span>
                <span className="text-white/50 hidden md:inline">▾</span>
              </div>
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-2xl orya-menu-surface p-2 backdrop-blur-2xl">
              <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.24em] text-white/50">Conta</p>
              <div className="orya-menu-list">
                <button
                  type="button"
                  onClick={goUserMode}
                  className="orya-menu-item text-[12px]"
                >
                  <span>Voltar a utilizador</span>
                  <span className="text-[10px] text-white/50">↺</span>
                </button>
                <Link
                  href="/me/settings"
                  className="orya-menu-item text-[12px]"
                >
                  <span>Definições pessoais</span>
                  <span className="text-[10px] text-white/50">↗</span>
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="orya-menu-item text-[12px] text-rose-100 hover:bg-rose-500/15"
                >
                  <span>Terminar sessão</span>
                  <span className="text-[10px] text-rose-200">×</span>
                </button>
              </div>
            </div>
          </details>
        </div>
        </div>
      </div>
    </div>
  );
}
