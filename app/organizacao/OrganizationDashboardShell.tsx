"use client";

import { Suspense, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ORG_SHELL_GUTTER } from "@/app/organizacao/layoutTokens";
import OrganizationTopBar from "@/app/organizacao/OrganizationTopBar";

export type OrganizationShellOrgOption = {
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
  children,
}: {
  activeOrg: OrganizationShellActiveOrg | null;
  orgOptions: OrganizationShellOrgOption[];
  user: OrganizationShellUser | null;
  role?: string | null;
  isSuspended: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full min-w-0 flex-col text-white">
      <OrganizationTopBar activeOrg={activeOrg} orgOptions={orgOptions} user={user} role={role} />
      <main
        className="relative z-0 min-h-0 w-full flex-1 overflow-y-auto pb-0 pt-[var(--org-topbar-height)]"
        data-org-scroll
      >
        <div className={cn("py-4 md:py-6", ORG_SHELL_GUTTER)}>
          {isSuspended ? (
            <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-semibold">Organizacao suspensa.</p>
                  <p className="text-[12px] text-amber-100/80">
                    Apenas leitura. Se precisares de ajuda, contacta{" "}
                    <a
                      href="mailto:oryapt@gmail.com"
                      className="underline decoration-amber-200/70 underline-offset-4"
                    >
                      oryapt@gmail.com
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          ) : null}
          <div
            className={cn("relative isolate overflow-hidden", isSuspended && "pointer-events-none select-none opacity-80")}
            aria-disabled={isSuspended || undefined}
          >
            <Suspense fallback={<DashboardShellSkeleton />}>{children}</Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
