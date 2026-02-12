"use client";

import { Suspense, type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ORG_SHELL_GUTTER } from "@/app/organizacao/layoutTokens";
import OrganizationTopBar from "@/app/organizacao/OrganizationTopBar";
import { normalizeOfficialEmail } from "@/lib/organizationOfficialEmailUtils";
import OrganizationLinkInterceptor from "@/app/organizacao/OrganizationLinkInterceptor";
import { ToastProvider } from "@/components/ui/toast-provider";
import {
  appendOrganizationIdToHref,
  parseOrganizationId,
  parseOrganizationIdFromPathname,
  setOrganizationIdInHref,
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
  modules?: string[] | null;
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
  emailVerification?: { isVerified: boolean; email: string | null } | null;
  platformOfficialEmail?: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSettingsRoute =
    pathname?.startsWith("/organizacao/settings") ||
    pathname?.startsWith("/organizacao/owner/confirm") ||
    pathname?.includes("/settings");
  const isChatRoute = pathname?.startsWith("/organizacao/chat") || pathname?.includes("/chat");
  const emailGateActive = Boolean(emailVerification && !emailVerification.isVerified);
  const [emailGateDismissed, setEmailGateDismissed] = useState(false);
  const [emailGateToast, setEmailGateToast] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const showEmailGate = emailGateActive && !emailGateDismissed && !isSettingsRoute;
  const syncInFlightRef = useRef(false);
  const lastSyncAttemptRef = useRef<{ id: number; at: number } | null>(null);

  useEffect(() => {
    if (!emailGateToast) return;
    const timer = setTimeout(() => setEmailGateToast(null), 4200);
    return () => clearTimeout(timer);
  }, [emailGateToast]);

  useEffect(() => {
    if (!emailGateActive || isSettingsRoute || emailGateDismissed) return;
    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    const orgMeUrl = activeOrg?.id ? `/api/organizacao/me?organizationId=${activeOrg.id}` : null;
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
    const requestedOrgId =
      parseOrganizationId(searchParams?.get("organizationId")) ?? parseOrganizationIdFromPathname(pathname);
    if (!requestedOrgId) return;
    if (activeOrg?.id === requestedOrgId) return;
    if (syncInFlightRef.current) return;
    if (!activeOrg?.id) return;
    const now = Date.now();
    if (lastSyncAttemptRef.current?.id === requestedOrgId && now - lastSyncAttemptRef.current.at < 10_000) {
      return;
    }

    let cancelled = false;
    syncInFlightRef.current = true;
    lastSyncAttemptRef.current = { id: requestedOrgId, at: now };

    const syncOrgContext = async () => {
      try {
        const res = await fetch("/api/organizacao/organizations/switch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId: requestedOrgId }),
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
        const fallbackOrgId = activeOrg?.id ?? null;
        if (fallbackOrgId && fallbackOrgId !== requestedOrgId) {
          const currentParams = new URLSearchParams(searchParams?.toString());
          currentParams.set("organizationId", String(fallbackOrgId));
          const query = currentParams.toString();
          const target = query ? `${pathname}?${query}` : pathname ?? "/organizacao";
          router.replace(setOrganizationIdInHref(target, fallbackOrgId));
        } else {
          router.replace("/organizacao/organizations");
        }
      } finally {
        syncInFlightRef.current = false;
      }
    };

    syncOrgContext();

    return () => {
      cancelled = true;
    };
  }, [activeOrg?.id, pathname, router, searchParams]);

  useEffect(() => {
    if (!activeOrg?.id) return;
    const currentParams = new URLSearchParams(searchParams?.toString());
    const existing = currentParams.get("organizationId");
    if (existing) return;
    currentParams.set("organizationId", String(activeOrg.id));
    const query = currentParams.toString();
    const target = query ? `${pathname}?${query}` : pathname;
    router.replace(target);
  }, [activeOrg?.id, pathname, router, searchParams]);

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
  const settingsHref = appendOrganizationIdToHref("/organizacao/settings", activeOrg?.id ?? null);

  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col text-white">
      <OrganizationLinkInterceptor organizationId={activeOrg?.id ?? null} />
      <OrganizationTopBar activeOrg={activeOrg} orgOptions={orgOptions} user={user} role={role} />
      {emailGateToast ? (
        <div
          className={cn(
            "fixed right-4 top-[calc(var(--org-topbar-height)+12px)] z-[60] rounded-2xl border px-4 py-3 text-[12px] shadow-[0_16px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl",
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
            "relative z-0 min-h-0 w-full flex-1 pb-0 pt-[var(--org-topbar-height)]",
            isChatRoute ? "overflow-hidden" : "overflow-y-auto",
          )}
          data-org-scroll
        >
          <div
            className={cn(
              isChatRoute ? "h-[calc(100vh-var(--org-topbar-height))] min-h-0 py-0" : "py-4 md:py-6",
              ORG_SHELL_GUTTER,
            )}
          >
            {isSuspended ? (
              <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <p className="font-semibold">Organizacao suspensa.</p>
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
                </div>
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
                  "relative isolate overflow-hidden",
                  isChatRoute && "h-full min-h-0",
                  isSuspended && "pointer-events-none select-none opacity-80",
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
  );
}
