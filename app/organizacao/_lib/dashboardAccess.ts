import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser, getActiveOrganizationIdForUser } from "@/lib/organizationContext";
import { OrganizationStatus, Prisma } from "@prisma/client";
import { resolveOrganizationIdForUi } from "@/lib/organizationId";
import { listEffectiveOrganizationMembershipsForUser } from "@/lib/organizationMembers";

export type DashboardAccessResult = {
  userId: string;
  activeOrganizationId: number;
  isSuspended: boolean;
};

export async function ensureDashboardAccess(): Promise<DashboardAccessResult> {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const memberships = await listEffectiveOrganizationMembershipsForUser({
    userId: user.id,
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });
  const membershipCount = memberships.length;

  if (membershipCount === 0) {
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
  const profileActiveOrgId = await getActiveOrganizationIdForUser(user.id);
  const uiOrg = resolveOrganizationIdForUi({
    profileOrganizationId: profileActiveOrgId,
    cookieOrganizationId: cookieOrgId,
  });
  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: uiOrg.organizationId ?? undefined,
    allowFallback: false,
    allowedStatuses: [OrganizationStatus.ACTIVE, OrganizationStatus.SUSPENDED],
  });
  const activeOrganizationId = organization?.id ?? null;
  const isSuspended = organization?.status === OrganizationStatus.SUSPENDED;

  if (!activeOrganizationId) {
    redirect("/org-hub/organizations");
  }

  return {
    userId: user.id,
    activeOrganizationId,
    isSuspended,
  };
}
