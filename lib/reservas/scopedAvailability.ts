import {
  buildSlotsForRangeWithSchedules,
  type AvailabilitySchedule,
  type ScheduleOverride,
  type ScheduleTemplate,
} from "@/lib/reservas/availability";

export type AvailabilityScopeType = "ORGANIZATION" | "PROFESSIONAL" | "RESOURCE";

export type ScopedTemplate = {
  availabilityId: number;
  dayOfWeek: number;
  intervals: unknown;
};

export type ScopedOverride = {
  scopeType: AvailabilityScopeType;
  scopeId: number;
  date: Date;
  kind: string;
  intervals: unknown;
};

export type ScopedSchedule = AvailabilitySchedule & {
  scopeType: AvailabilityScopeType;
  scopeId: number;
};

export type ScopedSlotParams = {
  rangeStart: Date;
  rangeEnd: Date;
  timezone: string;
  durationMinutes: number;
  stepMinutes?: number;
  now?: Date;
  scopeType: AvailabilityScopeType;
  scopeId: number;
  orgSchedules: ScopedSchedule[];
  templates: ScopedTemplate[];
  orgOverrides: ScopedOverride[];
  schedulesByScope: Map<string, ScopedSchedule[]>;
  overridesByScope: Map<string, ScopedOverride[]>;
};

export function buildScopeKey(scopeType: AvailabilityScopeType, scopeId: number) {
  return `${scopeType}:${scopeId}`;
}

export function groupByScope<T extends { scopeType: AvailabilityScopeType; scopeId: number }>(rows: T[]) {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const key = buildScopeKey(row.scopeType, row.scopeId);
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  });
  return map;
}

export function resolveScopeData(params: {
  scopeType: AvailabilityScopeType;
  scopeId: number;
  orgSchedules: ScopedSchedule[];
  orgOverrides: ScopedOverride[];
  schedulesByScope: Map<string, ScopedSchedule[]>;
  overridesByScope: Map<string, ScopedOverride[]>;
}) {
  const key = buildScopeKey(params.scopeType, params.scopeId);
  const scopedSchedules = params.schedulesByScope.get(key) ?? [];
  const scopedOverrides = params.overridesByScope.get(key) ?? [];
  const overrides = [...params.orgOverrides, ...scopedOverrides];
  return {
    schedules: scopedSchedules,
    overrides,
    fallbackSchedules: params.orgSchedules,
  };
}

export function buildScopedSlotsForRange(params: ScopedSlotParams) {
  const resolved = resolveScopeData({
    scopeType: params.scopeType,
    scopeId: params.scopeId,
    orgSchedules: params.orgSchedules,
    orgOverrides: params.orgOverrides,
    schedulesByScope: params.schedulesByScope,
    overridesByScope: params.overridesByScope,
  });

  const templates: ScheduleTemplate[] = params.templates;
  const overrides: ScheduleOverride[] = resolved.overrides;

  return buildSlotsForRangeWithSchedules({
    rangeStart: params.rangeStart,
    rangeEnd: params.rangeEnd,
    timezone: params.timezone,
    primarySchedules: resolved.schedules,
    fallbackSchedules: resolved.fallbackSchedules,
    templates,
    overrides,
    durationMinutes: params.durationMinutes,
    stepMinutes: params.stepMinutes,
    now: params.now,
  });
}
