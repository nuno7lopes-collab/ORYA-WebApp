"use client";

import { Suspense, type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ORG_SHELL_GUTTER } from "@/app/org/_internal/core/layoutTokens";
import OrganizationSidebar from "@/app/org/_internal/core/OrganizationSidebar";
import OrganizationSidebarDrawer from "@/app/org/_internal/core/OrganizationSidebarDrawer";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import OrganizationLinkInterceptor from "@/app/org/_internal/core/OrganizationLinkInterceptor";
import { ToastProvider } from "@/components/ui/toast-provider";
import {
  buildOrgHref,
  buildOrgHubHref,
  parseOrgIdFromPathnameStrict,
} from "@/lib/organizationIdUtils";

export type OrganizationShellOrgOption = {
  organizationId: number;
  role: string;
  organization: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
    entityType: string | null;
    organizationKind?: string | null;
    primaryModule?: string | null;
    status: string | null;
    brandingAvatarUrl?: string | null;
  };
};

export type OrganizationShellActiveOrg = {
  id: number;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  organizationKind?: string | null;
  primaryModule?: string | null;
  tools?: string[] | null;
};

export type OrganizationShellUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  avatarUpdatedAt?: string | number | null;
};

const SkeletonBlock = ({ className = "" }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-3xl border border-white/10 orya-skeleton-surface", className)} />
);

const SkeletonLine = ({ className = "" }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-full orya-skeleton-surface-strong", className)} />
);

const DashboardShellSkeleton = () => (
  <div className="space-y-6 text-white">
    <div className="rounded-3xl border border-white/12 bg-white/5 p-5">
      <SkeletonLine className="h-3 w-40" />
      <SkeletonLine className="mt-3 h-8 w-64" />
      <SkeletonLine className="mt-2 h-4 w-52" />
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <SkeletonBlock className="h-32" />
      <SkeletonBlock className="h-32" />
      <SkeletonBlock className="h-32" />
    </div>
    <div className="rounded-3xl border border-white/12 bg-white/5 p-5">
      <SkeletonLine className="h-3 w-28" />
      <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonBlock key={`module-skel-${index}`} className="h-14 rounded-2xl" />
        ))}
      </div>
    </div>
    <SkeletonBlock className="h-40" />
  </div>
);

const ORG_SWITCH_TIMEOUT_MS = 8_000;
const MOBILE_SIDEBAR_HEADER_HEIGHT = 49;
const SIDEBAR_COLLAPSE_STORAGE_KEY = "orya_org_sidebar_collapsed";

function parseOrganizationIdFromPathnameSafe(pathname: string | null | undefined): number | null {
  return parseOrgIdFromPathnameStrict(pathname);
}

export default function OrganizationDashboardShell({
  activeOrg,
  orgOptions,
  user,
  role,
  isSuspended,
  emailVerification,
  platformOfficialEmail,
  children,
}: {
  activeOrg: OrganizationShellActiveOrg | null;
  orgOptions: OrganizationShellOrgOption[];
  user: OrganizationShellUser | null;
  role?: string | null;
  isSuspended: boolean;
  emailVerification?: { isVerified: boolean; email: string | null; pendingEmail?: string | null } | null;
  platformOfficialEmail?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isSettingsRoute =
    pathname?.startsWith("/org/settings") ||
    pathname?.startsWith("/org/owner/confirm") ||
    pathname?.includes("/settings");
  const isChatRoute = Boolean(pathname && (/^\/org\/\d+\/chat(?:\/|$)/.test(pathname) || pathname.includes("/chat")));
  const isOverviewRoute = pathname?.includes("/overview") ?? false;
  const emailGateActive = Boolean(emailVerification && !emailVerification.isVerified);
  const [emailGateDismissed, setEmailGateDismissed] = useState(false);
  const [emailGateToast, setEmailGateToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [suspensionActionLoading, setSuspensionActionLoading] = useState(false);
  const [suspensionActionMessage, setSuspensionActionMessage] = useState<string | null>(null);
  const [isSidebarDrawerOpen, setIsSidebarDrawerOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const showEmailGate = emailGateActive && !emailGateDismissed && !isSettingsRoute;
  const syncInFlightRef = useRef(false);
  const lastSyncAttemptRef = useRef<{ id: number; at: number } | null>(null);

  useEffect(() => {
    if (!activeOrg?.id) return;
    try {
      sessionStorage.setItem("orya_last_organization_id", String(activeOrg.id));
      if (activeOrg.username) {
        sessionStorage.setItem("orya_last_organization_username", activeOrg.username);
      }
    } catch {
      // Ignore storage errors in restricted browsing contexts.
    }
  }, [activeOrg?.id, activeOrg?.username]);

  useEffect(() => {
    if (!emailGateToast) return;
    const timer = setTimeout(() => setEmailGateToast(null), 4200);
    return () => clearTimeout(timer);
  }, [emailGateToast]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY);
      setIsSidebarCollapsed(stored === "1");
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, isSidebarCollapsed ? "1" : "0");
    } catch {
      // noop
    }
  }, [isSidebarCollapsed]);

  useEffect(() => {
    setIsSidebarDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!emailGateActive || isSettingsRoute || emailGateDismissed) return;
    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    const orgMeUrl = activeOrg?.id ? `/api/org/${activeOrg.id}/me` : null;
    const checkEmailVerification = async () => {
      try {
        if (!orgMeUrl) return;
        const res = await fetch(orgMeUrl, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const officialEmailNormalized = normalizeOfficialEmail(json?.organization?.officialEmail ?? null);
        const verified = Boolean(officialEmailNormalized && json?.organization?.officialEmailVerifiedAt);
        if (isMounted && verified) {
          setEmailGateDismissed(true);
          setEmailGateToast({
            tone: "success",
            message: "Email verificado. O painel foi desbloqueado.",
          });
          router.refresh();
          if (interval) {
            clearInterval(interval);
            interval = null;
          }
        }
      } catch {
        // Sem ação: mantém o gate até próxima navegação.
      }
    };

    checkEmailVerification();
    interval = setInterval(checkEmailVerification, 12000);

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [activeOrg?.id, emailGateActive, emailGateDismissed, isSettingsRoute, router]);

  useEffect(() => {
    const requestedOrgId = parseOrganizationIdFromPathnameSafe(pathname);
    if (!requestedOrgId) return;
    if (activeOrg?.id === requestedOrgId) return;
    if (syncInFlightRef.current) return;
    if (!activeOrg?.id) return;
    const now = Date.now();
    if (lastSyncAttemptRef.current?.id === requestedOrgId && now - lastSyncAttemptRef.current.at < 10_000) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), ORG_SWITCH_TIMEOUT_MS);
    syncInFlightRef.current = true;
    lastSyncAttemptRef.current = { id: requestedOrgId, at: now };

    const syncOrgContext = async () => {
      try {
        const res = await fetch("/api/org-hub/organizations/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: requestedOrgId }),
          signal: controller.signal,
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || json?.ok === false) {
          throw new Error(json?.error || "ORG_SWITCH_FAILED");
        }
        if (!cancelled) {
          router.refresh();
        }
      } catch {
        if (cancelled) return;
        // Mantém a rota atual para evitar redirects em cascata quando há falhas transitórias
        // de sync de contexto (rede/auth). O server layout já resolve o orgId canónico.
      } finally {
        window.clearTimeout(timeoutId);
        syncInFlightRef.current = false;
      }
    };

    syncOrgContext();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [activeOrg?.id, pathname, router]);

  const handleEmailVerificationInfo = () => {
    if (!activeOrg?.id) {
      setEmailGateToast({ tone: "error", message: "Seleciona uma organização primeiro." });
      return;
    }
    const email = emailVerification?.email?.trim() ?? "";
    if (!email) {
      setEmailGateToast({ tone: "error", message: "Define um email oficial antes de continuar." });
      return;
    }
    setEmailGateToast({
      tone: "success",
      message: "Confirma a caixa de entrada e o spam para desbloquear o painel.",
    });
  };

  const settingsHref = activeOrg?.id ? buildOrgHref(activeOrg.id, "/settings") : buildOrgHubHref("/organizations");
  const canReactivateSuspendedOrg = Boolean(isSuspended && role === "OWNER" && activeOrg?.id);

  const handleReactivateSuspendedOrg = async () => {
    if (!activeOrg?.id) return;
    setSuspensionActionLoading(true);
    setSuspensionActionMessage(null);
    try {
      const invoke = async (stepUp?: { stepUpChallengeId?: string; stepUpCode?: string }) => {
        const res = await fetch(`/api/org-hub/organizations/${activeOrg.id}/suspend`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reasonCode: "OWNER_RESTORE",
            ...(stepUp?.stepUpChallengeId ? { stepUpChallengeId: stepUp.stepUpChallengeId } : {}),
            ...(stepUp?.stepUpCode ? { stepUpCode: stepUp.stepUpCode } : {}),
          }),
        });
        const json = await res.json().catch(() => null);
        return { res, json };
      };

      let { res, json } = await invoke();
      if ((!res.ok || json?.ok === false) && String(json?.errorCode ?? json?.error ?? "").toUpperCase() === "STEP_UP_REQUIRED") {
        const challengeId = typeof json?.details?.challengeId === "string" ? json.details.challengeId : undefined;
        const input =
          typeof window !== "undefined"
            ? window.prompt("Introduz o código de confirmação (6 dígitos) para reativar a organização:")
            : null;
        const code = typeof input === "string" ? input.trim() : "";
        if (!code) {
          setSuspensionActionMessage("Operação cancelada. Código não introduzido.");
          return;
        }
        const retry = await invoke({ stepUpChallengeId: challengeId, stepUpCode: code });
        res = retry.res;
        json = retry.json;
      }

      if (!res.ok || json?.ok === false) {
        setSuspensionActionMessage(json?.message || json?.error || "Não foi possível reativar.");
        return;
      }
      setSuspensionActionMessage("Organização reativada.");
      router.refresh();
    } catch (err) {
      console.error("[organization-shell][reactivate]", err);
      setSuspensionActionMessage("Erro inesperado ao reativar.");
    } finally {
      setSuspensionActionLoading(false);
    }
  };

  return (
    <div
      data-org-dashboard-shell
      style={
        {
          "--org-topbar-height": "0px",
          "--org-sidebar-bg": "#191b20",
          "--org-content-bg": "#0f1115",
          "--org-shell-border": "rgba(255,255,255,0.07)",
          "--org-hover": "rgba(255,255,255,0.06)",
          "--org-hover-soft": "rgba(255,255,255,0.04)",
          "--org-active-bg": "rgba(255,255,255,0.1)",
          "--org-text-muted": "rgba(255,255,255,0.74)",
          "--org-text-strong": "rgba(255,255,255,0.94)",
          "--org-active": "rgba(255,255,255,0.94)",
          "--orya-menu-bg": "linear-gradient(180deg, rgba(18,18,20,0.98), rgba(12,12,14,0.98))",
          "--orya-menu-bg-solid": "rgba(14,14,16,0.98)",
          "--orya-menu-border": "rgba(255,255,255,0.14)",
          "--orya-menu-hover": "rgba(255,255,255,0.08)",
          "--orya-menu-divider": "rgba(255,255,255,0.12)",
          "--orya-menu-shadow": "0 22px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)",
        } as CSSProperties
      }
      className="org-shell-root flex h-[100dvh] min-h-0 w-full min-w-0 overflow-hidden bg-[var(--org-content-bg)] text-white"
    >
      <OrganizationLinkInterceptor organizationId={activeOrg?.id ?? null} />

      <OrganizationSidebarDrawer
        isOpen={isSidebarDrawerOpen}
        onClose={() => setIsSidebarDrawerOpen(false)}
        activeOrg={activeOrg}
        orgOptions={orgOptions}
        user={user}
        role={role}
      />

      <aside
        className={cn(
          "org-shell-sidebar hidden h-full min-h-0 shrink-0 overflow-hidden border-r border-[var(--org-shell-border)] bg-[var(--org-sidebar-bg)] transition-[width,opacity] duration-200 lg:flex",
          isSidebarCollapsed
            ? "w-0 border-r-0 opacity-0 pointer-events-none"
            : "w-[var(--org-sidebar-width,288px)] opacity-100 pointer-events-auto",
        )}
      >
        {isSidebarCollapsed ? null : (
          <OrganizationSidebar
            activeOrg={activeOrg}
            orgOptions={orgOptions}
            user={user}
            role={role}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            className="h-full w-full"
          />
        )}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--org-content-bg)]">
        {isSidebarCollapsed ? (
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(false)}
            className="fixed left-3 top-3 z-[70] hidden h-8 w-8 items-center justify-center rounded-md border border-[var(--org-shell-border)] bg-[var(--org-sidebar-bg)] text-white/84 shadow-[0_10px_28px_rgba(0,0,0,0.45)] transition-colors hover:bg-[var(--org-hover)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 lg:flex"
            aria-label="Mostrar barra lateral"
            title="Mostrar barra lateral"
          >
            ☰
          </button>
        ) : null}

        {emailGateToast ? (
          <div
            className={cn(
              "fixed right-4 top-4 z-[60] rounded-2xl border px-4 py-3 text-[12px] shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
              emailGateToast.tone === "success"
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-50"
                : "border-rose-400/40 bg-rose-500/15 text-rose-100",
            )}
          >
            {emailGateToast.message}
          </div>
        ) : null}

        <ToastProvider>
          <main
            className={cn(
              "org-shell-main orya-scrollbar-subtle relative z-0 h-full min-h-0 w-full flex-1 overflow-x-hidden",
              isChatRoute ? "overflow-hidden" : "overflow-y-auto overscroll-y-contain",
            )}
            data-org-scroll
          >
            <div className="sticky top-0 z-40 border-b border-[var(--org-shell-border)] bg-[var(--org-content-bg)]/95 px-4 py-2 backdrop-blur lg:hidden">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsSidebarDrawerOpen(true)}
                  className="rounded-lg border border-transparent bg-white/[0.04] px-3 py-1.5 text-[12px] font-semibold text-white/85 hover:bg-[var(--org-hover)]"
                >
                  Menu
                </button>
                <p className="truncate text-[13px] font-semibold text-white">{activeOrg?.name ?? "Organização"}</p>
              </div>
            </div>

            <div
              className={cn(
                isChatRoute
                  ? `h-[calc(100dvh-${MOBILE_SIDEBAR_HEADER_HEIGHT}px)] min-h-0 py-0 lg:h-full`
                  : "py-4 md:py-6",
                ORG_SHELL_GUTTER,
              )}
            >
              {isSuspended ? (
                <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-semibold">Organização suspensa.</p>
                      <p className="text-[12px] text-amber-100/80">
                        Apenas leitura. Se precisares de ajuda,{" "}
                        {platformOfficialEmail ? (
                          <>
                            contacta{" "}
                            <a
                              href={`mailto:${platformOfficialEmail}`}
                              className="underline decoration-amber-200/70 underline-offset-4"
                            >
                              {platformOfficialEmail}
                            </a>
                            .
                          </>
                        ) : (
                          "contacta o suporte."
                        )}
                      </p>
                    </div>
                    {canReactivateSuspendedOrg ? (
                      <button
                        type="button"
                        onClick={handleReactivateSuspendedOrg}
                        disabled={suspensionActionLoading}
                        className="inline-flex items-center rounded-full border border-amber-200/60 bg-amber-200/15 px-4 py-2 text-[12px] font-semibold text-amber-50 hover:bg-amber-200/25 disabled:opacity-60"
                      >
                        {suspensionActionLoading ? "A reativar…" : "Reativar organização"}
                      </button>
                    ) : null}
                  </div>
                  {suspensionActionMessage ? (
                    <p className="mt-2 text-[12px] text-amber-100">{suspensionActionMessage}</p>
                  ) : null}
                </div>
              ) : null}

              {showEmailGate ? (
                <div className="rounded-3xl border border-amber-400/40 bg-amber-500/10 p-6 text-amber-50 shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-amber-100/80">Email oficial obrigatório</p>
                  <h2 className="mt-3 text-xl font-semibold">Confirma o email da organização</h2>
                  <p className="mt-2 text-sm text-amber-100/80">
                    Para desbloquear pagamentos, convites e checkout, precisamos confirmar o email oficial.
                    Enviamos um link de verificação para a caixa de entrada da organização.
                  </p>
                  {emailVerification?.email && (
                    <p className="mt-2 text-[12px] text-amber-100/70">Email atual: {emailVerification.email}</p>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <Link
                      href={settingsHref}
                      className="inline-flex items-center rounded-full border border-amber-200/60 bg-amber-200/15 px-4 py-2 text-[12px] font-semibold text-amber-50 shadow-[0_10px_26px_rgba(245,158,11,0.25)] hover:bg-amber-200/25"
                    >
                      Ir para definições
                    </Link>
                  </div>
                  <button
                    type="button"
                    onClick={handleEmailVerificationInfo}
                    className="mt-3 text-[12px] text-amber-100/80 hover:text-amber-100"
                  >
                    Precisas de ajuda? Confirma a caixa de entrada e o spam.
                  </button>
                </div>
              ) : (
                <div
                  className={cn(
                    "org-content-frame relative isolate overflow-hidden",
                    isChatRoute && "h-full min-h-0",
                    isSuspended && !isOverviewRoute && !isSettingsRoute && "pointer-events-none select-none opacity-80",
                  )}
                  aria-disabled={isSuspended || undefined}
                >
                  <Suspense fallback={<DashboardShellSkeleton />}>{children}</Suspense>
                </div>
              )}
            </div>
          </main>
        </ToastProvider>
      </div>
    </div>
  );
}
