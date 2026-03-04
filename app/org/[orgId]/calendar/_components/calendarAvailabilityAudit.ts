type CalendarItemKind = "EVENT" | "TOURNAMENT" | "RESERVATION" | "CLASS";

type Interval = {
  startMinute: number;
  endMinute: number;
};

export type CalendarAvailabilityAuditState = "IN" | "OUTSIDE_SCOPE" | "OUTSIDE_GENERAL" | "NOT_GATED_KIND";

export type CalendarAvailabilityAuditSummary = {
  inCount: number;
  outsideScopeCount: number;
  outsideGeneralCount: number;
  notGatedCount: number;
};

function getMinuteOfDay(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  const hour = Number(map.get("hour") ?? "0");
  const minute = Number(map.get("minute") ?? "0");
  return hour * 60 + minute;
}

function isInsideIntervals(intervals: Interval[] | undefined, startMinute: number, endMinute: number) {
  if (!intervals || intervals.length === 0) return false;
  const safeStart = Math.max(0, Math.min(24 * 60, startMinute));
  const safeEnd = Math.max(0, Math.min(24 * 60, endMinute));
  return intervals.some((interval) => safeStart >= interval.startMinute && safeEnd <= interval.endMinute);
}

function isGatedKind(kind: CalendarItemKind) {
  return kind === "RESERVATION" || kind === "CLASS";
}

export function resolveCalendarAvailabilityAuditState(params: {
  kind: CalendarItemKind;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  generalIntervals?: Interval[];
  scopeIntervals?: Interval[];
  hasSingleScopeSelection: boolean;
}): CalendarAvailabilityAuditState {
  if (!isGatedKind(params.kind)) return "NOT_GATED_KIND";
  const startMinute = getMinuteOfDay(params.startsAt, params.timezone);
  const endMinute = getMinuteOfDay(params.endsAt, params.timezone);
  const isInsideGeneral = isInsideIntervals(params.generalIntervals, startMinute, endMinute);
  if (!params.hasSingleScopeSelection) {
    return isInsideGeneral ? "IN" : "OUTSIDE_GENERAL";
  }
  const isInsideScope = isInsideIntervals(params.scopeIntervals, startMinute, endMinute);
  if (isInsideScope) return "IN";
  if (isInsideGeneral) return "OUTSIDE_SCOPE";
  return "OUTSIDE_GENERAL";
}

export function summarizeCalendarAvailabilityAudit(states: CalendarAvailabilityAuditState[]): CalendarAvailabilityAuditSummary {
  return states.reduce<CalendarAvailabilityAuditSummary>(
    (acc, state) => {
      if (state === "IN") acc.inCount += 1;
      else if (state === "OUTSIDE_SCOPE") acc.outsideScopeCount += 1;
      else if (state === "OUTSIDE_GENERAL") acc.outsideGeneralCount += 1;
      else acc.notGatedCount += 1;
      return acc;
    },
    { inCount: 0, outsideScopeCount: 0, outsideGeneralCount: 0, notGatedCount: 0 },
  );
}

export function resolveCalendarAvailabilityAuditHint(params: {
  summary: CalendarAvailabilityAuditSummary;
  hasSingleScopeSelection: boolean;
  hasActiveSelection: boolean;
}) {
  if (params.summary.outsideScopeCount > 0 && params.hasSingleScopeSelection) {
    return `${params.summary.outsideScopeCount} reservas/aulas fora da disponibilidade do escopo selecionado.`;
  }
  if (params.summary.outsideGeneralCount > 0) {
    return `${params.summary.outsideGeneralCount} reservas/aulas fora do horário disponível.`;
  }
  if (params.hasActiveSelection && !params.hasSingleScopeSelection) {
    return "Múltiplos escopos ativos: seleciona apenas 1 para auditoria detalhada.";
  }
  return null;
}
