export const runtime = "nodejs";

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { OrganizationMemberRole, OrganizationStatus } from "@prisma/client";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import CrmSubnav from "./CrmSubnav";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { prisma } from "@/lib/prisma";

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
    roles: Object.values(OrganizationMemberRole),
  });

  if (!organization || !membership) {
    redirect("/organizacao?tab=overview&section=modulos");
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
    redirect("/organizacao?tab=overview&section=modulos");
  }

  return (
    <div className="space-y-6">
      <CrmSubnav />
      {children}
    </div>
  );
}
