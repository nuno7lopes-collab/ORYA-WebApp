"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentProps } from "react";
import useSWR from "swr";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { RoleBadge } from "@/app/org/_internal/core/RoleBadge";
import { OrganizationNotificationBell } from "@/app/components/notifications/NotificationBell";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import { buildOrgHref, buildOrgHubHref } from "@/lib/organizationIdUtils";
import { getOrganizationRoleFlags } from "@/lib/organizationUiPermissions";
import { hasModuleAccess, normalizeAccessLevel, resolveMemberModuleAccess } from "@/lib/organizationRbac";
import {
  buildOrganizationToolNavigation,
  resolveOrganizationSidebarState,
  type OrganizationSidebarAccess,
} from "@/app/org/_internal/core/organizationToolNavigation";
import type { OrganizationMemberRole, OrganizationModule, OrganizationRolePack } from "@prisma/client";
import type {
  OrganizationShellActiveOrg,
  OrganizationShellOrgOption,
  OrganizationShellUser,
} from "@/app/org/_internal/core/OrganizationDashboardShell";

const ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const ORG_SWITCH_TIMEOUT_MS = 8_000;

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type RoleBadgeRole = ComponentProps<typeof RoleBadge>["role"];
const ROLE_BADGE_ROLE_SET: ReadonlySet<RoleBadgeRole> = new Set([
  "OWNER",
  "CO_OWNER",
  "ADMIN",
  "STAFF",
]);

type OrganizationMeResponse = {
  ok: boolean;
  membershipRole?: string | null;
  membershipRolePack?: string | null;
  organization?: {
    officialEmail?: string | null;
    officialEmailVerifiedAt?: string | null;
    officialEmailPending?: {
      requestId: number;
      newEmail: string;
      createdAt: string;
      expiresAt?: string | null;
    } | null;
  } | null;
  paymentsStatus?: "NO_STRIPE" | "PENDING" | "READY";
  paymentsMode?: "CONNECT" | "PLATFORM";
  toolPermissions?: Array<{
    moduleKey: OrganizationModule;
    accessLevel: string;
    scopeType?: string | null;
    scopeId?: string | null;
  }>;
};

function resolveSidebarAccess(
  orgData: OrganizationMeResponse | undefined,
  role: string | null | undefined,
): OrganizationSidebarAccess {
  const membershipRole = String(role ?? orgData?.membershipRole ?? "").toUpperCase() || null;
  const membershipRolePack = String(orgData?.membershipRolePack ?? "").toUpperCase() || null;
  const roleFlags = getOrganizationRoleFlags(membershipRole, membershipRolePack);
  const moduleOverrides = Array.isArray(orgData?.toolPermissions)
    ? orgData.toolPermissions
        .map((item) => {
          const normalizedAccess = normalizeAccessLevel(item.accessLevel);
          if (!normalizedAccess) return null;
          return {
            moduleKey: item.moduleKey,
            accessLevel: normalizedAccess,
            scopeType: item.scopeType ?? null,
            scopeId: item.scopeId ?? null,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];
  const moduleAccess = resolveMemberModuleAccess({
    role: membershipRole as OrganizationMemberRole | null,
    rolePack: membershipRolePack as OrganizationRolePack | null,
    overrides: moduleOverrides,
  });
  const canAccessModule = (moduleKey: OrganizationModule) => hasModuleAccess(moduleAccess, moduleKey, "EDIT");

  const canAccessReservas = canAccessModule("RESERVAS");
  const canAccessTorneios = canAccessModule("TORNEIOS");
  const canAccessEventos = canAccessModule("EVENTOS");
  const canAccessInscricoes = canAccessModule("INSCRICOES");
  const canAccessMensagens = canAccessModule("MENSAGENS");
  const canAccessCrm = canAccessModule("CRM");
  const canAccessAnalytics = canAccessModule("ANALYTICS");
  const canAccessLoja = canAccessModule("LOJA");
  const canAccessMarketing = canAccessModule("MARKETING");
  const canAccessFinanceiro = canAccessModule("FINANCEIRO");
  const canAccessStaff = canAccessModule("STAFF");
  const canAccessSettings = canAccessModule("DEFINICOES");

  return {
    canAccessReservas,
    canAccessTorneios,
    canAccessEventos,
    canAccessInscricoes,
    canAccessMensagens,
    canAccessCrm,
    canAccessAnalytics,
    canAccessLoja,
    canViewFinance: roleFlags.canViewFinance && canAccessFinanceiro,
    canManageMembers: roleFlags.canManageMembers && canAccessStaff,
    canEditOrgSettings: roleFlags.canEditOrg && canAccessSettings,
    canPromote: roleFlags.canPromote && canAccessMarketing,
  };
}

export default function OrganizationSidebar({
  activeOrg,
  orgOptions,
  user,
  role,
  className,
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: {
  activeOrg: OrganizationShellActiveOrg | null;
  orgOptions: OrganizationShellOrgOption[];
  user: OrganizationShellUser | null;
  role?: string | null;
  className?: string;
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [switchingOrgId, setSwitchingOrgId] = useState<number | null>(null);
  const [expandedByToolId, setExpandedByToolId] = useState<Record<string, boolean>>({});
  const [openMenu, setOpenMenu] = useState<"org" | "user" | null>(null);

  const orgDisplay = activeOrg?.name ?? "Clube";
  const orgAvatar = activeOrg?.avatarUrl ?? null;
  const userLabel = user?.name || user?.email || "Utilizador";
  const roleBadge = role && ROLE_BADGE_ROLE_SET.has(role as RoleBadgeRole) ? (role as RoleBadgeRole) : null;

  const orgMeUrl = activeOrg?.id ? `/api/org/${activeOrg.id}/me` : null;
  const { data: orgData } = useSWR<OrganizationMeResponse>(orgMeUrl, fetcher, {
    revalidateOnFocus: true,
  });

  const activationItems = useMemo(() => {
    if (!orgData) return [];
    const officialEmailVerifiedAt = orgData.organization?.officialEmailVerifiedAt ?? null;
    const officialEmail = normalizeOfficialEmail(orgData.organization?.officialEmail ?? null);
    const pendingEmail = normalizeOfficialEmail(orgData.organization?.officialEmailPending?.newEmail ?? null);
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
    } else if (pendingEmail && pendingEmail !== officialEmail) {
      items.push({
        key: "email_pending_change",
        label: "Alteração de email pendente",
        href: activeOrg?.id ? buildOrgHref(activeOrg.id, "/settings") : buildOrgHubHref("/organizations"),
        tone: "warning",
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

  const access = useMemo(
    () => resolveSidebarAccess(orgData, role),
    [orgData, role],
  );

  const tools = useMemo(() => {
    if (!activeOrg?.id) return [];
    return buildOrganizationToolNavigation({
      orgId: activeOrg.id,
      access,
    });
  }, [access, activeOrg?.id]);

  const sidebarState = useMemo(
    () =>
      resolveOrganizationSidebarState({
        tools,
        pathname,
        searchParams: new URLSearchParams(searchParams?.toString() ?? ""),
      }),
    [pathname, searchParams, tools],
  );

  useEffect(() => {
    const activeToolId = tools[sidebarState.activeToolIndex]?.id;
    if (!activeToolId) return;
    setExpandedByToolId((prev) => {
      if (prev[activeToolId]) return prev;
      return { ...prev, [activeToolId]: true };
    });
  }, [sidebarState.activeToolIndex, tools]);

  useEffect(() => {
    setOpenMenu(null);
  }, [pathname]);

  useEffect(() => {
    const handleDocumentClick = (event: globalThis.MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const inOrgMenu = (target as HTMLElement).closest("[data-sidebar-menu='org']");
      const inUserMenu = (target as HTMLElement).closest("[data-sidebar-menu='user']");
      if (inOrgMenu || inUserMenu) return;
      setOpenMenu(null);
    };
    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  const switchOrg = async (orgId: number) => {
    if (switchingOrgId) return;
    setSwitchingOrgId(orgId);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ORG_SWITCH_TIMEOUT_MS);
    try {
      const res = await fetch("/api/org-hub/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId }),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || json?.ok === false) {
        console.warn("[sidebar][org switch] falhou", json?.error ?? res.statusText);
        return;
      }
      try {
        const secureSuffix = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `orya_organization=${orgId}; path=/; Max-Age=${ORG_COOKIE_MAX_AGE}; SameSite=Lax${secureSuffix}`;
      } catch {
        // noop
      }
      setOpenMenu(null);
      onNavigate?.();
      router.replace(buildOrgHref(orgId, "/overview"));
      router.refresh();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        console.warn("[sidebar][org switch] timeout");
        return;
      }
      console.error("[sidebar][org switch] erro", err);
    } finally {
      window.clearTimeout(timeoutId);
      setSwitchingOrgId(null);
    }
  };

  const goUserMode = () => {
    try {
      const secureSuffix = window.location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `orya_organization=; path=/; Max-Age=0; SameSite=Lax${secureSuffix}`;
    } catch {
      // noop
    }
    setOpenMenu(null);
    onNavigate?.();
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
        const secureSuffix = window.location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `orya_organization=; path=/; Max-Age=0; SameSite=Lax${secureSuffix}`;
      } catch {
        // noop
      }
      setOpenMenu(null);
      onNavigate?.();
      router.push("/login?logout=1");
    }
  };

  const toggleTool = (toolId: string) => {
    setExpandedByToolId((prev) => ({
      ...prev,
      [toolId]: !prev[toolId],
    }));
  };

  const handleToolKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, toolId: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleTool(toolId);
  };

  if (collapsed) {
    return (
      <div className={cn("flex h-full min-h-0 flex-col overflow-hidden bg-[var(--org-sidebar-bg)] text-[#E6EAF2]", className)}>
        <div className="shrink-0 border-b border-[var(--org-shell-border)] p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-white/78 transition-colors hover:bg-[var(--org-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--org-sidebar-bg)]"
            aria-label="Expandir barra lateral"
            title="Expandir barra lateral"
          >
            ▸
          </button>
        </div>
        <div className="relative min-h-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-3 bg-gradient-to-b from-[var(--org-sidebar-bg)] to-transparent" />
          <div className="orya-scrollbar-subtle min-h-0 h-full overflow-y-auto overscroll-y-contain px-2 py-2">
            <div className="space-y-1">
              {tools.map((tool, index) => {
                const isActiveTool = index === sidebarState.activeToolIndex;
                return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={onToggleCollapse}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-semibold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--org-sidebar-bg)]",
                    isActiveTool
                      ? "bg-[var(--org-active-bg)] text-white"
                      : "text-[var(--org-text-muted)] hover:bg-[var(--org-hover)] hover:text-white",
                  )}
                  title={tool.label}
                  aria-label={tool.label}
                >
                    {tool.label.slice(0, 1)}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-3 bg-gradient-to-t from-[var(--org-sidebar-bg)] to-transparent" />
        </div>
        <div className="shrink-0 border-t border-[var(--org-shell-border)] p-2">
          <Avatar
            src={user?.avatarUrl ?? null}
            name={userLabel}
            className="h-8 w-8 rounded-full"
            textClassName="text-[10px] font-semibold uppercase tracking-[0.14em]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden bg-[var(--org-sidebar-bg)] text-[#E6EAF2]", className)}>
      <div className="shrink-0 border-b border-[var(--org-shell-border)] px-3 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent text-white/78 transition-colors hover:bg-[var(--org-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--org-sidebar-bg)]"
            aria-label="Colapsar barra lateral"
            title="Colapsar barra lateral"
          >
            ◂
          </button>
          <div className="relative min-w-0 flex-1" data-sidebar-menu="org">
            <button
              type="button"
              onClick={() => setOpenMenu((prev) => (prev === "org" ? null : "org"))}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-[var(--org-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--org-sidebar-bg)]"
              >
              <div className="flex min-w-0 items-center gap-2">
                <Avatar
                  src={orgAvatar}
                  name={orgDisplay}
                  className="h-8 w-8 rounded-full"
                  textClassName="text-[10px] font-semibold uppercase tracking-[0.14em]"
                />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-white/48">Organização</p>
                  <p className="truncate text-[12px] font-semibold text-white">{orgDisplay}</p>
                </div>
              </div>
              <span className="text-white/60">▾</span>
            </button>
            {openMenu === "org" ? (
              <div className="orya-menu-surface left-0 right-0 top-full mt-2 rounded-2xl p-2">
                <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.24em] text-white/50">Clubes</p>
                <div className="orya-menu-list">
                  {orgOptions.map((item) => {
                    const label =
                      item.organization.publicName ||
                      item.organization.businessName ||
                      item.organization.username ||
                      "Clube";
                    const isActive = activeOrg?.id === item.organizationId;
                    return (
                      <button
                        key={item.organizationId}
                        type="button"
                        onClick={() => void switchOrg(item.organizationId)}
                        disabled={switchingOrgId === item.organizationId}
                        className={cn("orya-menu-item text-[12px]", isActive && "bg-[var(--orya-menu-hover)]")}
                      >
                        <span className="truncate">{label}</span>
                        {isActive && <span className="text-[10px] text-white/50">Ativa</span>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 border-t border-[var(--orya-menu-divider)] pt-2">
                  <div className="orya-menu-list">
                    <Link href={buildOrgHubHref("/create")} className="orya-menu-item text-[12px]" onClick={onNavigate}>
                      Criar clube
                    </Link>
                    <Link href={buildOrgHubHref("/organizations")} className="orya-menu-item text-[12px]" onClick={onNavigate}>
                      Gerir clubes
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <OrganizationNotificationBell organizationId={activeOrg?.id ?? null} />
        </div>

        {activationItems.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activationItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                  item.tone === "danger"
                    ? "border-rose-400/55 bg-rose-500/15 text-rose-100"
                    : "border-amber-400/55 bg-amber-500/15 text-amber-100",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-2 bg-gradient-to-b from-[var(--org-sidebar-bg)] to-transparent" />
        <div className="orya-scrollbar-subtle min-h-0 h-full overflow-y-auto overscroll-y-contain px-2 py-2">
          <nav aria-label="Ferramentas da organização" className="space-y-1">
            {tools.map((tool, index) => {
              const isExpanded = expandedByToolId[tool.id] ?? false;
              const isActiveTool = index === sidebarState.activeToolIndex;
              const activeSubIndex = sidebarState.activeSubIndexByToolId[tool.id] ?? -1;
              const hasActiveSubItem = activeSubIndex >= 0;
              const highlightToolRow = isActiveTool && !hasActiveSubItem;
              return (
                <div key={tool.id}>
                <button
                  type="button"
                  onClick={() => toggleTool(tool.id)}
                  onKeyDown={(event) => handleToolKeyDown(event, tool.id)}
                  className={cn(
                      "flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--org-sidebar-bg)]",
                      highlightToolRow
                        ? "bg-[var(--org-active-bg)] text-white"
                        : "text-[var(--org-text-muted)] hover:bg-[var(--org-hover)] hover:text-white",
                  )}
                  aria-expanded={isExpanded}
                  aria-controls={`org-sidebar-panel-${tool.id}`}
                >
                  <span>{tool.label}</span>
                    <span className={cn("text-[12px] text-white/45 transition-transform", isExpanded && "rotate-180")}>▾</span>
                </button>
                {isExpanded ? (
                  <div
                    id={`org-sidebar-panel-${tool.id}`}
                    className="ml-3 mt-0.5 space-y-0.5 pl-2"
                  >
                    {tool.items.map((item, itemIndex) => {
                      const isActive = activeSubIndex === itemIndex;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={onNavigate}
                          className={cn(
                              "block rounded-md px-2 py-1.5 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--org-sidebar-bg)]",
                              isActive
                                ? "bg-[var(--org-active-bg)] text-white"
                                : "text-white/68 hover:bg-[var(--org-hover-soft)] hover:text-white",
                          )}
                          aria-current={isActive ? "page" : undefined}
                        >
                          {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-2 bg-gradient-to-t from-[var(--org-sidebar-bg)] to-transparent" />
      </div>

      <div className="shrink-0 border-t border-[var(--org-shell-border)] px-2 py-2">
        <div className="relative" data-sidebar-menu="user">
          <button
            type="button"
            onClick={() => setOpenMenu((prev) => (prev === "user" ? null : "user"))}
            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 transition-colors hover:bg-[var(--org-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--org-sidebar-bg)]"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Avatar
                src={user?.avatarUrl ?? null}
                name={userLabel}
                className="h-8 w-8 rounded-full"
                textClassName="text-[10px] font-semibold uppercase tracking-[0.14em]"
              />
              <div className="min-w-0 text-left">
                <p className="truncate text-[12px] font-semibold text-white">{userLabel}</p>
                {roleBadge ? (
                  <div className="pt-1">
                    <RoleBadge role={roleBadge} subtle />
                  </div>
                ) : null}
              </div>
            </div>
            <span className="text-white/60">▾</span>
          </button>
          {openMenu === "user" ? (
            <div className="orya-menu-surface bottom-full left-0 right-0 mb-2 rounded-2xl p-2">
              <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.24em] text-white/50">Conta</p>
              <div className="orya-menu-list">
                <button type="button" onClick={goUserMode} className="orya-menu-item text-[12px]">
                  <span>Voltar a utilizador</span>
                  <span className="text-[10px] text-white/50">↺</span>
                </button>
                <Link href="/me/settings" onClick={onNavigate} className="orya-menu-item text-[12px]">
                  <span>Definições pessoais</span>
                  <span className="text-[10px] text-white/50">↗</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="orya-menu-item text-[12px] text-rose-100 hover:bg-rose-500/15"
                >
                  <span>Terminar sessão</span>
                  <span className="text-[10px] text-rose-200">×</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
