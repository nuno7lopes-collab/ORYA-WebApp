import { Prisma } from "@prisma/client";

const DEFAULT_RESERVAS_WEEKLY_INTERVALS = [{ startMinute: 9 * 60, endMinute: 19 * 60 }];
const DEFAULT_RESERVAS_WEEKLY_DAYS = [1, 2, 3, 4, 5] as const;

function toDateOnlyUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function ensureDefaultOrganizationAvailabilityForReservas(params: {
  tx: Prisma.TransactionClient;
  organizationId: number;
}) {
  const scheduleStart = toDateOnlyUtc();
  const activeSchedule = await params.tx.availabilitySchedule.findFirst({
    where: {
      organizationId: params.organizationId,
      scopeType: "ORGANIZATION",
      scopeId: 0,
      startDate: { lte: scheduleStart },
      OR: [{ endDate: null }, { endDate: { gte: scheduleStart } }],
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  const schedule =
    activeSchedule ??
    (await params.tx.availabilitySchedule.create({
      data: {
        organizationId: params.organizationId,
        scopeType: "ORGANIZATION",
        scopeId: 0,
        startDate: scheduleStart,
      },
      select: { id: true },
    }));

  const templateCount = await params.tx.weeklyAvailabilityTemplate.count({
    where: { availabilityId: schedule.id },
  });
  if (templateCount > 0) return;

  await params.tx.weeklyAvailabilityTemplate.createMany({
    data: DEFAULT_RESERVAS_WEEKLY_DAYS.map((dayOfWeek) => ({
      availabilityId: schedule.id,
      dayOfWeek,
      intervals: DEFAULT_RESERVAS_WEEKLY_INTERVALS,
    })),
    skipDuplicates: true,
  });
}

