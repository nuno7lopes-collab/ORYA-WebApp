export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import DashboardClient from "@/app/org/_internal/core/DashboardClient";
import { getOrganizationActiveModules, hasAnyActiveModule } from "@/lib/organizationModules";
import { prisma } from "@/lib/prisma";
import { OrganizationStatus } from "@prisma/client";
import { buildOrgHref, buildOrgHubHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type RouteParamsInput = Promise<{ orgId?: string }> | { orgId?: string } | undefined;

export default async function OrganizationEventosPage({ params }: { params?: RouteParamsInput } = {}) {
  const resolvedParams = params ? await Promise.resolve(params) : null;
  const requestedOrgId = parseOrganizationId(resolvedParams?.orgId);
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    ...(requestedOrgId
      ? {
          organizationId: requestedOrgId,
          allowFallback: false,
        }
      : { allowFallback: true }),
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });

  if (!organization) {
    redirect(buildOrgHubHref("/organizations"));
  }

  const { activeModules } = await getOrganizationActiveModules(
    organization.id,
    (organization as { primaryModule?: string | null }).primaryModule ?? null,
    prisma,
  );
  if (!hasAnyActiveModule(activeModules, ["EVENTOS"])) {
    redirect(buildOrgHref(organization.id, "/overview", { section: "ferramentas" }));
  }

  return <DashboardClient hasOrganization defaultObjective="manage" defaultSection="eventos" />;
}
