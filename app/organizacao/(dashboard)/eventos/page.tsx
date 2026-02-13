export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import DashboardClient from "@/app/organizacao/DashboardClient";
import { getOrganizationActiveModules, hasAnyActiveModule } from "@/lib/organizationModules";
import { prisma } from "@/lib/prisma";
import { OrganizationStatus } from "@prisma/client";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

export default async function OrganizationEventosPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    allowFallback: true,
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });

  if (!organization) {
    redirect("/org-hub/organizations");
  }

  const { activeModules } = await getOrganizationActiveModules(
    organization.id,
    (organization as { primaryModule?: string | null }).primaryModule ?? null,
    prisma,
  );
  if (!hasAnyActiveModule(activeModules, ["EVENTOS"])) {
    redirect(appendOrganizationIdToHref("/organizacao/overview?section=modulos", organization.id));
  }

  return <DashboardClient hasOrganization defaultObjective="manage" defaultSection="eventos" />;
}
