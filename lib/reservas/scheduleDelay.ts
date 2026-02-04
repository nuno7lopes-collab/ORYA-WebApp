import type { Prisma } from "@prisma/client";
import { AvailabilityScopeType } from "@prisma/client";

export type ScheduleDelayRow = {
  scopeType: AvailabilityScopeType;
  scopeId: number;
  delayMinutes: number;
  reason: string | null;
  effectiveFrom: Date;
  createdAt: Date;
};

const buildKey = (scopeType: AvailabilityScopeType, scopeId: number) => `${scopeType}:${scopeId}`;

export function buildScheduleDelayMap(rows: ScheduleDelayRow[]): Map<string, ScheduleDelayRow> {
  const map = new Map<string, ScheduleDelayRow>();
  rows.forEach((row) => {
    const key = buildKey(row.scopeType, row.scopeId);
    if (!map.has(key)) {
      map.set(key, row);
    }
  });
  return map;
}

export async function loadScheduleDelays(params: {
  tx: Prisma.TransactionClient;
  organizationId: number;
  professionalIds: number[];
  resourceIds: number[];
}): Promise<Map<string, ScheduleDelayRow>> {
  const { tx, organizationId, professionalIds, resourceIds } = params;
  const scopeIds = new Set<number>([0, ...professionalIds, ...resourceIds]);
  const delays = await tx.scheduleDelay.findMany({
    where: {
      organizationId,
      scopeType: { in: [AvailabilityScopeType.ORGANIZATION, AvailabilityScopeType.PROFESSIONAL, AvailabilityScopeType.RESOURCE] },
      scopeId: { in: Array.from(scopeIds) },
    },
    orderBy: [{ scopeType: "asc" }, { scopeId: "asc" }, { effectiveFrom: "desc" }, { createdAt: "desc" }],
    select: {
      scopeType: true,
      scopeId: true,
      delayMinutes: true,
      reason: true,
      effectiveFrom: true,
      createdAt: true,
    },
  });

  return buildScheduleDelayMap(delays);
}

function delayApplies(delay: ScheduleDelayRow | null, startsAt: Date) {
  if (!delay) return false;
  if (delay.delayMinutes <= 0) return false;
  return delay.effectiveFrom.getTime() <= startsAt.getTime();
}

export function resolveBookingDelay(params: {
  startsAt: Date;
  assignmentMode?: string | null;
  professionalId?: number | null;
  resourceId?: number | null;
  delayMap: Map<string, ScheduleDelayRow>;
}): { delayMinutes: number; estimatedStartsAt: Date | null; reason: string | null } {
  const { startsAt, assignmentMode, professionalId, resourceId, delayMap } = params;
  const normalizedMode = typeof assignmentMode === "string" ? assignmentMode.toUpperCase() : "";
  const isResource = normalizedMode === "RESOURCE" || resourceId != null;
  const scopeType = isResource ? AvailabilityScopeType.RESOURCE : AvailabilityScopeType.PROFESSIONAL;
  const scopeId = isResource ? resourceId : professionalId;

  const orgDelay = delayMap.get(buildKey(AvailabilityScopeType.ORGANIZATION, 0)) ?? null;
  const scopedDelay = scopeId ? delayMap.get(buildKey(scopeType, scopeId)) ?? null : null;

  const orgDelayMinutes = delayApplies(orgDelay, startsAt) ? orgDelay?.delayMinutes ?? 0 : 0;
  const scopedDelayMinutes = delayApplies(scopedDelay, startsAt) ? scopedDelay?.delayMinutes ?? 0 : 0;
  const delayMinutes = Math.max(0, orgDelayMinutes + scopedDelayMinutes);

  if (delayMinutes <= 0) {
    return { delayMinutes: 0, estimatedStartsAt: null, reason: null };
  }

  const estimatedStartsAt = new Date(startsAt.getTime() + delayMinutes * 60 * 1000);
  const reason = scopedDelay?.reason ?? orgDelay?.reason ?? null;
  return { delayMinutes, estimatedStartsAt, reason };
}
