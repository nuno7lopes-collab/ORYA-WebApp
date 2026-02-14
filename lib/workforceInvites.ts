import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { normalizeEmail } from "@/lib/utils/email";

export type LinkPendingWorkforceInvitesResult = {
  linkedOrganizationInvites: number;
  linkedClubStaffInvites: number;
  linkedTeamMemberInvites: number;
};

export async function linkPendingWorkforceInvitesToUser(params: {
  userId: string;
  email: string | null | undefined;
}) {
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail) {
    return {
      linkedOrganizationInvites: 0,
      linkedClubStaffInvites: 0,
      linkedTeamMemberInvites: 0,
    } satisfies LinkPendingWorkforceInvitesResult;
  }

  const now = new Date();

  const linked = await prisma.$transaction(async (tx) => {
    const profile = await tx.profile.findUnique({
      where: { id: params.userId },
      select: { username: true },
    });
    const username = profile?.username?.trim().toLowerCase() ?? null;
    const identifierClauses: Prisma.OrganizationMemberInviteWhereInput[] = [
      { targetIdentifier: { equals: normalizedEmail, mode: Prisma.QueryMode.insensitive } },
      ...(username
        ? [{ targetIdentifier: { equals: username, mode: Prisma.QueryMode.insensitive } }]
        : []),
    ];

    const orgInvites = await tx.organizationMemberInvite.findMany({
      where: {
        targetUserId: null,
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: null,
        expiresAt: { gt: now },
        OR: identifierClauses,
      },
      select: {
        id: true,
        organizationId: true,
        targetIdentifier: true,
      },
      take: 500,
    });

    if (orgInvites.length > 0) {
      await tx.organizationMemberInvite.updateMany({
        where: { id: { in: orgInvites.map((invite) => invite.id) } },
        data: { targetUserId: params.userId },
      });
    }

    const staffInvites = await tx.padelClubStaffInvite.findMany({
      where: {
        targetUserId: null,
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: null,
        expiresAt: { gt: now },
        targetIdentifier: { equals: normalizedEmail, mode: Prisma.QueryMode.insensitive },
      },
      select: {
        id: true,
        organizationId: true,
        padelClubId: true,
      },
      take: 500,
    });

    if (staffInvites.length > 0) {
      await tx.padelClubStaffInvite.updateMany({
        where: { id: { in: staffInvites.map((invite) => invite.id) } },
        data: { targetUserId: params.userId },
      });
    }

    const teamInvites = await tx.padelTeamMemberInvite.findMany({
      where: {
        targetUserId: null,
        acceptedAt: null,
        declinedAt: null,
        cancelledAt: null,
        expiresAt: { gt: now },
        targetIdentifier: { equals: normalizedEmail, mode: Prisma.QueryMode.insensitive },
      },
      select: {
        id: true,
        organizationId: true,
        teamId: true,
      },
      take: 500,
    });

    if (teamInvites.length > 0) {
      await tx.padelTeamMemberInvite.updateMany({
        where: { id: { in: teamInvites.map((invite) => invite.id) } },
        data: { targetUserId: params.userId },
      });
    }

    return {
      orgInvites,
      staffInvites,
      teamInvites,
    };
  });

  for (const invite of linked.orgInvites) {
    await createNotification({
      userId: params.userId,
      type: NotificationType.ORGANIZATION_INVITE,
      title: "Convite de organização disponível",
      body: "Tens um convite pendente para entrar numa organização.",
      ctaUrl: "/convites/organizacoes",
      ctaLabel: "Ver convites",
      organizationId: invite.organizationId,
      dedupeKey: `workforce-link:org:${invite.id}`,
      payload: {
        inviteId: invite.id,
        targetIdentifier: invite.targetIdentifier,
      },
    }).catch((err) => console.warn("[workforce][link][org] notification_failed", err));
  }

  for (const invite of linked.staffInvites) {
    await createNotification({
      userId: params.userId,
      type: NotificationType.CLUB_STAFF_INVITE,
      title: "Convite de staff disponível",
      body: "Tens um convite pendente para staff de clube.",
      ctaUrl: "/convites/organizacoes",
      ctaLabel: "Ver convites",
      organizationId: invite.organizationId,
      dedupeKey: `workforce-link:club-staff:${invite.id}`,
      payload: {
        inviteId: invite.id,
        padelClubId: invite.padelClubId,
      },
    }).catch((err) => console.warn("[workforce][link][club_staff] notification_failed", err));
  }

  for (const invite of linked.teamInvites) {
    await createNotification({
      userId: params.userId,
      type: NotificationType.TEAM_MEMBER_INVITE,
      title: "Convite de equipa disponível",
      body: "Tens um convite pendente para membro de equipa.",
      ctaUrl: "/convites/organizacoes",
      ctaLabel: "Ver convites",
      organizationId: invite.organizationId,
      dedupeKey: `workforce-link:team-member:${invite.id}`,
      payload: {
        inviteId: invite.id,
        teamId: invite.teamId,
      },
    }).catch((err) => console.warn("[workforce][link][team_member] notification_failed", err));
  }

  return {
    linkedOrganizationInvites: linked.orgInvites.length,
    linkedClubStaffInvites: linked.staffInvites.length,
    linkedTeamMemberInvites: linked.teamInvites.length,
  } satisfies LinkPendingWorkforceInvitesResult;
}
