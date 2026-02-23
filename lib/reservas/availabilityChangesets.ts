import {
  AvailabilityConflictEntityType,
  AvailabilityConflictResolutionAction,
  AvailabilityConflictStatus,
  AvailabilityOverrideKind,
  AvailabilityScopeType,
  BookingStatus,
  ClassSessionStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { getDateParts, normalizeIntervals, resolveIntervalsForDate, resolveScheduleForDate } from "@/lib/reservas/availability";

type Tx = Prisma.TransactionClient;

type Interval = { startMinute: number; endMinute: number };

type DraftTemplateInput = {
  dayOfWeek: number;
  intervals?: unknown;
};

type DraftOverrideInput = {
  date: string;
  kind: "CLOSED" | "OPEN" | "BLOCK";
  intervals?: unknown;
};

export type AvailabilityDraftInput = {
  scheduleId?: number | null;
  startDate: string;
  endDate?: string | null;
  templates: Record<string, unknown> | DraftTemplateInput[];
  overrides?: DraftOverrideInput[];
};

type NormalizedDraft = {
  scheduleId: number | null;
  draftScheduleId: number;
  startDate: Date;
  startKey: string;
  endDate: Date | null;
  endKey: string | null;
  templatesByDay: Map<number, Interval[]>;
  overridesByDate: Map<string, { kind: "CLOSED" | "OPEN" | "BLOCK"; intervals: Interval[] }>;
  payload: {
    scheduleId: number | null;
    startDate: string;
    endDate: string | null;
    templates: Array<{ dayOfWeek: number; intervals: Interval[] }>;
    overrides: Array<{ date: string; kind: "CLOSED" | "OPEN" | "BLOCK"; intervals: Interval[] }>;
  };
};

type ScopeInfo = {
  organizationId: number;
  scopeType: AvailabilityScopeType;
  scopeId: number;
  timezone: string;
};

type EntityForConflict = {
  entityType: AvailabilityConflictEntityType;
  entityId: number;
  startsAt: Date;
  endsAt: Date;
  professionalId: number | null;
  resourceId: number | null;
  courtId: number | null;
};

type ScheduleRow = {
  id: number;
  scopeType: AvailabilityScopeType;
  scopeId: number;
  startDate: Date;
  endDate: Date | null;
  createdAt: Date;
};

type TemplateRow = {
  availabilityId: number;
  dayOfWeek: number;
  intervals: unknown;
};

type OverrideRow = {
  scopeType: AvailabilityScopeType;
  scopeId: number;
  date: Date;
  kind: AvailabilityOverrideKind;
  intervals: unknown;
  createdAt: Date;
};

type ConflictCandidate = {
  entityType: AvailabilityConflictEntityType;
  entityId: number;
  startsAt: Date;
  endsAt: Date;
  details: Prisma.JsonObject;
  reasonCode: string;
};

type BookingConflictRow = {
  id: number;
  status: BookingStatus;
  startsAt: Date;
  durationMinutes: number;
  professionalId: number | null;
  resourceId: number | null;
  courtId: number | null;
};

type SessionConflictRow = {
  id: number;
  status: ClassSessionStatus;
  startsAt: Date;
  endsAt: Date;
  professionalId: number | null;
  courtId: number | null;
};

type LoadedAvailabilityState = {
  schedulesByScope: Map<string, ScheduleRow[]>;
  templatesBySchedule: Map<number, Map<number, Interval[]>>;
  overridesByScopeDate: Map<string, Map<string, Array<{ kind: string; intervals: Interval[] }>>>;
  resourceByCourtId: Map<number, number>;
};

const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
  BookingStatus.DISPUTED,
  BookingStatus.NO_SHOW,
];

const CANCELLED_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.CANCELLED,
  BookingStatus.CANCELLED_BY_CLIENT,
  BookingStatus.CANCELLED_BY_ORG,
];

const WEEKDAY_MAP: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function buildScopeKey(scopeType: AvailabilityScopeType, scopeId: number) {
  return `${scopeType}:${scopeId}`;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function getDateKeyFromUtcDate(date: Date) {
  return toDateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function parseDateInput(raw: unknown) {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;
  return { date, key: toDateKey(year, month, day) };
}

function assertNoOverlap(intervals: Interval[]) {
  const sorted = [...intervals].sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].startMinute < sorted[i - 1].endMinute) {
      throw new Error("SCHEDULE_OVERLAP");
    }
  }
}

function normalizeTemplatePayload(raw: Record<string, unknown> | DraftTemplateInput[]) {
  const byDay = new Map<number, Interval[]>();
  for (let day = 0; day <= 6; day += 1) {
    byDay.set(day, []);
  }

  if (Array.isArray(raw)) {
    raw.forEach((item) => {
      const day = Number(item?.dayOfWeek);
      if (!Number.isFinite(day) || day < 0 || day > 6) {
        throw new Error("INVALID_TEMPLATE_DAY");
      }
      const normalized = normalizeIntervals(item?.intervals ?? []);
      assertNoOverlap(normalized);
      byDay.set(day, normalized);
    });
    return byDay;
  }

  Object.entries(raw ?? {}).forEach(([dayKey, intervalsRaw]) => {
    const day = Number(dayKey);
    if (!Number.isFinite(day) || day < 0 || day > 6) return;
    const listRaw = Array.isArray(intervalsRaw)
      ? intervalsRaw.map((item: any) => ({ startMinute: Number(item?.startMinute), endMinute: Number(item?.endMinute) }))
      : [];
    const normalized = normalizeIntervals(listRaw);
    assertNoOverlap(normalized);
    byDay.set(day, normalized);
  });

  return byDay;
}

function normalizeOverridePayload(raw: DraftOverrideInput[] | undefined) {
  const byDate = new Map<string, { kind: "CLOSED" | "OPEN" | "BLOCK"; intervals: Interval[] }>();
  if (!Array.isArray(raw)) return byDate;
  for (const item of raw) {
    const parsedDate = parseDateInput(item?.date);
    if (!parsedDate) {
      throw new Error("INVALID_OVERRIDE_DATE");
    }
    const kind = String(item?.kind || "").toUpperCase();
    if (kind !== "CLOSED" && kind !== "OPEN" && kind !== "BLOCK") {
      throw new Error("INVALID_OVERRIDE_KIND");
    }
    const intervals = kind === "CLOSED" ? [] : normalizeIntervals(item?.intervals ?? []);
    assertNoOverlap(intervals);
    byDate.set(parsedDate.key, { kind, intervals });
  }
  return byDate;
}

function normalizeDraftInput(input: AvailabilityDraftInput): NormalizedDraft {
  const startParsed = parseDateInput(input.startDate);
  if (!startParsed) throw new Error("INVALID_START_DATE");

  const endParsed = input.endDate ? parseDateInput(input.endDate) : null;
  if (input.endDate && !endParsed) throw new Error("INVALID_END_DATE");
  if (endParsed && endParsed.key < startParsed.key) throw new Error("END_BEFORE_START");

  const scheduleIdRaw = Number(input.scheduleId);
  const scheduleId = Number.isFinite(scheduleIdRaw) && scheduleIdRaw > 0 ? scheduleIdRaw : null;
  const draftScheduleId = scheduleId ?? -1;
  const templatesByDay = normalizeTemplatePayload(input.templates);
  const overridesByDate = normalizeOverridePayload(input.overrides);

  return {
    scheduleId,
    draftScheduleId,
    startDate: startParsed.date,
    startKey: startParsed.key,
    endDate: endParsed?.date ?? null,
    endKey: endParsed?.key ?? null,
    templatesByDay,
    overridesByDate,
    payload: {
      scheduleId,
      startDate: startParsed.key,
      endDate: endParsed?.key ?? null,
      templates: Array.from(templatesByDay.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([dayOfWeek, intervals]) => ({ dayOfWeek, intervals })),
      overrides: Array.from(overridesByDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, override]) => ({ date, kind: override.kind, intervals: override.intervals })),
    },
  };
}

function scheduleOverlaps(aStart: Date, aEnd: Date | null, bStart: Date, bEnd: Date | null) {
  const aEndMs = aEnd ? aEnd.getTime() : Number.POSITIVE_INFINITY;
  const bEndMs = bEnd ? bEnd.getTime() : Number.POSITIVE_INFINITY;
  return aStart.getTime() <= bEndMs && bStart.getTime() <= aEndMs;
}

async function assertNoScheduleOverlap(
  tx: Tx,
  params: {
    organizationId: number;
    scopeType: AvailabilityScopeType;
    scopeId: number;
    startDate: Date;
    endDate: Date | null;
    ignoreScheduleId?: number | null;
  },
) {
  const existing = await tx.availabilitySchedule.findMany({
    where: {
      organizationId: params.organizationId,
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      ...(params.ignoreScheduleId ? { id: { not: params.ignoreScheduleId } } : {}),
    },
    select: { id: true, startDate: true, endDate: true },
  });

  const conflict = existing.find((schedule) =>
    scheduleOverlaps(params.startDate, params.endDate, schedule.startDate, schedule.endDate),
  );
  if (conflict) throw new Error("AVAILABILITY_SCHEDULE_OVERLAP");
}

async function loadAvailabilityState(tx: Tx, organizationId: number): Promise<LoadedAvailabilityState> {
  const [schedules, templates, overrides, resources] = await Promise.all([
    tx.availabilitySchedule.findMany({
      where: { organizationId },
      select: {
        id: true,
        scopeType: true,
        scopeId: true,
        startDate: true,
        endDate: true,
        createdAt: true,
      },
    }),
    tx.weeklyAvailabilityTemplate.findMany({
      where: { availability: { organizationId } },
      select: { availabilityId: true, dayOfWeek: true, intervals: true },
    }),
    tx.availabilityOverride.findMany({
      where: { organizationId },
      orderBy: [{ createdAt: "asc" }],
      select: {
        scopeType: true,
        scopeId: true,
        date: true,
        kind: true,
        intervals: true,
        createdAt: true,
      },
    }),
    tx.reservationResource.findMany({
      where: { organizationId, isActive: true, courtId: { not: null } },
      select: { id: true, courtId: true },
    }),
  ]);

  const schedulesByScope = new Map<string, ScheduleRow[]>();
  schedules.forEach((schedule) => {
    const key = buildScopeKey(schedule.scopeType, schedule.scopeId);
    const current = schedulesByScope.get(key) ?? [];
    current.push(schedule);
    schedulesByScope.set(key, current);
  });

  const templatesBySchedule = new Map<number, Map<number, Interval[]>>();
  templates.forEach((template) => {
    const byDay = templatesBySchedule.get(template.availabilityId) ?? new Map<number, Interval[]>();
    byDay.set(template.dayOfWeek, normalizeIntervals(template.intervals));
    templatesBySchedule.set(template.availabilityId, byDay);
  });

  const overridesByScopeDate = new Map<string, Map<string, Array<{ kind: string; intervals: Interval[] }>>>();
  overrides.forEach((override) => {
    const scopeKey = buildScopeKey(override.scopeType, override.scopeId);
    const dateKey = getDateKeyFromUtcDate(override.date);
    const byDate = overridesByScopeDate.get(scopeKey) ?? new Map<string, Array<{ kind: string; intervals: Interval[] }>>();
    const list = byDate.get(dateKey) ?? [];
    list.push({ kind: override.kind, intervals: normalizeIntervals(override.intervals) });
    byDate.set(dateKey, list);
    overridesByScopeDate.set(scopeKey, byDate);
  });

  const resourceByCourtId = new Map<number, number>();
  resources.forEach((resource) => {
    if (typeof resource.courtId === "number") {
      resourceByCourtId.set(resource.courtId, resource.id);
    }
  });

  return { schedulesByScope, templatesBySchedule, overridesByScopeDate, resourceByCourtId };
}

function getLocalDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const year = Number(map.get("year"));
  const month = Number(map.get("month"));
  const day = Number(map.get("day"));
  const hourRaw = Number(map.get("hour"));
  const minute = Number(map.get("minute"));
  const weekdayRaw = (map.get("weekday") ?? "").slice(0, 3).toLowerCase();
  const dayOfWeek = WEEKDAY_MAP[weekdayRaw];
  const hour = hourRaw === 24 ? 0 : hourRaw;

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(dayOfWeek)
  ) {
    throw new Error("INVALID_LOCAL_TIME");
  }

  return {
    year,
    month,
    day,
    dayOfWeek,
    minuteOfDay: hour * 60 + minute,
    dateKey: toDateKey(year, month, day),
  };
}

function buildResultingSchedules(
  state: LoadedAvailabilityState,
  draft: NormalizedDraft,
  scope: ScopeInfo,
) {
  const scopeKey = buildScopeKey(scope.scopeType, scope.scopeId);
  const current = [...(state.schedulesByScope.get(scopeKey) ?? [])];
  const filtered = draft.scheduleId ? current.filter((schedule) => schedule.id !== draft.scheduleId) : current;
  filtered.push({
    id: draft.draftScheduleId,
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
    startDate: draft.startDate,
    endDate: draft.endDate,
    createdAt: new Date(),
  });

  const merged = new Map(state.schedulesByScope);
  merged.set(scopeKey, filtered);
  return merged;
}

function resolveActiveSchedule(
  schedulesByScope: Map<string, ScheduleRow[]>,
  scopeType: AvailabilityScopeType,
  scopeId: number,
  date: Date,
  timezone: string,
) {
  return resolveScheduleForDate(schedulesByScope.get(buildScopeKey(scopeType, scopeId)) ?? [], date, timezone);
}

function resolveEffectiveScopeForEntity(
  entity: EntityForConflict,
  schedulesByScope: Map<string, ScheduleRow[]>,
  timezone: string,
  resourceByCourtId: Map<number, number>,
) {
  const candidateResourceId = entity.resourceId ?? (entity.courtId != null ? resourceByCourtId.get(entity.courtId) ?? null : null);

  if (entity.professionalId) {
    const active = resolveActiveSchedule(schedulesByScope, "PROFESSIONAL", entity.professionalId, entity.startsAt, timezone);
    if (active) {
      return { scopeType: "PROFESSIONAL" as AvailabilityScopeType, scopeId: entity.professionalId };
    }
  }

  if (candidateResourceId) {
    const active = resolveActiveSchedule(schedulesByScope, "RESOURCE", candidateResourceId, entity.startsAt, timezone);
    if (active) {
      return { scopeType: "RESOURCE" as AvailabilityScopeType, scopeId: candidateResourceId };
    }
  }

  return { scopeType: "ORGANIZATION" as AvailabilityScopeType, scopeId: 0 };
}

function getOverridesForDate(
  state: LoadedAvailabilityState,
  draft: NormalizedDraft,
  scope: ScopeInfo,
  effectiveScopeType: AvailabilityScopeType,
  effectiveScopeId: number,
  dateKey: string,
) {
  const orgKey = buildScopeKey("ORGANIZATION", 0);
  const orgFromDraft =
    scope.scopeType === "ORGANIZATION"
      ? (() => {
          const override = draft.overridesByDate.get(dateKey);
          return override ? [{ kind: override.kind, intervals: override.intervals }] : [];
        })()
      : state.overridesByScopeDate.get(orgKey)?.get(dateKey) ?? [];

  if (effectiveScopeType === "ORGANIZATION") {
    return orgFromDraft;
  }

  const scopeKey = buildScopeKey(effectiveScopeType, effectiveScopeId);
  const scopeOverrides =
    scope.scopeType === effectiveScopeType && scope.scopeId === effectiveScopeId
      ? (() => {
          const override = draft.overridesByDate.get(dateKey);
          return override ? [{ kind: override.kind, intervals: override.intervals }] : [];
        })()
      : state.overridesByScopeDate.get(scopeKey)?.get(dateKey) ?? [];

  return [...orgFromDraft, ...scopeOverrides];
}

function getTemplatesForActiveSchedule(
  state: LoadedAvailabilityState,
  draft: NormalizedDraft,
  scheduleId: number,
) {
  if (scheduleId === draft.draftScheduleId) return draft.templatesByDay;
  return state.templatesBySchedule.get(scheduleId) ?? new Map<number, Interval[]>();
}

function isEntityCoveredByResultingAvailability(params: {
  entity: EntityForConflict;
  scope: ScopeInfo;
  draft: NormalizedDraft;
  state: LoadedAvailabilityState;
  schedulesByScope: Map<string, ScheduleRow[]>;
}) {
  const { entity, scope, draft, state, schedulesByScope } = params;
  const localStart = getLocalDateTimeParts(entity.startsAt, scope.timezone);
  const localEnd = getLocalDateTimeParts(entity.endsAt, scope.timezone);

  if (localStart.dateKey !== localEnd.dateKey) {
    return false;
  }

  const effectiveScope = resolveEffectiveScopeForEntity(
    entity,
    schedulesByScope,
    scope.timezone,
    state.resourceByCourtId,
  );

  const activeSchedule = resolveActiveSchedule(
    schedulesByScope,
    effectiveScope.scopeType,
    effectiveScope.scopeId,
    entity.startsAt,
    scope.timezone,
  );

  if (!activeSchedule) {
    return false;
  }

  const templatesByDay = getTemplatesForActiveSchedule(state, draft, activeSchedule.id);
  const overrides = getOverridesForDate(
    state,
    draft,
    scope,
    effectiveScope.scopeType,
    effectiveScope.scopeId,
    localStart.dateKey,
  );

  const intervals = resolveIntervalsForDate({
    dayOfWeek: localStart.dayOfWeek,
    templatesByDay,
    overrides,
    fallbackToDefault: false,
  });

  return intervals.some(
    (interval) =>
      localStart.minuteOfDay >= interval.startMinute &&
      localEnd.minuteOfDay <= interval.endMinute,
  );
}

async function fetchEntitiesForConflict(
  tx: Tx,
  scope: ScopeInfo,
  state: LoadedAvailabilityState,
) {
  const now = new Date();
  let bookingWhere: Prisma.BookingWhereInput = {
    organizationId: scope.organizationId,
    status: { in: ACTIVE_BOOKING_STATUSES },
    startsAt: { gte: now },
  };

  let sessionWhere: Prisma.ClassSessionWhereInput = {
    organizationId: scope.organizationId,
    status: ClassSessionStatus.SCHEDULED,
    startsAt: { gte: now },
  };

  if (scope.scopeType === "PROFESSIONAL") {
    bookingWhere = { ...bookingWhere, professionalId: scope.scopeId };
    sessionWhere = { ...sessionWhere, professionalId: scope.scopeId };
  } else if (scope.scopeType === "RESOURCE") {
    const resource = await tx.reservationResource.findFirst({
      where: { id: scope.scopeId, organizationId: scope.organizationId },
      select: { courtId: true },
    });

    bookingWhere = {
      ...bookingWhere,
      OR: [{ resourceId: scope.scopeId }, ...(resource?.courtId ? [{ courtId: resource.courtId }] : [])],
    };

    if (resource?.courtId) {
      sessionWhere = { ...sessionWhere, courtId: resource.courtId };
    } else {
      sessionWhere = { ...sessionWhere, id: -1 };
    }
  }

  const [bookings, sessions] = await Promise.all([
    tx.booking.findMany({
      where: bookingWhere,
      select: {
        id: true,
        startsAt: true,
        durationMinutes: true,
        professionalId: true,
        resourceId: true,
        courtId: true,
      },
    }),
    tx.classSession.findMany({
      where: sessionWhere,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        professionalId: true,
        courtId: true,
      },
    }),
  ]);

  const bookingEntities: EntityForConflict[] = bookings.map((booking) => ({
    entityType: AvailabilityConflictEntityType.BOOKING,
    entityId: booking.id,
    startsAt: booking.startsAt,
    endsAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
    professionalId: booking.professionalId,
    resourceId: booking.resourceId,
    courtId: booking.courtId,
  }));

  const sessionEntities: EntityForConflict[] = sessions.map((session) => ({
    entityType: AvailabilityConflictEntityType.CLASS_SESSION,
    entityId: session.id,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    professionalId: session.professionalId,
    resourceId: session.courtId != null ? state.resourceByCourtId.get(session.courtId) ?? null : null,
    courtId: session.courtId,
  }));

  return [...bookingEntities, ...sessionEntities];
}

export async function buildAvailabilityConflicts(
  tx: Tx,
  params: {
    scope: ScopeInfo;
    draft: NormalizedDraft;
  },
) {
  const state = await loadAvailabilityState(tx, params.scope.organizationId);
  const schedulesByScope = buildResultingSchedules(state, params.draft, params.scope);
  const entities = await fetchEntitiesForConflict(tx, params.scope, state);

  const conflicts: ConflictCandidate[] = [];
  for (const entity of entities) {
    const covered = isEntityCoveredByResultingAvailability({
      entity,
      scope: params.scope,
      draft: params.draft,
      state,
      schedulesByScope,
    });

    if (!covered) {
      conflicts.push({
        entityType: entity.entityType,
        entityId: entity.entityId,
        startsAt: entity.startsAt,
        endsAt: entity.endsAt,
        reasonCode: "OUTSIDE_AVAILABILITY",
        details: {
          professionalId: entity.professionalId,
          resourceId: entity.resourceId,
          courtId: entity.courtId,
        },
      });
    }
  }

  return conflicts;
}

export function parseChangesetDraftPayload(payload: unknown): NormalizedDraft {
  if (!payload || typeof payload !== "object") {
    throw new Error("INVALID_DRAFT_PAYLOAD");
  }

  const source = payload as Record<string, unknown>;
  return normalizeDraftInput({
    scheduleId: source.scheduleId as number | null | undefined,
    startDate: String(source.startDate ?? ""),
    endDate: source.endDate == null ? null : String(source.endDate),
    templates: (source.templates as Record<string, unknown> | DraftTemplateInput[]) ?? {},
    overrides: Array.isArray(source.overrides) ? (source.overrides as DraftOverrideInput[]) : [],
  });
}

export async function createAvailabilityChangeset(params: {
  tx: Tx;
  scope: ScopeInfo;
  draftInput: AvailabilityDraftInput;
  requestedByUserId: string;
}) {
  const draft = normalizeDraftInput(params.draftInput);

  const existingPending = await params.tx.availabilityChangeSet.findFirst({
    where: {
      organizationId: params.scope.organizationId,
      scopeType: params.scope.scopeType,
      scopeId: params.scope.scopeId,
      status: { in: ["PENDING", "READY_TO_APPLY"] },
    },
    select: { id: true },
  });

  if (existingPending) {
    throw new Error("AVAILABILITY_CHANGESET_PENDING");
  }

  const conflicts = await buildAvailabilityConflicts(params.tx, {
    scope: params.scope,
    draft,
  });

  const status = conflicts.length > 0 ? "PENDING" : "READY_TO_APPLY";

  const changeSet = await params.tx.availabilityChangeSet.create({
    data: {
      organizationId: params.scope.organizationId,
      scopeType: params.scope.scopeType,
      scopeId: params.scope.scopeId,
      scheduleId: draft.scheduleId,
      status,
      requestedByUserId: params.requestedByUserId,
      draftPayload: draft.payload as Prisma.InputJsonValue,
      preflightSummary: {
        conflictsTotal: conflicts.length,
      } as Prisma.InputJsonValue,
      conflicts: conflicts.length
        ? {
            createMany: {
              data: conflicts.map((conflict) => ({
                organizationId: params.scope.organizationId,
                status: AvailabilityConflictStatus.OPEN,
                entityType: conflict.entityType,
                entityId: conflict.entityId,
                scopeType: params.scope.scopeType,
                scopeId: params.scope.scopeId,
                startsAt: conflict.startsAt,
                endsAt: conflict.endsAt,
                reasonCode: conflict.reasonCode,
                details: conflict.details,
              })),
            },
          }
        : undefined,
    },
    select: {
      id: true,
      status: true,
      scheduleId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { conflicts: { where: { status: AvailabilityConflictStatus.OPEN } } } },
    },
  });

  return {
    changeSetId: changeSet.id,
    status: changeSet.status,
    conflictsOpen: changeSet._count.conflicts,
  };
}

export async function refreshChangesetConflicts(
  tx: Tx,
  params: { changeSetId: number; organizationId: number; timezone: string },
) {
  const changeSet = await tx.availabilityChangeSet.findFirst({
    where: { id: params.changeSetId, organizationId: params.organizationId },
    select: {
      id: true,
      organizationId: true,
      scopeType: true,
      scopeId: true,
      draftPayload: true,
      status: true,
      conflicts: {
        where: { status: AvailabilityConflictStatus.OPEN },
        select: {
          id: true,
          entityType: true,
          entityId: true,
          startsAt: true,
          endsAt: true,
          details: true,
        },
      },
    },
  });

  if (!changeSet) return;

  const draft = parseChangesetDraftPayload(changeSet.draftPayload);
  const scope: ScopeInfo = {
    organizationId: changeSet.organizationId,
    scopeType: changeSet.scopeType,
    scopeId: changeSet.scopeId,
    timezone: params.timezone,
  };

  const state = await loadAvailabilityState(tx, params.organizationId);
  const schedulesByScope = buildResultingSchedules(state, draft, scope);

  const bookingConflictIds = changeSet.conflicts
    .filter((conflict) => conflict.entityType === AvailabilityConflictEntityType.BOOKING)
    .map((conflict) => conflict.entityId);
  const sessionConflictIds = changeSet.conflicts
    .filter((conflict) => conflict.entityType === AvailabilityConflictEntityType.CLASS_SESSION)
    .map((conflict) => conflict.entityId);

  const bookingsPromise: Promise<BookingConflictRow[]> = bookingConflictIds.length
    ? tx.booking.findMany({
        where: { id: { in: bookingConflictIds }, organizationId: params.organizationId },
        select: {
          id: true,
          status: true,
          startsAt: true,
          durationMinutes: true,
          professionalId: true,
          resourceId: true,
          courtId: true,
        },
      })
    : Promise.resolve<BookingConflictRow[]>([]);
  const sessionsPromise: Promise<SessionConflictRow[]> = sessionConflictIds.length
    ? tx.classSession.findMany({
        where: { id: { in: sessionConflictIds }, organizationId: params.organizationId },
        select: {
          id: true,
          status: true,
          startsAt: true,
          endsAt: true,
          professionalId: true,
          courtId: true,
        },
      })
    : Promise.resolve<SessionConflictRow[]>([]);

  const [bookings, sessions] = await Promise.all([
    bookingsPromise,
    sessionsPromise,
  ]);

  const bookingById = new Map(bookings.map((booking) => [booking.id, booking]));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));

  for (const conflict of changeSet.conflicts) {
    if (conflict.entityType === AvailabilityConflictEntityType.BOOKING) {
      const booking = bookingById.get(conflict.entityId);
      if (!booking || CANCELLED_BOOKING_STATUSES.includes(booking.status) || booking.status === BookingStatus.COMPLETED) {
        await tx.availabilityChangeConflict.update({
          where: { id: conflict.id },
          data: {
            status: AvailabilityConflictStatus.RESOLVED,
            resolutionAction: AvailabilityConflictResolutionAction.CANCELLED,
            resolvedAt: new Date(),
          },
        });
        continue;
      }

      const entity: EntityForConflict = {
        entityType: AvailabilityConflictEntityType.BOOKING,
        entityId: booking.id,
        startsAt: booking.startsAt,
        endsAt: new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000),
        professionalId: booking.professionalId,
        resourceId: booking.resourceId,
        courtId: booking.courtId,
      };

      const covered = isEntityCoveredByResultingAvailability({
        entity,
        scope,
        draft,
        state,
        schedulesByScope,
      });

      if (covered) {
        await tx.availabilityChangeConflict.update({
          where: { id: conflict.id },
          data: {
            status: AvailabilityConflictStatus.RESOLVED,
            resolutionAction: AvailabilityConflictResolutionAction.RESCHEDULED,
            resolvedAt: new Date(),
          },
        });
      }
      continue;
    }

    const session = sessionById.get(conflict.entityId);
    if (!session || session.status !== ClassSessionStatus.SCHEDULED) {
      await tx.availabilityChangeConflict.update({
        where: { id: conflict.id },
        data: {
          status: AvailabilityConflictStatus.RESOLVED,
          resolutionAction: AvailabilityConflictResolutionAction.CANCELLED,
          resolvedAt: new Date(),
        },
      });
      continue;
    }

    const entity: EntityForConflict = {
      entityType: AvailabilityConflictEntityType.CLASS_SESSION,
      entityId: session.id,
      startsAt: session.startsAt,
      endsAt: session.endsAt,
      professionalId: session.professionalId,
      resourceId: session.courtId != null ? state.resourceByCourtId.get(session.courtId) ?? null : null,
      courtId: session.courtId,
    };

    const covered = isEntityCoveredByResultingAvailability({
      entity,
      scope,
      draft,
      state,
      schedulesByScope,
    });

    if (covered) {
      await tx.availabilityChangeConflict.update({
        where: { id: conflict.id },
        data: {
          status: AvailabilityConflictStatus.RESOLVED,
          resolutionAction: AvailabilityConflictResolutionAction.RESCHEDULED,
          resolvedAt: new Date(),
        },
      });
    }
  }

  const openCount = await tx.availabilityChangeConflict.count({
    where: { changeSetId: changeSet.id, status: AvailabilityConflictStatus.OPEN },
  });
  if (changeSet.status !== "APPLIED" && changeSet.status !== "CANCELLED") {
    await tx.availabilityChangeSet.update({
      where: { id: changeSet.id },
      data: {
        status: openCount > 0 ? "PENDING" : "READY_TO_APPLY",
        preflightSummary: {
          conflictsTotal: openCount,
          refreshedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }
}

export async function applyAvailabilityChangeset(params: {
  tx: Tx;
  changeSetId: number;
  organizationId: number;
}) {
  const changeSet = await params.tx.availabilityChangeSet.findFirst({
    where: { id: params.changeSetId, organizationId: params.organizationId },
    select: {
      id: true,
      organizationId: true,
      scopeType: true,
      scopeId: true,
      scheduleId: true,
      status: true,
      draftPayload: true,
    },
  });

  if (!changeSet) throw new Error("NOT_FOUND");
  if (changeSet.status === "CANCELLED") throw new Error("AVAILABILITY_CHANGESET_CANCELLED");
  if (changeSet.status === "APPLIED") {
    return { applied: true, alreadyApplied: true };
  }

  const org = await params.tx.organization.findUnique({
    where: { id: changeSet.organizationId },
    select: { timezone: true },
  });
  const timezone = org?.timezone || "Europe/Lisbon";
  await refreshChangesetConflicts(params.tx, {
    changeSetId: changeSet.id,
    organizationId: changeSet.organizationId,
    timezone,
  });

  const remainingOpen = await params.tx.availabilityChangeConflict.count({
    where: { changeSetId: changeSet.id, status: AvailabilityConflictStatus.OPEN },
  });

  if (remainingOpen > 0) {
    throw new Error("AVAILABILITY_CHANGESET_NOT_READY");
  }

  const draft = parseChangesetDraftPayload(changeSet.draftPayload);

  await assertNoScheduleOverlap(params.tx, {
    organizationId: changeSet.organizationId,
    scopeType: changeSet.scopeType,
    scopeId: changeSet.scopeId,
    startDate: draft.startDate,
    endDate: draft.endDate,
    ignoreScheduleId: draft.scheduleId,
  });

  const schedule = draft.scheduleId
    ? await params.tx.availabilitySchedule.update({
        where: { id: draft.scheduleId },
        data: {
          startDate: draft.startDate,
          endDate: draft.endDate,
        },
        select: { id: true },
      })
    : await params.tx.availabilitySchedule.create({
        data: {
          organizationId: changeSet.organizationId,
          scopeType: changeSet.scopeType,
          scopeId: changeSet.scopeId,
          startDate: draft.startDate,
          endDate: draft.endDate,
        },
        select: { id: true },
      });

  await params.tx.weeklyAvailabilityTemplate.deleteMany({
    where: { availabilityId: schedule.id },
  });

  const templateRows = Array.from(draft.templatesByDay.entries())
    .filter(([, intervals]) => intervals.length > 0)
    .map(([dayOfWeek, intervals]) => ({
      availabilityId: schedule.id,
      dayOfWeek,
      intervals,
    }));

  if (templateRows.length > 0) {
    await params.tx.weeklyAvailabilityTemplate.createMany({
      data: templateRows.map((row) => ({
        availabilityId: row.availabilityId,
        dayOfWeek: row.dayOfWeek,
        intervals: row.intervals as Prisma.InputJsonValue,
      })),
    });
  }

  const overrideRows = Array.from(draft.overridesByDate.entries()).map(([dateKey, override]) => {
    const parsed = parseDateInput(dateKey);
    if (!parsed) throw new Error("INVALID_OVERRIDE_DATE");
    return {
      date: parsed.date,
      kind: override.kind as AvailabilityOverrideKind,
      intervals: override.intervals,
    };
  });

  const keepDateIso = overrideRows.map((row) => row.date.toISOString().slice(0, 10));
  const currentOverrides = await params.tx.availabilityOverride.findMany({
    where: {
      organizationId: changeSet.organizationId,
      scopeType: changeSet.scopeType,
      scopeId: changeSet.scopeId,
    },
    select: { id: true, date: true },
  });

  const toDelete = currentOverrides
    .filter((row) => !keepDateIso.includes(row.date.toISOString().slice(0, 10)))
    .map((row) => row.id);

  if (toDelete.length) {
    await params.tx.availabilityOverride.deleteMany({
      where: { id: { in: toDelete } },
    });
  }

  for (const row of overrideRows) {
    await params.tx.availabilityOverride.upsert({
      where: {
        organizationId_scopeType_scopeId_date: {
          organizationId: changeSet.organizationId,
          scopeType: changeSet.scopeType,
          scopeId: changeSet.scopeId,
          date: row.date,
        },
      },
      create: {
        organizationId: changeSet.organizationId,
        scopeType: changeSet.scopeType,
        scopeId: changeSet.scopeId,
        date: row.date,
        kind: row.kind,
        intervals: row.intervals as Prisma.InputJsonValue,
      },
      update: {
        kind: row.kind,
        intervals: row.intervals as Prisma.InputJsonValue,
      },
    });
  }

  await params.tx.availabilityChangeSet.update({
    where: { id: changeSet.id },
    data: {
      status: "APPLIED",
      appliedAt: new Date(),
      scheduleId: schedule.id,
      preflightSummary: {
        scheduleId: schedule.id,
        appliedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
    },
  });

  return {
    applied: true,
    alreadyApplied: false,
    scheduleId: schedule.id,
  };
}

export async function resolveChangesetConflict(params: {
  tx: Tx;
  organizationId: number;
  changeSetId: number;
  conflictId: number;
  action: "CANCEL" | "RESCHEDULE";
  startsAt?: Date | null;
}) {
  const changeSet = await params.tx.availabilityChangeSet.findFirst({
    where: {
      id: params.changeSetId,
      organizationId: params.organizationId,
    },
    select: {
      id: true,
      organizationId: true,
      scopeType: true,
      scopeId: true,
      status: true,
      draftPayload: true,
    },
  });

  if (!changeSet) throw new Error("NOT_FOUND");
  if (changeSet.status === "CANCELLED") throw new Error("AVAILABILITY_CHANGESET_CANCELLED");
  if (changeSet.status === "APPLIED") throw new Error("AVAILABILITY_CHANGESET_NOT_READY");

  const conflict = await params.tx.availabilityChangeConflict.findFirst({
    where: {
      id: params.conflictId,
      changeSetId: changeSet.id,
      organizationId: params.organizationId,
      status: AvailabilityConflictStatus.OPEN,
    },
    select: {
      id: true,
      entityType: true,
      entityId: true,
    },
  });

  if (!conflict) throw new Error("CONFLICT_NOT_FOUND");

  const draft = parseChangesetDraftPayload(changeSet.draftPayload);
  const scope: ScopeInfo = {
    organizationId: changeSet.organizationId,
    scopeType: changeSet.scopeType,
    scopeId: changeSet.scopeId,
    timezone: (
      await params.tx.organization.findUnique({
        where: { id: changeSet.organizationId },
        select: { timezone: true },
      })
    )?.timezone || "Europe/Lisbon",
  };
  const state = await loadAvailabilityState(params.tx, params.organizationId);
  const schedulesByScope = buildResultingSchedules(state, draft, scope);

  if (conflict.entityType === AvailabilityConflictEntityType.BOOKING) {
    const booking = await params.tx.booking.findFirst({
      where: { id: conflict.entityId, organizationId: params.organizationId },
      select: {
        id: true,
        status: true,
        startsAt: true,
        durationMinutes: true,
        professionalId: true,
        resourceId: true,
        courtId: true,
      },
    });
    if (!booking) throw new Error("BOOKING_NOT_FOUND");

    if (params.action === "CANCEL") {
      await params.tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CANCELLED_BY_ORG },
      });
      await params.tx.availabilityChangeConflict.update({
        where: { id: conflict.id },
        data: {
          status: AvailabilityConflictStatus.RESOLVED,
          resolutionAction: AvailabilityConflictResolutionAction.CANCELLED,
          resolvedAt: new Date(),
        },
      });
      return;
    }

    if (!params.startsAt || Number.isNaN(params.startsAt.getTime())) {
      throw new Error("INVALID_RESCHEDULE_AT");
    }

    const endsAt = new Date(params.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
    const entity: EntityForConflict = {
      entityType: AvailabilityConflictEntityType.BOOKING,
      entityId: booking.id,
      startsAt: params.startsAt,
      endsAt,
      professionalId: booking.professionalId,
      resourceId: booking.resourceId,
      courtId: booking.courtId,
    };

    const covered = isEntityCoveredByResultingAvailability({
      entity,
      scope,
      draft,
      state,
      schedulesByScope,
    });

    if (!covered) {
      throw new Error("AVAILABILITY_CHANGESET_NOT_READY");
    }

    await params.tx.booking.update({
      where: { id: booking.id },
      data: { startsAt: params.startsAt },
    });
    await params.tx.availabilityChangeConflict.update({
      where: { id: conflict.id },
      data: {
        status: AvailabilityConflictStatus.RESOLVED,
        resolutionAction: AvailabilityConflictResolutionAction.RESCHEDULED,
        resolvedAt: new Date(),
      },
    });
    return;
  }

  const session = await params.tx.classSession.findFirst({
    where: { id: conflict.entityId, organizationId: params.organizationId },
    select: {
      id: true,
      status: true,
      startsAt: true,
      endsAt: true,
      professionalId: true,
      courtId: true,
    },
  });

  if (!session) throw new Error("CLASS_SESSION_NOT_FOUND");

  if (params.action === "CANCEL") {
    await params.tx.classSession.update({
      where: { id: session.id },
      data: { status: ClassSessionStatus.CANCELLED },
    });
    await params.tx.availabilityChangeConflict.update({
      where: { id: conflict.id },
      data: {
        status: AvailabilityConflictStatus.RESOLVED,
        resolutionAction: AvailabilityConflictResolutionAction.CANCELLED,
        resolvedAt: new Date(),
      },
    });
    return;
  }

  if (!params.startsAt || Number.isNaN(params.startsAt.getTime())) {
    throw new Error("INVALID_RESCHEDULE_AT");
  }

  const durationMinutes = Math.max(5, Math.round((session.endsAt.getTime() - session.startsAt.getTime()) / 60000));
  const endsAt = new Date(params.startsAt.getTime() + durationMinutes * 60 * 1000);

  const entity: EntityForConflict = {
    entityType: AvailabilityConflictEntityType.CLASS_SESSION,
    entityId: session.id,
    startsAt: params.startsAt,
    endsAt,
    professionalId: session.professionalId,
    resourceId: session.courtId != null ? state.resourceByCourtId.get(session.courtId) ?? null : null,
    courtId: session.courtId,
  };

  const covered = isEntityCoveredByResultingAvailability({
    entity,
    scope,
    draft,
    state,
    schedulesByScope,
  });

  if (!covered) {
    throw new Error("AVAILABILITY_CHANGESET_NOT_READY");
  }

  await params.tx.classSession.update({
    where: { id: session.id },
    data: {
      startsAt: params.startsAt,
      endsAt,
    },
  });

  await params.tx.availabilityChangeConflict.update({
    where: { id: conflict.id },
    data: {
      status: AvailabilityConflictStatus.RESOLVED,
      resolutionAction: AvailabilityConflictResolutionAction.RESCHEDULED,
      resolvedAt: new Date(),
    },
  });
}

export function mapChangesetError(error: unknown) {
  const message = error instanceof Error ? error.message : "INTERNAL_ERROR";
  switch (message) {
    case "AVAILABILITY_CHANGESET_PENDING":
      return { status: 409, errorCode: "AVAILABILITY_CHANGESET_PENDING", message: "Já existe um pedido pendente para este escopo." };
    case "AVAILABILITY_CHANGESET_NOT_READY":
      return { status: 409, errorCode: "AVAILABILITY_CHANGESET_NOT_READY", message: "Ainda existem conflitos por resolver." };
    case "AVAILABILITY_CHANGESET_CANCELLED":
      return { status: 409, errorCode: "AVAILABILITY_CHANGESET_CANCELLED", message: "Este pedido foi cancelado." };
    case "AVAILABILITY_SCHEDULE_OVERLAP":
    case "SCHEDULE_OVERLAP":
      return { status: 409, errorCode: "AVAILABILITY_SCHEDULE_OVERLAP", message: "Existem sobreposições de horários para este escopo." };
    case "INVALID_START_DATE":
    case "INVALID_END_DATE":
    case "END_BEFORE_START":
    case "INVALID_TEMPLATE_DAY":
    case "INVALID_OVERRIDE_DATE":
    case "INVALID_OVERRIDE_KIND":
    case "INVALID_DRAFT_PAYLOAD":
    case "INVALID_RESCHEDULE_AT":
      return { status: 400, errorCode: message, message: "Pedido inválido." };
    case "NOT_FOUND":
      return { status: 404, errorCode: "NOT_FOUND", message: "Pedido não encontrado." };
    case "CONFLICT_NOT_FOUND":
      return { status: 404, errorCode: "CONFLICT_NOT_FOUND", message: "Conflito não encontrado." };
    case "BOOKING_NOT_FOUND":
      return { status: 404, errorCode: "BOOKING_NOT_FOUND", message: "Reserva não encontrada." };
    case "CLASS_SESSION_NOT_FOUND":
      return { status: 404, errorCode: "CLASS_SESSION_NOT_FOUND", message: "Aula não encontrada." };
    default:
      return { status: 500, errorCode: "INTERNAL_ERROR", message: "Erro interno ao processar disponibilidade." };
  }
}

export async function loadChangesetWithConflicts(params: {
  prisma: PrismaClient;
  organizationId: number;
  changeSetId: number;
}) {
  const changeSet = await params.prisma.availabilityChangeSet.findFirst({
    where: { id: params.changeSetId, organizationId: params.organizationId },
    select: {
      id: true,
      organizationId: true,
      scopeType: true,
      scopeId: true,
      scheduleId: true,
      status: true,
      requestedByUserId: true,
      draftPayload: true,
      preflightSummary: true,
      createdAt: true,
      updatedAt: true,
      appliedAt: true,
      cancelledAt: true,
      conflicts: {
        orderBy: [{ status: "asc" }, { startsAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          status: true,
          entityType: true,
          entityId: true,
          startsAt: true,
          endsAt: true,
          reasonCode: true,
          resolutionAction: true,
          resolvedAt: true,
          details: true,
        },
      },
    },
  });

  return changeSet;
}

export function getAvailabilityNowDateKey(timezone: string) {
  const parts = getDateParts(new Date(), timezone);
  return toDateKey(parts.year, parts.month, parts.day);
}
