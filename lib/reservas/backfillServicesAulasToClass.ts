import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaLike = Pick<PrismaClient, "service" | "availability"> | Prisma.TransactionClient;

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const LESSON_TAG = "AULAS";
const KEYWORDS = ["aula", "aulas", "treino", "treinos", "lesson", "class", "coaching", "clinic"];

const toPositiveLimit = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(value as number)), MAX_LIMIT);
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeTag = (value: string | null | undefined) => (value ?? "").trim().toUpperCase();

const isClearlyClassByText = (service: { title: string; description: string | null; categoryTag: string | null }) => {
  const haystack = `${normalizeText(service.title)} ${normalizeText(service.description)}`;
  return KEYWORDS.some((keyword) => haystack.includes(keyword));
};

type AvailabilityPoint = {
  startsAt: Date;
  durationMinutes: number;
};

function hasRecurringAvailabilityPattern(points: AvailabilityPoint[]) {
  if (points.length < 3) return false;
  const buckets = new Map<string, Set<number>>();

  for (const point of points) {
    const startsAt = point.startsAt;
    if (!(startsAt instanceof Date) || Number.isNaN(startsAt.getTime())) continue;
    const duration = Number.isFinite(point.durationMinutes) ? Math.max(0, Math.floor(point.durationMinutes)) : 0;
    if (duration <= 0) continue;

    const weekday = startsAt.getUTCDay();
    const minute = startsAt.getUTCHours() * 60 + startsAt.getUTCMinutes();
    const weekBucket = Math.floor(startsAt.getTime() / (7 * 24 * 60 * 60 * 1000));
    const key = `${weekday}:${minute}:${duration}`;
    if (!buckets.has(key)) {
      buckets.set(key, new Set<number>());
    }
    buckets.get(key)?.add(weekBucket);
  }

  for (const weeks of buckets.values()) {
    if (weeks.size >= 3) return true;
  }
  return false;
}

export type BackfillServicesAulasToClassOptions = {
  dryRun?: boolean;
  limit?: number | null;
  afterId?: number | null;
  logger?: (message: string) => void;
};

export type BackfillServicesAulasToClassSummary = {
  dryRun: boolean;
  limit: number;
  lastId: number | null;
  scanned: number;
  eligible: number;
  converted: number;
  skipped: number;
  manualReview: number;
  recurringConverted: number;
  clearlyClassConverted: number;
  errors: number;
};

export async function backfillServicesAulasToClass(
  prisma: PrismaLike,
  options?: BackfillServicesAulasToClassOptions,
): Promise<BackfillServicesAulasToClassSummary> {
  const dryRun = Boolean(options?.dryRun);
  const limit = toPositiveLimit(options?.limit ?? null);
  const afterId = Number.isFinite(options?.afterId) ? Number(options?.afterId) : null;
  const logger = options?.logger ?? (() => {});

  const services = await prisma.service.findMany({
    where: {
      kind: "GENERAL",
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: [{ id: "asc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      categoryTag: true,
      _count: {
        select: {
          classSeries: true,
          classSessions: true,
          availabilities: true,
        },
      },
    },
  });

  const lastId = services.length > 0 ? services[services.length - 1]?.id ?? null : null;

  let eligible = 0;
  let converted = 0;
  let skipped = 0;
  let manualReview = 0;
  let recurringConverted = 0;
  let clearlyClassConverted = 0;
  let errors = 0;

  logger(
    `[services_aulas_backfill] found=${services.length} limit=${limit} afterId=${afterId ?? "none"} mode=${
      dryRun ? "dry-run" : "apply"
    }`,
  );

  for (const service of services) {
    try {
      const isAulas = normalizeTag(service.categoryTag) === LESSON_TAG;
      if (!isAulas) {
        skipped += 1;
        continue;
      }

      eligible += 1;

      let recurring = service._count.classSeries > 0 || service._count.classSessions > 0;
      if (!recurring && service._count.availabilities >= 3) {
        const availabilities = await prisma.availability.findMany({
          where: { serviceId: service.id },
          orderBy: [{ startsAt: "asc" }],
          take: 300,
          select: {
            startsAt: true,
            durationMinutes: true,
          },
        });
        recurring = hasRecurringAvailabilityPattern(availabilities);
      }

      const clearlyClass = isClearlyClassByText(service);
      const shouldConvert = recurring || clearlyClass;

      if (!shouldConvert) {
        manualReview += 1;
        skipped += 1;
        logger(`[services_aulas_backfill] SKIP service=${service.id} reason=MANUAL_REVIEW`);
        continue;
      }

      if (!dryRun) {
        await prisma.service.update({
          where: { id: service.id },
          data: { kind: "CLASS" },
        });
      }

      converted += 1;
      if (recurring) recurringConverted += 1;
      if (!recurring && clearlyClass) clearlyClassConverted += 1;

      logger(
        `[services_aulas_backfill] CONVERT service=${service.id} recurring=${recurring} clearlyClass=${clearlyClass}`,
      );
    } catch (err) {
      errors += 1;
      logger(
        `[services_aulas_backfill] ERROR service=${service.id} message=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  return {
    dryRun,
    limit,
    lastId,
    scanned: services.length,
    eligible,
    converted,
    skipped,
    manualReview,
    recurringConverted,
    clearlyClassConverted,
    errors,
  };
}
