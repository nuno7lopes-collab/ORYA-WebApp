import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import OrganizationsHubClient from "../../organizations/OrganizationsHubClient";
import { cookies } from "next/headers";
import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { Prisma } from "@prisma/client";

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
    city: string | null;
    entityType: string | null;
    status: string | null;
  };
};

export default async function OrganizationsHubPage() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  let orgs: OrgPayload[] = [];

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: { organization: true },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
  });

  orgs = memberships
    .filter((m) => m.organization)
    .map((m) => ({
      organizationId: m.organizationId,
      role: m.role,
      lastUsedAt: m.lastUsedAt ? m.lastUsedAt.toISOString() : null,
      organization: {
        id: m.organization!.id,
        username: m.organization!.username,
        publicName: m.organization!.publicName,
        businessName: m.organization!.businessName,
        city: m.organization!.city,
        entityType: m.organization!.entityType,
        status: m.organization!.status,
      },
    }));

  // Se não houver nenhuma organização, envia para o onboarding
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
    redirect("/organizacao/become");
  }

  const cookieStore = await cookies();
  const cookieOrgId = cookieStore.get("orya_organization")?.value;
  const forcedOrgId = cookieOrgId ? Number(cookieOrgId) : undefined;
  const { organization: activeOrganization } = await getActiveOrganizationForUser(user.id, {
    organizationId: Number.isFinite(forcedOrgId) ? forcedOrgId : undefined,
    allowFallback: true,
  });
  const activeId = activeOrganization?.id ?? (Number.isFinite(forcedOrgId) ? forcedOrgId! : null);

  return <OrganizationsHubClient initialOrgs={orgs} activeId={activeId} />;
}
