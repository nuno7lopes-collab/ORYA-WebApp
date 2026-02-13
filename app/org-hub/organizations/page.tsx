import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { OrganizationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { listEffectiveOrganizationMembershipsForUser } from "@/lib/organizationMembers";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import OrganizationsHubClient from "@/app/organizacao/organizations/OrganizationsHubClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OrgPayload = {
  organizationId: number;
  role: string;
  lastUsedAt: string | null;
  organization: {
    id: number;
    username: string | null;
    publicName: string | null;
    businessName: string | null;
    entityType: string | null;
    status: string | null;
  };
};

export default async function OrgHubOrganizationsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const memberships = await listEffectiveOrganizationMembershipsForUser({
    userId: user.id,
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });

  const orgs: OrgPayload[] = memberships.map((m) => ({
    organizationId: m.organizationId,
    role: m.role,
    lastUsedAt: null,
    organization: {
      id: m.organization.id,
      username: m.organization.username,
      publicName: m.organization.publicName,
      businessName: m.organization.businessName,
      entityType: m.organization.entityType,
      status: m.organization.status,
    },
  }));

  if (orgs.length === 0) {
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { username: true },
    });
    const viewerEmail = user.email?.toLowerCase() ?? null;
    const viewerUsername = profile?.username ?? null;
    const pendingInvite = await prisma.organizationMemberInvite.findFirst({
      where: {
        cancelledAt: null,
        acceptedAt: null,
        declinedAt: null,
        expiresAt: { gt: new Date() },
        OR: [
          { targetUserId: user.id },
          ...(viewerEmail
            ? [{ targetIdentifier: { equals: viewerEmail, mode: Prisma.QueryMode.insensitive } }]
            : []),
          ...(viewerUsername
            ? [{ targetIdentifier: { equals: viewerUsername, mode: Prisma.QueryMode.insensitive } }]
            : []),
        ],
      },
    });
    if (pendingInvite) {
      redirect("/convites/organizacoes");
    }
    redirect("/org-hub/create");
  }

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get("orya_organization")?.value;
  const forcedOrgId = cookieOrgId ? Number(cookieOrgId) : undefined;
  const normalizedForcedOrgId =
    typeof forcedOrgId === "number" && Number.isFinite(forcedOrgId) ? forcedOrgId : null;
  const { organization: activeOrganization } = await getActiveOrganizationForUser(user.id, {
    organizationId: normalizedForcedOrgId ?? undefined,
    allowFallback: true,
  });
  const activeId = activeOrganization?.id ?? normalizedForcedOrgId;

  return <OrganizationsHubClient initialOrgs={orgs} activeId={activeId} />;
}
