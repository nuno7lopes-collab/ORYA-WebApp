import { buildSlotsForRange, normalizeIntervals } from "@/lib/reservas/availability";

export type AvailabilityScopeType = "ORGANIZATION" | "PROFESSIONAL" | "RESOURCE";

export type ScopedTemplate = {
  scopeType: AvailabilityScopeType;
  scopeId: number;
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

export type ScopedSlotParams = {
  rangeStart: Date;
  rangeEnd: Date;
  timezone: string;
  durationMinutes: number;
  stepMinutes?: number;
  now?: Date;
  scopeType: AvailabilityScopeType;
  scopeId: number;
  orgTemplates: ScopedTemplate[];
  orgOverrides: ScopedOverride[];
  templatesByScope: Map<string, ScopedTemplate[]>;
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
  orgTemplates: ScopedTemplate[];
  orgOverrides: ScopedOverride[];
  templatesByScope: Map<string, ScopedTemplate[]>;
  overridesByScope: Map<string, ScopedOverride[]>;
}) {
  const key = buildScopeKey(params.scopeType, params.scopeId);
  const scopedTemplates = params.templatesByScope.get(key) ?? [];
  const scopedOverrides = params.overridesByScope.get(key) ?? [];
  const hasCustomTemplates = scopedTemplates.some(
    (template) => normalizeIntervals(template.intervals).length > 0,
  );
  return {
    templates: hasCustomTemplates ? scopedTemplates : params.orgTemplates,
    overrides: hasCustomTemplates ? scopedOverrides : params.orgOverrides,
    hasCustomTemplates,
  };
}

export function buildScopedSlotsForRange(params: ScopedSlotParams) {
  const resolved = resolveScopeData({
    scopeType: params.scopeType,
    scopeId: params.scopeId,
    orgTemplates: params.orgTemplates,
    orgOverrides: params.orgOverrides,
    templatesByScope: params.templatesByScope,
    overridesByScope: params.overridesByScope,
  });

  return buildSlotsForRange({
    rangeStart: params.rangeStart,
    rangeEnd: params.rangeEnd,
    timezone: params.timezone,
    templates: resolved.templates,
    overrides: resolved.overrides,
    durationMinutes: params.durationMinutes,
    stepMinutes: params.stepMinutes,
    now: params.now,
  });
}
