import { AuthGate } from "@/app/components/autenticação/AuthGate";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import GroupDashboardClient from "@/app/org/_internal/core/organizations/GroupDashboardClient";
import { OrganizationMemberRole } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePositiveInt(raw: string | null | undefined) {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

type GroupDashboardPageProps = {
  params: Promise<{ groupId: string }> | { groupId: string };
};

export default async function GroupDashboardPage({ params }: GroupDashboardPageProps) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <AuthGate />;
  }

  const resolvedParams = await params;
  const groupId = parsePositiveInt(resolvedParams.groupId);
  if (!groupId) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          Grupo inválido.
        </div>
      </div>
    );
  }

  const group = await prisma.organizationGroup.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, ownerUserId: true },
  });
  if (!group) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
          Grupo não encontrado.
        </div>
      </div>
    );
  }

  const isOwner = group.ownerUserId === user.id;
  if (!isOwner) {
    const governanceMember = await prisma.organizationGroupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
        isGovernance: true,
        scopeAllOrgs: true,
        role: { in: [OrganizationMemberRole.OWNER, OrganizationMemberRole.CO_OWNER, OrganizationMemberRole.ADMIN] },
      },
      select: { id: true },
    });
    if (!governanceMember) {
      return (
        <div className="mx-auto w-full max-w-[1240px] px-4 py-16 text-white sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            Sem permissões para ver este grupo.
          </div>
        </div>
      );
    }
  }

  const organizations = await prisma.organization.findMany({
    where: { groupId },
    select: { id: true, publicName: true, businessName: true, username: true, status: true },
    orderBy: { id: "asc" },
  });
  const organizationIds = organizations.map((org) => org.id);

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [professionals, resources, upcomingAgendaCount] = await Promise.all([
    prisma.reservationProfessional.findMany({
      where: { organizationId: { in: organizationIds }, isActive: true },
      select: { id: true, name: true, roleTitle: true, organizationId: true, isActive: true },
      orderBy: [{ organizationId: "asc" }, { name: "asc" }],
      take: 2000,
    }),
    prisma.reservationResource.findMany({
      where: { organizationId: { in: organizationIds }, isActive: true },
      select: { id: true, label: true, capacity: true, organizationId: true, isActive: true },
      orderBy: [{ organizationId: "asc" }, { label: "asc" }],
      take: 2000,
    }),
    prisma.agendaItem.count({
      where: {
        organizationId: { in: organizationIds },
        startsAt: { gte: now, lte: nextWeek },
        status: { not: "DELETED" },
      },
    }),
  ]);

  return (
    <GroupDashboardClient
      group={{ id: group.id, name: group.name, ownerUserId: group.ownerUserId }}
      organizations={organizations.map((org) => ({
        id: org.id,
        name: org.publicName?.trim() || org.businessName?.trim() || `Organização #${org.id}`,
        username: org.username,
        status: org.status,
      }))}
      metrics={{
        organizations: organizations.length,
        professionals: professionals.length,
        resources: resources.length,
        upcomingAgenda: upcomingAgendaCount,
      }}
      professionals={professionals}
      resources={resources}
    />
  );
}
