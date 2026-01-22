import {
  CrmInteractionType,
  LoyaltyEntryType,
  LoyaltyProgramStatus,
  LoyaltyRuleTrigger,
  LoyaltySourceType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CustomerSnapshot = {
  totalSpentCents: number;
  totalOrders: number;
  totalBookings: number;
  totalAttendances: number;
  totalTournaments: number;
  totalStoreOrders: number;
  tags: string[];
};

type ApplyInput = {
  organizationId: number;
  userId: string;
  interactionType: CrmInteractionType;
  sourceId?: string | null;
  occurredAt: Date;
  amountCents?: number | null;
  customerSnapshot: CustomerSnapshot;
};

type PrismaClientLike = Prisma.TransactionClient | PrismaClient;

const INTERACTION_TO_TRIGGER: Partial<Record<CrmInteractionType, LoyaltyRuleTrigger>> = {
  STORE_ORDER_PAID: LoyaltyRuleTrigger.STORE_ORDER_PAID,
  BOOKING_COMPLETED: LoyaltyRuleTrigger.BOOKING_COMPLETED,
  BOOKING_CONFIRMED: LoyaltyRuleTrigger.BOOKING_COMPLETED,
  EVENT_CHECKIN: LoyaltyRuleTrigger.EVENT_CHECKIN,
  PADEL_TOURNAMENT_ENTRY: LoyaltyRuleTrigger.TOURNAMENT_PARTICIPATION,
  MEMBERSHIP_RENEWED: LoyaltyRuleTrigger.MEMBERSHIP_RENEWAL,
};

const INTERACTION_TO_SOURCE: Partial<Record<CrmInteractionType, LoyaltySourceType>> = {
  STORE_ORDER_PAID: LoyaltySourceType.ORDER,
  BOOKING_COMPLETED: LoyaltySourceType.BOOKING,
  BOOKING_CONFIRMED: LoyaltySourceType.BOOKING,
  EVENT_CHECKIN: LoyaltySourceType.CHECKIN,
  PADEL_TOURNAMENT_ENTRY: LoyaltySourceType.TOURNAMENT,
  MEMBERSHIP_RENEWED: LoyaltySourceType.MEMBERSHIP,
};

function startOfDayUtc(date: Date) {
  const utc = new Date(date.getTime());
  utc.setUTCHours(0, 0, 0, 0);
  return utc;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function matchesConditions(conditions: Prisma.JsonValue | null | undefined, input: ApplyInput): boolean {
  if (!conditions || typeof conditions !== "object") return true;
  const data = conditions as Record<string, unknown>;

  const minAmount = parseNumber(data.minAmountCents);
  if (minAmount !== null && (input.amountCents ?? 0) < minAmount) return false;

  const maxAmount = parseNumber(data.maxAmountCents);
  if (maxAmount !== null && (input.amountCents ?? 0) > maxAmount) return false;

  const minTotalSpent = parseNumber(data.minTotalSpentCents);
  if (minTotalSpent !== null && input.customerSnapshot.totalSpentCents < minTotalSpent) return false;

  const minTotalOrders = parseNumber(data.minTotalOrders);
  if (minTotalOrders !== null && input.customerSnapshot.totalOrders < minTotalOrders) return false;

  const minTotalBookings = parseNumber(data.minTotalBookings);
  if (minTotalBookings !== null && input.customerSnapshot.totalBookings < minTotalBookings) return false;

  const minTotalAttendances = parseNumber(data.minTotalAttendances);
  if (minTotalAttendances !== null && input.customerSnapshot.totalAttendances < minTotalAttendances) return false;

  const minTotalTournaments = parseNumber(data.minTotalTournaments);
  if (minTotalTournaments !== null && input.customerSnapshot.totalTournaments < minTotalTournaments) return false;

  const requiredTags = normalizeStringArray(data.requiredTags);
  if (requiredTags.length) {
    const tagSet = new Set(input.customerSnapshot.tags);
    const hasAny = requiredTags.some((tag) => tagSet.has(tag));
    if (!hasAny) return false;
  }

  return true;
}

async function getEarnedPoints(params: {
  client: PrismaClientLike;
  programId: string;
  userId: string;
  ruleId: string;
  since?: Date;
}) {
  const result = await params.client.loyaltyLedger.aggregate({
    where: {
      programId: params.programId,
      userId: params.userId,
      ruleId: params.ruleId,
      entryType: LoyaltyEntryType.EARN,
      ...(params.since ? { createdAt: { gte: params.since } } : {}),
    },
    _sum: { points: true },
  });

  return Number(result._sum.points ?? 0);
}

export async function applyLoyaltyForInteraction(
  input: ApplyInput,
  options?: { tx?: Prisma.TransactionClient },
): Promise<{ entries: number }> {
  const trigger = INTERACTION_TO_TRIGGER[input.interactionType];
  const sourceType = INTERACTION_TO_SOURCE[input.interactionType];
  if (!trigger || !sourceType) return { entries: 0 };

  const client: PrismaClientLike = options?.tx ?? prisma;

  const program = await client.loyaltyProgram.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (!program || program.status !== LoyaltyProgramStatus.ACTIVE) return { entries: 0 };

  const rules = await client.loyaltyRule.findMany({
    where: { programId: program.id, trigger, isActive: true },
  });
  if (!rules.length) return { entries: 0 };

  const createdAt = input.occurredAt ?? new Date();
  const expiryDays =
    typeof program.pointsExpiryDays === "number" && program.pointsExpiryDays > 0
      ? Math.floor(program.pointsExpiryDays)
      : null;
  const expiresAt = expiryDays ? new Date(createdAt.getTime() + expiryDays * 24 * 60 * 60 * 1000) : null;
  let entries = 0;

  for (const rule of rules) {
    if (!rule.points || rule.points <= 0) continue;
    if (!matchesConditions(rule.conditions as Prisma.JsonValue, input)) continue;

    let pointsToGrant = rule.points;

    if (rule.maxPointsPerUser) {
      const earned = await getEarnedPoints({
        client,
        programId: program.id,
        userId: input.userId,
        ruleId: rule.id,
      });
      const remaining = rule.maxPointsPerUser - earned;
      if (remaining <= 0) continue;
      pointsToGrant = Math.min(pointsToGrant, remaining);
    }

    if (rule.maxPointsPerDay) {
      const start = startOfDayUtc(createdAt);
      const earnedToday = await getEarnedPoints({
        client,
        programId: program.id,
        userId: input.userId,
        ruleId: rule.id,
        since: start,
      });
      const remainingToday = rule.maxPointsPerDay - earnedToday;
      if (remainingToday <= 0) continue;
      pointsToGrant = Math.min(pointsToGrant, remainingToday);
    }

    if (pointsToGrant <= 0) continue;

    const dedupeKey = `rule:${rule.id}:${sourceType}:${input.sourceId ?? input.interactionType}`;

    try {
        await client.loyaltyLedger.create({
          data: {
            organizationId: input.organizationId,
            programId: program.id,
            userId: input.userId,
            ruleId: rule.id,
            entryType: LoyaltyEntryType.EARN,
            points: pointsToGrant,
            sourceType,
            sourceId: input.sourceId ?? undefined,
            dedupeKey,
            note: rule.name,
            createdAt,
            expiresAt: expiresAt ?? undefined,
          },
        });
      entries += 1;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        continue;
      }
      throw err;
    }
  }

  return { entries };
}
