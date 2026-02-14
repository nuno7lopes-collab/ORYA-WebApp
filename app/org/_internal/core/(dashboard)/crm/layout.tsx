export const runtime = "nodejs";

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { OrganizationMemberRole, OrganizationStatus } from "@prisma/client";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { prisma } from "@/lib/prisma";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

export default async function CrmLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    allowFallback: true,
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
    roles: Object.values(OrganizationMemberRole),
  });

  if (!organization || !membership) {
    redirect(appendOrganizationIdToHref("/org/overview?section=modulos", organization?.id ?? null));
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
    redirect(appendOrganizationIdToHref("/org/overview?section=modulos", organization.id));
  }

  return <div className="space-y-6">{children}</div>;
}
