import { OrganizationMemberRole, ServiceKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";

const TRAINER_ELIGIBLE_TEAM_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

export type AcademyTrainerHardCutHygieneOptions = {
  dryRun?: boolean;
};

export type AcademyTrainerHardCutHygieneSummary = {
  organizationId: number;
  dryRun: boolean;
  scannedProfessionals: number;
  eligibleTeamMembers: number;
  invalidProfessionals: number;
  deactivatedProfessionals: number;
  purgedProfessionals: number;
  roleTitleCleared: number;
  canonicalNameUpdated: number;
  classServiceLinksRemoved: number;
  classSeriesUnlinked: number;
  futureClassSessionsUnlinked: number;
  trainerProfilesUnlinked: number;
};

function resolveCanonicalName(value: {
  profile: { fullName: string | null; username: string | null } | null;
  currentName: string;
}) {
  const fullName = value.profile?.fullName?.trim();
  if (fullName) return fullName;
  const username = value.profile?.username?.trim();
  if (username) return username;
  const fallback = value.currentName.trim();
  return fallback || "Equipa";
}

export async function runAcademyTrainerHardCutHygiene(
  organizationId: number,
  options?: AcademyTrainerHardCutHygieneOptions,
): Promise<AcademyTrainerHardCutHygieneSummary> {
  const dryRun = Boolean(options?.dryRun);

  const [members, professionals] = await Promise.all([
    listEffectiveOrganizationMembers({
      organizationId,
      roles: [...TRAINER_ELIGIBLE_TEAM_ROLES],
    }),
    prisma.reservationProfessional.findMany({
      where: { organizationId },
      select: {
        id: true,
        userId: true,
        name: true,
        roleTitle: true,
        isActive: true,
      },
      orderBy: [{ id: "asc" }],
    }),
  ]);

  const eligibleUserIds = new Set(members.map((member) => member.userId));
  const profUserIds = Array.from(
    new Set(
      professionals
        .map((professional) => professional.userId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );
  const profiles = profUserIds.length
    ? await prisma.profile.findMany({
        where: { id: { in: profUserIds } },
        select: { id: true, fullName: true, username: true },
      })
    : [];
  const profileByUserId = new Map(profiles.map((profile) => [profile.id, profile]));

  const invalidIds: number[] = [];
  const deactivateIds: number[] = [];
  const clearRoleTitleIds: number[] = [];
  const nameUpdates: Array<{ id: number; name: string }> = [];

  for (const professional of professionals) {
    const userId = professional.userId;
    const isInvalid = !userId || !eligibleUserIds.has(userId);
    if (isInvalid) {
      invalidIds.push(professional.id);
      if (professional.isActive) deactivateIds.push(professional.id);
    } else {
      const profile = profileByUserId.get(userId) ?? null;
      const canonicalName = resolveCanonicalName({
        profile,
        currentName: professional.name,
      });
      if (canonicalName !== professional.name) {
        nameUpdates.push({ id: professional.id, name: canonicalName });
      }
    }

    if (professional.roleTitle != null) {
      clearRoleTitleIds.push(professional.id);
    }
  }

  let classServiceLinksRemoved = 0;
  let classSeriesUnlinked = 0;
  let futureClassSessionsUnlinked = 0;
  let trainerProfilesUnlinked = 0;
  let purgedProfessionals = 0;

  if (!dryRun) {
    if (clearRoleTitleIds.length > 0) {
      await prisma.reservationProfessional.updateMany({
        where: { id: { in: clearRoleTitleIds } },
        data: { roleTitle: null },
      });
    }

    if (nameUpdates.length > 0) {
      await Promise.all(
        nameUpdates.map((entry) =>
          prisma.reservationProfessional.update({
            where: { id: entry.id },
            data: { name: entry.name },
            select: { id: true },
          }),
        ),
      );
    }

    if (invalidIds.length > 0) {
      await prisma.reservationProfessional.updateMany({
        where: { id: { in: invalidIds } },
        data: { isActive: false, roleTitle: null },
      });

      const [serviceLinkDelete, classSeriesUpdate, classSessionUpdate, trainerProfileUpdate] =
        await Promise.all([
          prisma.serviceProfessionalLink.deleteMany({
            where: {
              professionalId: { in: invalidIds },
              service: {
                organizationId,
                kind: ServiceKind.CLASS,
              },
            },
          }),
          prisma.classSeries.updateMany({
            where: {
              organizationId,
              professionalId: { in: invalidIds },
            },
            data: {
              professionalId: null,
            },
          }),
          prisma.classSession.updateMany({
            where: {
              organizationId,
              professionalId: { in: invalidIds },
              service: { kind: ServiceKind.CLASS },
              startsAt: { gte: new Date() },
              status: "SCHEDULED",
            },
            data: {
              professionalId: null,
            },
          }),
          prisma.trainerProfile.updateMany({
            where: {
              organizationId,
              reservationProfessionalId: { in: invalidIds },
            },
            data: {
              reservationProfessionalId: null,
            },
          }),
        ]);
      classServiceLinksRemoved = serviceLinkDelete.count;
      classSeriesUnlinked = classSeriesUpdate.count;
      futureClassSessionsUnlinked = classSessionUpdate.count;
      trainerProfilesUnlinked = trainerProfileUpdate.count;

      const purgeResult = await prisma.reservationProfessional.deleteMany({
        where: {
          id: { in: invalidIds },
          isActive: false,
        },
      });
      purgedProfessionals = purgeResult.count;
    }
  } else if (invalidIds.length > 0) {
    const [serviceLinkCount, classSeriesCount, classSessionCount, trainerProfileCount] = await Promise.all([
      prisma.serviceProfessionalLink.count({
        where: {
          professionalId: { in: invalidIds },
          service: {
            organizationId,
            kind: ServiceKind.CLASS,
          },
        },
      }),
      prisma.classSeries.count({
        where: {
          organizationId,
          professionalId: { in: invalidIds },
        },
      }),
      prisma.classSession.count({
        where: {
          organizationId,
          professionalId: { in: invalidIds },
          service: { kind: ServiceKind.CLASS },
          startsAt: { gte: new Date() },
          status: "SCHEDULED",
        },
      }),
      prisma.trainerProfile.count({
        where: {
          organizationId,
          reservationProfessionalId: { in: invalidIds },
        },
      }),
    ]);
    classServiceLinksRemoved = serviceLinkCount;
    classSeriesUnlinked = classSeriesCount;
    futureClassSessionsUnlinked = classSessionCount;
    trainerProfilesUnlinked = trainerProfileCount;
    purgedProfessionals = 0;
  }

  return {
    organizationId,
    dryRun,
    scannedProfessionals: professionals.length,
    eligibleTeamMembers: members.length,
    invalidProfessionals: deactivateIds.length,
    deactivatedProfessionals: deactivateIds.length,
    purgedProfessionals,
    roleTitleCleared: clearRoleTitleIds.length,
    canonicalNameUpdated: nameUpdates.length,
    classServiceLinksRemoved,
    classSeriesUnlinked,
    futureClassSessionsUnlinked,
    trainerProfilesUnlinked,
  };
}
