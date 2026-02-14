"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type SyntheticEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSWR from "swr";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { RoleBadge } from "@/app/organizacao/RoleBadge";
import { NotificationBell } from "@/app/components/notifications/NotificationBell";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { OrganizationMemberRole } from "@prisma/client";
import { ORG_SHELL_GUTTER } from "@/app/organizacao/layoutTokens";
import { ModuleIcon } from "@/app/organizacao/moduleIcons";
import { normalizeOrganizationPathname, resolveOrganizationTool, type OrgToolKey } from "@/app/organizacao/topbarRouteUtils";
import { buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";
import EventsSubnav from "@/app/org/_components/subnav/EventsSubnav";
import BookingsSubnav from "@/app/org/_components/subnav/BookingsSubnav";
import CheckInSubnav from "@/app/org/_components/subnav/CheckInSubnav";
import FinanceSubnav from "@/app/org/_components/subnav/FinanceSubnav";
import AnalyticsSubnav from "@/app/org/_components/subnav/AnalyticsSubnav";
import CrmToolSubnav from "@/app/org/_components/subnav/CrmToolSubnav";
import StoreToolSubnav from "@/app/org/_components/subnav/StoreToolSubnav";
import FormsSubnav from "@/app/org/_components/subnav/FormsSubnav";
import ChatSubnav from "@/app/org/_components/subnav/ChatSubnav";
import TeamSubnav from "@/app/org/_components/subnav/TeamSubnav";
import PadelClubSubnav from "@/app/org/_components/subnav/PadelClubSubnav";
import PadelTournamentsSubnav from "@/app/org/_components/subnav/PadelTournamentsSubnav";
import MarketingSubnav from "@/app/org/_components/subnav/MarketingSubnav";
import ProfileSubnav from "@/app/org/_components/subnav/ProfileSubnav";
import SettingsSubnav from "@/app/org/_components/subnav/SettingsSubnav";

const ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const TOPBAR_FLOAT_OFFSET = 12;
const TOPBAR_MIN_HEIGHT = 64;
const TOPBAR_MAX_HEIGHT = 220;
const TOPBAR_MIN_RENDERED_HEIGHT = TOPBAR_MIN_HEIGHT + TOPBAR_FLOAT_OFFSET;
const TOPBAR_MAX_RENDERED_HEIGHT = TOPBAR_MAX_HEIGHT + TOPBAR_FLOAT_OFFSET;
const SCROLL_TOP_THRESHOLD = 24;
const SCROLL_NOISE_THRESHOLD = 2;
const SCROLL_DIRECTION_THRESHOLD = 16;

type OrgOption = {
  organizationId: number;
  role: string;
  organization: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
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

type OrganizationMeResponse = {
  ok: boolean;
  organization?: {
    officialEmail?: string | null;
    officialEmailVerifiedAt?: string | null;
  } | null;
  paymentsStatus?: "NO_STRIPE" | "PENDING" | "READY";
  paymentsMode?: "CONNECT" | "PLATFORM";
};

const TOOL_META: Record<OrgToolKey, { label: string; moduleKey: string | null }> = {
  dashboard: { label: "Dashboard", moduleKey: null },
  events: { label: "Events", moduleKey: "EVENTOS" },
  bookings: { label: "Bookings", moduleKey: "RESERVAS" },
  "check-in": { label: "Check-in", moduleKey: "CHECKIN" },
  finance: { label: "Finance", moduleKey: "FINANCEIRO" },
  analytics: { label: "Analytics", moduleKey: "ANALYTICS" },
  crm: { label: "CRM", moduleKey: "CRM" },
  store: { label: "Store", moduleKey: "LOJA" },
  forms: { label: "Forms", moduleKey: "INSCRICOES" },
  chat: { label: "Chat", moduleKey: "MENSAGENS" },
  team: { label: "Team", moduleKey: "STAFF" },
  "padel-club": { label: "Gestão de Clube Padel", moduleKey: "TORNEIOS" },
  "padel-tournaments": { label: "Torneios de Padel", moduleKey: "TORNEIOS" },
  marketing: { label: "Marketing", moduleKey: "MARKETING" },
  profile: { label: "Profile", moduleKey: "PERFIL_PUBLICO" },
  settings: { label: "Settings", moduleKey: "DEFINICOES" },
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
  ANALYTICS: "from-[#22D3EE]/35 via-[#6A7BFF]/30 to-[#A78BFA]/35",
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
  type RoleBadgeRole = ComponentProps<typeof RoleBadge>["role"];
  const router = useRouter();
  const pathname = usePathname();
  const topbarRef = useRef<HTMLDivElement | null>(null);
  const normalizedPathname = useMemo(() => normalizeOrganizationPathname(pathname), [pathname]);
  const orgMenuRef = useRef<HTMLDetailsElement | null>(null);
  const userMenuRef = useRef<HTMLDetailsElement | null>(null);
  const lastScrollYRef = useRef(0);
  const scrollDirectionDeltaRef = useRef(0);
  const [switchingOrgId, setSwitchingOrgId] = useState<number | null>(null);
  const [openMenu, setOpenMenu] = useState<"org" | "user" | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);

  const orgDisplay = activeOrg?.name ?? "Organização";
  const orgAvatar = activeOrg?.avatarUrl ?? null;
  const userLabel = user?.name || user?.email || "Utilizador";
  const dashboardHref = activeOrg?.id ? buildOrgHref(activeOrg.id, "/overview") : buildOrgHubHref("/organizations");

  const activeTool = useMemo(
    () => resolveOrganizationTool(normalizedPathname) ?? "dashboard",
    [normalizedPathname],
  );
  const currentApp = TOOL_META[activeTool] ?? TOOL_META.dashboard;
  const currentIconGradient = currentApp.moduleKey
    ? MODULE_ICON_GRADIENTS[currentApp.moduleKey] ?? "from-white/15 via-white/5 to-white/10"
    : null;
  const resolvedToolSubnav = useMemo(() => {
    const orgId = activeOrg?.id ?? null;
    if (!orgId || activeTool === "dashboard") return null;
    if (activeTool === "events") return <EventsSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "bookings") return <BookingsSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "check-in") return <CheckInSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "finance") return <FinanceSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "analytics") return <AnalyticsSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "crm") {
      return <CrmToolSubnav orgId={orgId} className="w-full max-w-full" />;
    }
    if (activeTool === "store") return <StoreToolSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "forms") return <FormsSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "chat") return <ChatSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "team") return <TeamSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "padel-club") return <PadelClubSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "padel-tournaments") {
      return <PadelTournamentsSubnav orgId={orgId} className="w-full max-w-full" />;
    }
    if (activeTool === "marketing") return <MarketingSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "profile") return <ProfileSubnav orgId={orgId} className="w-full max-w-full" />;
    if (activeTool === "settings") return <SettingsSubnav orgId={orgId} className="w-full max-w-full" />;
    return null;
  }, [activeOrg?.id, activeTool]);

  const orgMeUrl = activeOrg?.id ? `/api/org/${activeOrg.id}/me` : null;
  const { data: orgData, error: orgDataError, mutate: mutateOrgData } = useSWR<OrganizationMeResponse>(
    orgMeUrl,
    fetcher,
  );
  const roleBadge = role && Object.values(OrganizationMemberRole).includes(role as OrganizationMemberRole)
    ? (role as RoleBadgeRole)
    : null;
  const isOrgDataLoading = Boolean(activeOrg) && !orgData && !orgDataError;
  const shouldAutoRefreshOrg = useMemo(() => {
    if (!orgData) return false;
    const officialEmailNormalized = normalizeOfficialEmail(orgData.organization?.officialEmail ?? null);
    const emailVerified = Boolean(officialEmailNormalized && orgData.organization?.officialEmailVerifiedAt);
    const paymentsMode = orgData.paymentsMode ?? null;
    const paymentsStatus = orgData.paymentsStatus ?? null;
    const paymentsReady = paymentsMode === "PLATFORM" || paymentsStatus === "READY";
    return !emailVerified || !paymentsReady;
  }, [orgData]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const topbar = topbarRef.current;
    if (!topbar) return;

    const readCurrentTopbarHeight = () => {
      const raw = root.style.getPropertyValue("--org-topbar-height").trim();
      if (!raw) return null;
      const parsed = Number.parseInt(raw.replace("px", ""), 10);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const syncTopbarHeight = () => {
      const measuredHeight = Math.ceil(topbar.getBoundingClientRect().height);
      const nextHeight = Math.min(TOPBAR_MAX_RENDERED_HEIGHT, Math.max(TOPBAR_MIN_RENDERED_HEIGHT, measuredHeight));
      const currentHeight = readCurrentTopbarHeight();
      if (currentHeight !== null && currentHeight === nextHeight) return;
      root.style.setProperty("--org-topbar-height", `${nextHeight}px`);
    };

    // Reset defensivo para evitar drift visual entre navegações.
    root.style.setProperty("--org-topbar-height", `${TOPBAR_MIN_RENDERED_HEIGHT}px`);
    syncTopbarHeight();

    let frameId: number | null = null;
    const scheduleSync = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      frameId = window.requestAnimationFrame(syncTopbarHeight);
    };

    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleSync) : null;
    observer?.observe(topbar);
    window.addEventListener("resize", scheduleSync);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", scheduleSync);
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      root.style.setProperty("--org-topbar-height", `${TOPBAR_MIN_HEIGHT}px`);
    };
  }, []);

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
    const officialEmail = normalizeOfficialEmail(orgData.organization?.officialEmail ?? null);
    const emailVerified = Boolean(officialEmail && officialEmailVerifiedAt);
    const paymentsStatus = orgData.paymentsStatus ?? null;
    const paymentsMode = orgData.paymentsMode ?? null;
    const items: Array<{ key: string; label: string; href: string; tone: "danger" | "warning" }> = [];
    if (!emailVerified) {
      items.push({
        key: "email",
        label: officialEmail ? "Email por verificar" : "Email obrigatório",
        href: activeOrg?.id ? buildOrgHref(activeOrg.id, "/settings") : buildOrgHubHref("/organizations"),
        tone: "danger",
      });
    }
    if (paymentsMode === "CONNECT" && paymentsStatus && paymentsStatus !== "READY") {
      items.push({
        key: "stripe",
        label: "Stripe recomendado",
        href: activeOrg?.id ? buildOrgHref(activeOrg.id, "/finance") : buildOrgHubHref("/organizations"),
        tone: "warning",
      });
    }
    return items;
  }, [activeOrg?.id, orgData]);

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

    const syncTopState = (currentY: number) => {
      const atTop = currentY <= SCROLL_TOP_THRESHOLD;
      setIsAtTop((prev) => (prev === atTop ? prev : atTop));
      if (atTop) {
        scrollDirectionDeltaRef.current = 0;
        setIsVisible(true);
      }
      return atTop;
    };

    const handleScroll = () => {
      const currentY = getScrollY();
      const previousY = lastScrollYRef.current;
      const delta = currentY - previousY;
      lastScrollYRef.current = currentY;

      const atTop = syncTopState(currentY);
      if (atTop) return;
      if (Math.abs(delta) < SCROLL_NOISE_THRESHOLD) return;

      const currentDirectionDelta = scrollDirectionDeltaRef.current;
      const sameDirection = currentDirectionDelta === 0 || Math.sign(currentDirectionDelta) === Math.sign(delta);
      const nextDirectionDelta = sameDirection ? currentDirectionDelta + delta : delta;
      scrollDirectionDeltaRef.current = nextDirectionDelta;

      if (nextDirectionDelta >= SCROLL_DIRECTION_THRESHOLD) {
        setIsVisible(false);
        scrollDirectionDeltaRef.current = 0;
      } else if (nextDirectionDelta <= -SCROLL_DIRECTION_THRESHOLD) {
        setIsVisible(true);
        scrollDirectionDeltaRef.current = 0;
      }
    };

    const initialY = getScrollY();
    lastScrollYRef.current = initialY;
    syncTopState(initialY);
    setIsVisible(true);

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
      const res = await fetch("/api/org-hub/organizations/switch", {
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
      router.replace(buildOrgHref(orgId, "/overview"));
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
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch (err) {
      console.error("Erro no signOut", err);
    } finally {
      try {
        document.cookie = "orya_organization=; path=/; Max-Age=0; SameSite=Lax";
      } catch {
        /* ignore */
      }
      router.push("/login?logout=1");
    }
  };

  return (
    <div
      ref={topbarRef}
      className={cn(
        "fixed inset-x-0 top-0 z-[70] pt-3 transition-transform duration-300 ease-out",
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
            "relative flex min-h-16 flex-wrap items-center gap-3 py-2 lg:h-16 lg:flex-nowrap lg:py-0",
            ORG_SHELL_GUTTER,
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={dashboardHref}
              className="group flex h-11 shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 text-sm text-white/85 shadow-[0_12px_38px_rgba(0,0,0,0.3)] transition hover:bg-white/10"
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
            {resolvedToolSubnav}
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
            <summary className="list-none cursor-pointer rounded-full border border-white/15 bg-white/5 px-3 text-sm text-white/80 shadow-[0_12px_38px_rgba(0,0,0,0.3)] flex h-11 items-center">
              <div className="flex items-center gap-2">
                <Avatar
                  src={orgAvatar}
                  name={orgDisplay}
                  className="h-7 w-7 rounded-full border border-white/10"
                  textClassName="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80"
                />
                <div className="flex min-w-0 flex-col leading-tight">
                  <span className="text-[9px] uppercase tracking-[0.22em] text-white/50 md:hidden">
                    Organização:
                  </span>
                  <span className="max-w-[140px] truncate text-[12px] font-semibold text-white md:text-sm">
                    {orgDisplay}
                  </span>
                </div>
                <span className="text-white/50" aria-hidden="true">▾</span>
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
                    href={buildOrgHubHref("/create")}
                    className="orya-menu-item text-[12px] text-white/70"
                  >
                    Criar organização
                  </Link>
                  <Link
                    href={buildOrgHubHref("/organizations")}
                    className="orya-menu-item text-[12px] text-white/70"
                  >
                    Gerir organizações
                  </Link>
                </div>
              </div>
            </div>
          </details>

          <details ref={userMenuRef} className={cn("relative", openMenu === "user" && "z-50")} onToggle={handleMenuToggle("user")}>
            <summary className="list-none cursor-pointer rounded-full border border-white/15 bg-white/5 px-2.5 text-sm text-white/80 shadow-[0_12px_38px_rgba(0,0,0,0.3)] flex h-11 items-center">
              <div className="flex items-center gap-2">
                {roleBadge && (
                  <span className="hidden lg:inline-flex">
                    <RoleBadge role={roleBadge} subtle />
                  </span>
                )}
                <Avatar
                  src={user?.avatarUrl ?? null}
                  name={userLabel}
                  className="h-7 w-7 rounded-full border border-white/10"
                  textClassName="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80"
                />
                <span className="hidden text-[12px] text-white/70 md:inline">{userLabel}</span>
                <span className="text-white/50" aria-hidden="true">▾</span>
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
