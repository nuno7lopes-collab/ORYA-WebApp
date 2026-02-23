import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });
config();

type AssignmentMode = "PROFESSIONAL_ONLY" | "RESOURCE_ONLY" | "PROFESSIONAL_AND_RESOURCE";

function normalizeAssignmentMode(value?: string | null, fallback: AssignmentMode = "PROFESSIONAL_ONLY"): AssignmentMode {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (normalized === "PROFESSIONAL_ONLY" || normalized === "PROFESSIONAL") return "PROFESSIONAL_ONLY";
  if (normalized === "RESOURCE_ONLY" || normalized === "RESOURCE") return "RESOURCE_ONLY";
  if (normalized === "PROFESSIONAL_AND_RESOURCE") return "PROFESSIONAL_AND_RESOURCE";
  return fallback;
}

function requiresProfessional(mode: AssignmentMode) {
  return mode === "PROFESSIONAL_ONLY" || mode === "PROFESSIONAL_AND_RESOURCE";
}

function requiresResource(mode: AssignmentMode) {
  return mode === "RESOURCE_ONLY" || mode === "PROFESSIONAL_AND_RESOURCE";
}

function toDateOnlyUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (key: string) => args.find((arg) => arg.startsWith(`${key}=`))?.split("=")[1];
  return {
    orgUsername: get("--org-username") ?? process.env.SEED_RESERVAS_ORG_USERNAME ?? "top_padel",
  };
}

function defaultProfessionalIntervals() {
  return [
    { startMinute: 8 * 60, endMinute: 12 * 60 + 30 },
    { startMinute: 14 * 60, endMinute: 20 * 60 },
  ];
}

function defaultResourceIntervals() {
  return [{ startMinute: 7 * 60, endMinute: 23 * 60 }];
}

async function main() {
  const { orgUsername } = parseArgs();
  const databaseUrl = process.env.DATABASE_URL;
  const adapter =
    databaseUrl && databaseUrl.startsWith("postgres")
      ? new PrismaPg({ connectionString: databaseUrl })
      : null;
  const prisma = new PrismaClient(adapter ? { adapter } : undefined);

  try {
    const organization = await prisma.organization.findFirst({
      where: { username: orgUsername, status: "ACTIVE" },
      select: {
        id: true,
        username: true,
        publicName: true,
        businessName: true,
        groupId: true,
        reservationAssignmentMode: true,
      },
    });

    if (!organization) {
      throw new Error(`Organização '${orgUsername}' não encontrada ou inativa.`);
    }

    const scheduleStart = toDateOnlyUtc(new Date());

    const courts = await prisma.padelClubCourt.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        club: { organizationId: organization.id, deletedAt: null },
      },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        displayOrder: true,
        isActive: true,
      },
    });

    const existingCourtResources = await prisma.reservationResource.findMany({
      where: {
        organizationId: organization.id,
        courtId: { not: null },
      },
      select: { id: true, courtId: true },
    });
    const resourceByCourtId = new Map(
      existingCourtResources
        .filter((row) => row.courtId != null)
        .map((row) => [row.courtId as number, row.id]),
    );

    let createdCourtResources = 0;
    for (const court of courts) {
      if (resourceByCourtId.has(court.id)) continue;
      const created = await prisma.reservationResource.create({
        data: {
          organizationId: organization.id,
          courtId: court.id,
          label: court.name,
          capacity: 4,
          priority: court.displayOrder ?? 0,
          isActive: court.isActive,
        },
        select: { id: true },
      });
      resourceByCourtId.set(court.id, created.id);
      createdCourtResources += 1;
    }

    const professionals = await prisma.reservationProfessional.findMany({
      where: { organizationId: organization.id, isActive: true },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
      select: { id: true, userId: true, name: true },
    });

    let createdProfessionals = 0;
    if (professionals.length === 0) {
      const trainerProfiles = await prisma.trainerProfile.findMany({
        where: { organizationId: organization.id },
        select: {
          userId: true,
          user: { select: { fullName: true, username: true } },
        },
      });

      let candidateUsers = trainerProfiles.map((trainer) => ({
        userId: trainer.userId,
        name: trainer.user.fullName?.trim() || trainer.user.username?.trim() || "Treinador",
      }));

      if (candidateUsers.length === 0 && organization.groupId) {
        const groupMembers = await prisma.organizationGroupMember.findMany({
          where: {
            groupId: organization.groupId,
            OR: [{ scopeAllOrgs: true }, { scopeOrgIds: { has: organization.id } }],
          },
          orderBy: [{ createdAt: "asc" }],
          select: {
            userId: true,
            user: { select: { fullName: true, username: true } },
          },
          take: 8,
        });
        candidateUsers = groupMembers.map((member) => ({
          userId: member.userId,
          name: member.user.fullName?.trim() || member.user.username?.trim() || "Equipa",
        }));
      }

      const dedupedCandidates = Array.from(
        new Map(candidateUsers.map((candidate) => [candidate.userId, candidate])).values(),
      );

      for (let idx = 0; idx < dedupedCandidates.length; idx += 1) {
        const candidate = dedupedCandidates[idx];
        const created = await prisma.reservationProfessional.create({
          data: {
            organizationId: organization.id,
            userId: candidate.userId,
            name: candidate.name,
            roleTitle: "Treinador",
            priority: idx,
            isActive: true,
          },
          select: { id: true, userId: true, name: true },
        });
        professionals.push(created);
        createdProfessionals += 1;
      }
    }

    if (professionals.length === 0) {
      throw new Error("Sem profissionais ativos para criar disponibilidade.");
    }

    const resources = await prisma.reservationResource.findMany({
      where: { organizationId: organization.id, isActive: true },
      orderBy: [{ priority: "asc" }, { id: "asc" }],
      select: { id: true, courtId: true },
    });

    let schedulesCreated = 0;
    let templatesCreated = 0;

    for (const professional of professionals) {
      let schedule = await prisma.availabilitySchedule.findFirst({
        where: {
          organizationId: organization.id,
          scopeType: "PROFESSIONAL",
          scopeId: professional.id,
          startDate: { lte: scheduleStart },
          OR: [{ endDate: null }, { endDate: { gte: scheduleStart } }],
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        select: { id: true },
      });
      if (!schedule) {
        schedule = await prisma.availabilitySchedule.create({
          data: {
            organizationId: organization.id,
            scopeType: "PROFESSIONAL",
            scopeId: professional.id,
            startDate: scheduleStart,
          },
          select: { id: true },
        });
        schedulesCreated += 1;
      }

      const templateCount = await prisma.weeklyAvailabilityTemplate.count({
        where: { availabilityId: schedule.id },
      });
      if (templateCount === 0) {
        await prisma.weeklyAvailabilityTemplate.createMany({
          data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
            availabilityId: schedule.id,
            dayOfWeek,
            intervals: defaultProfessionalIntervals(),
          })),
          skipDuplicates: true,
        });
        templatesCreated += 5;
      }
    }

    for (const resource of resources) {
      let schedule = await prisma.availabilitySchedule.findFirst({
        where: {
          organizationId: organization.id,
          scopeType: "RESOURCE",
          scopeId: resource.id,
          startDate: { lte: scheduleStart },
          OR: [{ endDate: null }, { endDate: { gte: scheduleStart } }],
        },
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        select: { id: true },
      });
      if (!schedule) {
        schedule = await prisma.availabilitySchedule.create({
          data: {
            organizationId: organization.id,
            scopeType: "RESOURCE",
            scopeId: resource.id,
            startDate: scheduleStart,
          },
          select: { id: true },
        });
        schedulesCreated += 1;
      }

      const templateCount = await prisma.weeklyAvailabilityTemplate.count({
        where: { availabilityId: schedule.id },
      });
      if (templateCount === 0) {
        await prisma.weeklyAvailabilityTemplate.createMany({
          data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
            availabilityId: schedule.id,
            dayOfWeek,
            intervals: defaultResourceIntervals(),
          })),
          skipDuplicates: true,
        });
        templatesCreated += 7;
      }
    }

    const services = await prisma.service.findMany({
      where: { organizationId: organization.id, isActive: true },
      select: {
        id: true,
        kind: true,
        assignmentMode: true,
        professionalLinks: { select: { professionalId: true } },
        resourceLinks: { select: { resourceId: true } },
      },
    });

    let linkedProfessionalsCount = 0;
    let linkedResourcesCount = 0;

    const orgMode = normalizeAssignmentMode(organization.reservationAssignmentMode ?? null);
    const allProfessionalIds = professionals.map((professional) => professional.id);
    const allResourceIds = resources.map((resource) => resource.id);
    const courtResourceIds = resources.filter((resource) => resource.courtId != null).map((resource) => resource.id);

    for (const service of services) {
      const resolvedMode = normalizeAssignmentMode(service.assignmentMode ?? null, orgMode);
      const targetResourceIds = service.kind === "COURT" ? courtResourceIds : allResourceIds;

      if (requiresProfessional(resolvedMode) && service.professionalLinks.length === 0 && allProfessionalIds.length > 0) {
        await prisma.serviceProfessionalLink.createMany({
          data: allProfessionalIds.map((professionalId) => ({
            serviceId: service.id,
            professionalId,
          })),
          skipDuplicates: true,
        });
        linkedProfessionalsCount += allProfessionalIds.length;
      }

      if (requiresResource(resolvedMode) && service.resourceLinks.length === 0 && targetResourceIds.length > 0) {
        await prisma.serviceResourceLink.createMany({
          data: targetResourceIds.map((resourceId) => ({
            serviceId: service.id,
            resourceId,
          })),
          skipDuplicates: true,
        });
        linkedResourcesCount += targetResourceIds.length;
      }
    }

    const orgLabel = organization.publicName || organization.businessName || organization.username || String(organization.id);
    console.log(`[reservas-bootstrap] organização: ${orgLabel} (#${organization.id})`);
    console.log(`[reservas-bootstrap] campos ativos: ${courts.length} | recursos ativos: ${resources.length}`);
    console.log(`[reservas-bootstrap] profissionais ativos: ${professionals.length}`);
    console.log(`[reservas-bootstrap] recursos de campo criados: ${createdCourtResources}`);
    console.log(`[reservas-bootstrap] profissionais criados: ${createdProfessionals}`);
    console.log(`[reservas-bootstrap] schedules criados: ${schedulesCreated} | templates criados: ${templatesCreated}`);
    console.log(`[reservas-bootstrap] links profissionais adicionados: ${linkedProfessionalsCount}`);
    console.log(`[reservas-bootstrap] links recursos adicionados: ${linkedResourcesCount}`);
    console.log("[reservas-bootstrap] concluído.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[reservas-bootstrap] erro:", error);
  process.exit(1);
});
