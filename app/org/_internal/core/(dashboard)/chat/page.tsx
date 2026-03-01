export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser, ORG_CONTEXT_UI } from "@/lib/organizationContext";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { cn } from "@/lib/utils";
import { OrganizationMemberRole } from "@prisma/client";
import ChatInternoClient from "./ChatInternoClient";
import ChannelRequestsPanel from "./ChannelRequestsPanel";
import CommunitiesManagerClient from "./CommunitiesManagerClient";
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
  const rawTab = Array.isArray(parsedSearchParams.tab)
    ? parsedSearchParams.tab[0]
    : parsedSearchParams.tab;
  const activeTab = rawTab?.trim().toLowerCase() === "comunidades" ? "comunidades" : "inbox";
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

  return (
    <div className={cn("h-full min-h-0 w-full text-white")}>
      <div className="flex h-full min-h-0 flex-col gap-3">
        {activeTab === "inbox" ? (
          <>
            <ChannelRequestsPanel />
            <div className="min-h-0 flex-1">
              <ChatInternoClient />
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1">
            <CommunitiesManagerClient />
          </div>
        )}
      </div>
    </div>
  );
}
