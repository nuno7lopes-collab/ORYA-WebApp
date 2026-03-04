import { getDateParts, makeUtcDateFromLocal } from "@/lib/reservas/availability";
import { getAvailableSlotsForScope } from "@/lib/reservas/availabilitySelect";
import { groupByScope, type AvailabilityScopeType, type ScopedOverride, type ScopedSchedule, type ScopedTemplate } from "@/lib/reservas/scopedAvailability";

type AvailabilityScheduleRow = {
  id: number;
  scopeType: AvailabilityScopeType;
  scopeId: number;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
};

type AvailabilityOverrideRow = {
  scopeType: AvailabilityScopeType;
  scopeId: number;
  date: Date;
  kind: string;
  intervals: unknown;
};

type AvailabilityTemplateRow = {
  availabilityId: number;
  dayOfWeek: number;
  intervals: unknown;
};

type AvailabilityValidationTx = {
  availabilitySchedule: {
    findMany: (args: any) => Promise<AvailabilityScheduleRow[]>;
  };
  availabilityOverride: {
    findMany: (args: any) => Promise<AvailabilityOverrideRow[]>;
  };
  weeklyAvailabilityTemplate: {
    findMany: (args: any) => Promise<AvailabilityTemplateRow[]>;
  };
};

type AvailabilityScopeTarget = {
  scopeType: AvailabilityScopeType;
  scopeId: number;
};

export type ClassSeriesSessionCandidate = {
  startsAt: Date;
  endsAt: Date;
};

export type ClassSeriesSlotUnavailable = {
  date: string;
  start: string;
  end: string;
  reason: string;
  scopeType: AvailabilityScopeType;
  scopeId: number;
};

type ValidateClassSessionsAgainstAvailabilityParams = {
  tx: AvailabilityValidationTx;
  organizationId: number;
  timezone: string;
  sessions: ClassSeriesSessionCandidate[];
  professionalId?: number | null;
  resourceScopeId?: number | null;
  stepMinutes?: number;
};

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function formatLocalDateKey(value: Date, timezone: string) {
  const parts = getDateParts(value, timezone);
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function formatLocalTime(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(value);
}

function getDayWindow(value: Date, timezone: string) {
  const parts = getDateParts(value, timezone);
  const rangeStart = makeUtcDateFromLocal(
    { year: parts.year, month: parts.month, day: parts.day, hour: 0, minute: 0 },
    timezone,
  );
  const rangeEnd = makeUtcDateFromLocal(
    { year: parts.year, month: parts.month, day: parts.day, hour: 23, minute: 59 },
    timezone,
  );
  return { rangeStart, rangeEnd };
}

function resolveTargets(params: { professionalId?: number | null; resourceScopeId?: number | null }): AvailabilityScopeTarget[] {
  const targets: AvailabilityScopeTarget[] = [];
  if (Number.isFinite(params.professionalId) && (params.professionalId ?? 0) > 0) {
    targets.push({ scopeType: "PROFESSIONAL", scopeId: Math.trunc(params.professionalId as number) });
  }
  if (Number.isFinite(params.resourceScopeId) && (params.resourceScopeId ?? 0) > 0) {
    targets.push({ scopeType: "RESOURCE", scopeId: Math.trunc(params.resourceScopeId as number) });
  }
  if (targets.length === 0) {
    targets.push({ scopeType: "ORGANIZATION", scopeId: 0 });
  }
  return targets;
}

function resolveSlotsContainInstant(slots: Array<{ startsAt: Date }>, startsAt: Date) {
  const minuteKey = Math.floor(startsAt.getTime() / 60_000);
  return slots.some((slot) => Math.floor(slot.startsAt.getTime() / 60_000) === minuteKey);
}

export async function validateClassSessionsAgainstAvailability(
  params: ValidateClassSessionsAgainstAvailabilityParams,
): Promise<{ ok: true } | { ok: false; conflict: ClassSeriesSlotUnavailable }> {
  if (!params.sessions.length) return { ok: true };

  const targets = resolveTargets({
    professionalId: params.professionalId,
    resourceScopeId: params.resourceScopeId,
  });
  const uniqueScopeKeys = new Set<string>(["ORGANIZATION:0"]);
  targets.forEach((scope) => uniqueScopeKeys.add(`${scope.scopeType}:${scope.scopeId}`));
  const scopeFilters = [...uniqueScopeKeys].map((key) => {
    const [scopeType, scopeIdRaw] = key.split(":");
    return { scopeType: scopeType as AvailabilityScopeType, scopeId: Number(scopeIdRaw) };
  });

  const sortedSessions = [...params.sessions].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const minDateParts = getDateParts(sortedSessions[0].startsAt, params.timezone);
  const maxDateParts = getDateParts(sortedSessions[sortedSessions.length - 1].startsAt, params.timezone);
  const minDate = new Date(Date.UTC(minDateParts.year, minDateParts.month - 1, minDateParts.day));
  const maxDate = new Date(Date.UTC(maxDateParts.year, maxDateParts.month - 1, maxDateParts.day));

  const [schedules, overrides] = await Promise.all([
    params.tx.availabilitySchedule.findMany({
      where: {
        organizationId: params.organizationId,
        OR: scopeFilters,
      },
      select: { id: true, scopeType: true, scopeId: true, startDate: true, endDate: true, createdAt: true },
    }),
    params.tx.availabilityOverride.findMany({
      where: {
        organizationId: params.organizationId,
        OR: scopeFilters,
        date: { gte: minDate, lte: maxDate },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { scopeType: true, scopeId: true, date: true, kind: true, intervals: true },
    }),
  ]);

  const scheduleIds = schedules.map((schedule) => schedule.id);
  const templates = scheduleIds.length
    ? await params.tx.weeklyAvailabilityTemplate.findMany({
        where: { availabilityId: { in: scheduleIds } },
        select: { availabilityId: true, dayOfWeek: true, intervals: true },
      })
    : [];

  const orgSchedules = schedules.filter((schedule) => schedule.scopeType === "ORGANIZATION" && schedule.scopeId === 0);
  const orgOverrides = overrides.filter((override) => override.scopeType === "ORGANIZATION" && override.scopeId === 0);
  const schedulesByScope = groupByScope(schedules as ScopedSchedule[]);
  const overridesByScope = groupByScope(overrides as ScopedOverride[]);

  for (const session of sortedSessions) {
    const durationMinutes = Math.max(
      1,
      Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60_000),
    );
    const { rangeStart, rangeEnd } = getDayWindow(session.startsAt, params.timezone);

    for (const target of targets) {
      const slots = getAvailableSlotsForScope({
        rangeStart,
        rangeEnd,
        timezone: params.timezone,
        durationMinutes,
        stepMinutes: params.stepMinutes,
        now: new Date(session.startsAt.getTime() - 1_000),
        scopeType: target.scopeType,
        scopeId: target.scopeId,
        orgSchedules: orgSchedules as ScopedSchedule[],
        templates: templates as ScopedTemplate[],
        orgOverrides: orgOverrides as ScopedOverride[],
        schedulesByScope,
        overridesByScope,
        blocks: [],
      });

      if (resolveSlotsContainInstant(slots, session.startsAt)) continue;

      return {
        ok: false,
        conflict: {
          date: formatLocalDateKey(session.startsAt, params.timezone),
          start: formatLocalTime(session.startsAt, params.timezone),
          end: formatLocalTime(session.endsAt, params.timezone),
          reason: target.scopeType === "ORGANIZATION" ? "outside_general_availability" : "outside_scope_availability",
          scopeType: target.scopeType,
          scopeId: target.scopeId,
        },
      };
    }
  }

  return { ok: true };
}
