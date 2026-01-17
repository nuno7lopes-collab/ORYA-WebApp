export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import DashboardClient from "@/app/organizacao/DashboardClient";
import { getOrganizationActiveModules, hasAnyActiveModule } from "@/lib/organizationModules";
import { prisma } from "@/lib/prisma";
import { OrganizationStatus } from "@prisma/client";

export default async function OrganizationTorneiosPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });

  if (!organization) {
    redirect("/organizacao/organizations");
  }

  const { activeModules } = await getOrganizationActiveModules(
    organization.id,
    (organization as { primaryModule?: string | null }).primaryModule ?? null,
    prisma,
  );
  if (!hasAnyActiveModule(activeModules, ["TORNEIOS"])) {
    redirect("/organizacao?tab=overview&section=modulos");
  }

  return <DashboardClient hasOrganization defaultObjective="manage" defaultSection="eventos" />;
}
