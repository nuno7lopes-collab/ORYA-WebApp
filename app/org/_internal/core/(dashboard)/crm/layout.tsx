export const runtime = "nodejs";

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { OrganizationMemberRole, OrganizationStatus } from "@prisma/client";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { prisma } from "@/lib/prisma";
import { buildOrgHref, buildOrgHubHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type RouteParamsInput = Promise<{ orgId?: string }> | { orgId?: string } | undefined;

export default async function CrmLayout({
  children,
  params,
}: {
  children: ReactNode;
  params?: RouteParamsInput;
}) {
  const resolvedParams = params ? await Promise.resolve(params) : null;
  const requestedOrgId = parseOrganizationId(resolvedParams?.orgId);
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    ...(requestedOrgId
      ? {
          organizationId: requestedOrgId,
          allowFallback: false,
        }
      : { allowFallback: true }),
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
    roles: Object.values(OrganizationMemberRole),
  });

  if (!organization || !membership) {
    redirect(buildOrgHubHref("/organizations"));
  }

  const crmAccess = await ensureCrmModuleAccess(
    {
      id: organization.id,
      primaryModule: (organization as { primaryModule?: string | null }).primaryModule ?? null,
    },
    prisma,
    {
      member: { userId: membership.userId, role: membership.role },
      required: "VIEW",
    },
  );
  if (!crmAccess.ok) {
    redirect(buildOrgHref(organization.id, "/overview", { section: "ferramentas" }));
  }

  return <div className="space-y-6">{children}</div>;
}
