import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import OrganizationsHubClient from "@/app/org/_internal/core/organizations/OrganizationsHubClient";
import { listOrgHubOrganizationsForUser, type OrgHubOrganizationPayload } from "@/lib/orgHub/listOrganizationsForUser";
import { parseOrganizationId } from "@/lib/organizationIdUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OrgHubOrganizationsPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const orgs: OrgHubOrganizationPayload[] = await listOrgHubOrganizationsForUser({
    userId: user.id,
  });

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
  const normalizedForcedOrgId = parseOrganizationId(cookieStore.get("orya_organization")?.value);
  const { organization: activeOrganization } = await getActiveOrganizationForUser(user.id, {
    organizationId: normalizedForcedOrgId ?? undefined,
    allowFallback: true,
  });
  const activeId = activeOrganization?.id ?? normalizedForcedOrgId;

  return <OrganizationsHubClient initialOrgs={orgs} activeId={activeId} />;
}
