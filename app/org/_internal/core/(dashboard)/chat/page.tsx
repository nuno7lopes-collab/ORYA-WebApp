export const runtime = "nodejs";

import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser, ORG_CONTEXT_UI } from "@/lib/organizationContext";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { CTA_SECONDARY } from "@/app/org/_internal/core/dashboardUi";
import { cn } from "@/lib/utils";
import { OrganizationMemberRole } from "@prisma/client";
import ChatInternoClient from "./ChatInternoClient";
import ChannelRequestsPanel from "./ChannelRequestsPanel";
import { buildOrgHref, buildOrgHubHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type RouteParamsInput = Promise<{ orgId?: string }> | { orgId?: string } | undefined;

export default async function OrganizationChatPage({
  params,
  searchParams,
}: {
  params?: RouteParamsInput;
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params ? Promise.resolve(params) : Promise.resolve(null),
    Promise.resolve(searchParams),
  ]);
  const routeOrgId = parseOrganizationId(resolvedParams?.orgId);
  const parsedSearchParams =
    (resolvedSearchParams ?? {}) as Record<string, string | string[] | undefined>;
  const { user } = await getCurrentUser();

  if (!user) {
    return <AuthGate />;
  }

  const rawOrgIdFromQuery = Array.isArray(parsedSearchParams.organizationId)
    ? parsedSearchParams.organizationId[0]
    : parsedSearchParams.organizationId;
  const requestedOrgIdFromQuery = parseOrganizationId(rawOrgIdFromQuery);
  const requestedOrgId = routeOrgId ?? requestedOrgIdFromQuery;
  const contextOptions = requestedOrgId
    ? {
        ...ORG_CONTEXT_UI,
        organizationId: requestedOrgId,
        allowFallback: false,
      }
    : ORG_CONTEXT_UI;

  const { organization, membership } = await getActiveOrganizationForUser(user.id, contextOptions);
  const allowedRoles = new Set<OrganizationMemberRole>([
    OrganizationMemberRole.OWNER,
    OrganizationMemberRole.CO_OWNER,
    OrganizationMemberRole.ADMIN,
    OrganizationMemberRole.STAFF,
  ]);

  if (!organization || !membership || !allowedRoles.has(membership.role)) {
    redirect(buildOrgHubHref("/organizations"));
  }

  const passthroughParams = new URLSearchParams();
  for (const [key, value] of Object.entries(parsedSearchParams)) {
    if (key === "organizationId" || typeof value === "undefined") continue;
    if (Array.isArray(value)) {
      value.forEach((item) => passthroughParams.append(key, item));
    } else {
      passthroughParams.set(key, value);
    }
  }
  const canonicalTarget = buildOrgHref(organization.id, "/chat");
  const query = passthroughParams.toString();
  const canonicalTargetWithQuery = query ? `${canonicalTarget}?${query}` : canonicalTarget;

  if (routeOrgId) {
    if (organization.id !== routeOrgId || rawOrgIdFromQuery) {
      redirect(canonicalTargetWithQuery);
    }
  } else if (!requestedOrgIdFromQuery || requestedOrgIdFromQuery !== organization.id) {
    redirect(canonicalTargetWithQuery);
  }

  const modulesRows = await prisma.organizationModuleEntry.findMany({
    where: { organizationId: organization.id, enabled: true },
    select: { moduleKey: true },
    orderBy: { moduleKey: "asc" },
  });
  const enabledModules = new Set(
    modulesRows
      .map((row) => row.moduleKey)
      .filter((module) => typeof module === "string")
      .map((module) => module.trim().toUpperCase())
      .filter((module) => module.length > 0),
  );

  if (!enabledModules.has("MENSAGENS")) {
    return (
      <div className={cn("w-full space-y-4 py-8 text-white")}>
        <div className="rounded-3xl border border-white/12 bg-gradient-to-br from-white/8 via-[#0b1124]/70 to-[#050810]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/60">Chat interno</p>
          <h1 className="text-2xl font-semibold">Ferramenta desativada</h1>
          <p className="text-sm text-white/70">
            Ativa a ferramenta nas ferramentas da organizacao para comecares a usar o chat interno.
          </p>
          <Link
            href={buildOrgHref(organization.id, "/overview", { section: "ferramentas" })}
            className={`${CTA_SECONDARY} mt-4 text-[12px]`}
          >
            Gerir ferramentas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("h-full min-h-0 w-full text-white")}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <ChannelRequestsPanel />
        <div className="min-h-0 flex-1">
          <ChatInternoClient />
        </div>
      </div>
    </div>
  );
}
