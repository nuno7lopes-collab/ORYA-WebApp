import { padel_format } from "@prisma/client";

export type PadelAnalyticsMatch = {
  id: number;
  categoryId: number | null;
  courtId: number | null;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  actualStartAt: Date | null;
  actualEndAt: Date | null;
  startTime: Date | null;
  roundType: string | null;
  roundLabel: string | null;
};

export type PadelAnalyticsCourt = {
  id: number;
  name: string | null;
};

export type PadelAnalyticsSaleLine = {
  categoryId: number | null;
  categoryLabel: string | null;
  format: padel_format | null;
  grossCents: number;
  netCents: number;
  platformFeeCents: number;
};

export type PadelAnalyticsTotals = {
  totalCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  netCents: number;
};

export type PadelPhaseKey = "GROUPS" | "KNOCKOUT_MAIN" | "KNOCKOUT_B";

export type PadelPhaseStats = {
  phase: PadelPhaseKey;
  label: string;
  matches: number;
  avgMatchMinutes: number;
  avgDelayMinutes: number;
  delayedMatches: number;
  totalMinutes: number;
};

export type PadelDaySummary = {
  date: string;
  windowMinutes: number;
  totalMinutes: number;
  occupancy: number;
  matches: number;
};

export type PadelCourtDaySummary = {
  date: string;
  courtId: number;
  courtName: string | null;
  matches: number;
  minutes: number;
  occupancy: number;
  windowMinutes: number;
};

export type PadelPaymentBreakdown = {
  key: string;
  label: string;
  categoryId: number | null;
  format: padel_format | null;
  totalCents: number;
  netCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
};

export type PadelPhasePayment = {
  phase: PadelPhaseKey;
  label: string;
  totalCents: number;
  netCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
};

export type PadelAnalyticsResult = {
  occupancy: number;
  avgMatchMinutes: number;
  avgDelayMinutes: number;
  delayedMatches: number;
  scheduledMinutes: number;
  courts: number;
  matches: number;
  windowMinutes: number;
  courtsBreakdown: Array<{
    courtId: number;
    name: string | null;
    matches: number;
    minutes: number;
    occupancy: number;
  }>;
  phaseStats: PadelPhaseStats[];
  daySummaries: PadelDaySummary[];
  courtDayBreakdown: PadelCourtDaySummary[];
  payments: PadelAnalyticsTotals;
  paymentsByCategory: PadelPaymentBreakdown[];
  paymentsByPhase: PadelPhasePayment[];
};

type BuildPadelAnalyticsInput = {
  event: { startsAt: Date | null; endsAt: Date | null; timezone?: string | null };
  matches: PadelAnalyticsMatch[];
  courts: PadelAnalyticsCourt[];
  courtCountFallback: number;
  salesTotals: PadelAnalyticsTotals;
  saleLines: PadelAnalyticsSaleLine[];
};

const PHASES: Array<{ key: PadelPhaseKey; label: string }> = [
  { key: "GROUPS", label: "Grupos" },
  { key: "KNOCKOUT_MAIN", label: "KO A" },
  { key: "KNOCKOUT_B", label: "KO B" },
];

const resolvePhaseKey = (roundType?: string | null, roundLabel?: string | null): PadelPhaseKey => {
  if (roundType === "GROUPS") return "GROUPS";
  if (roundType === "KNOCKOUT") {
    if (roundLabel && roundLabel.startsWith("B ")) return "KNOCKOUT_B";
    return "KNOCKOUT_MAIN";
  }
  return "GROUPS";
};

const formatDayKey = (date: Date, timezone: string) =>
  date.toLocaleDateString("en-CA", { timeZone: timezone });

const toMinutes = (ms: number) => Math.max(0, Math.round(ms / 60000));

const allocateCents = (total: number, weights: number[]) => {
  const safeTotal = Number.isFinite(total) ? Math.round(total) : 0;
  const totalWeight = weights.reduce((acc, w) => acc + (Number.isFinite(w) ? w : 0), 0);
  if (safeTotal <= 0 || totalWeight <= 0) return weights.map(() => 0);

  const raw = weights.map((w) => (w / totalWeight) * safeTotal);
  const base = raw.map((value) => Math.floor(value));
  let remainder = safeTotal - base.reduce((acc, v) => acc + v, 0);
  const order = raw
    .map((value, idx) => ({ idx, frac: value - base[idx] }))
    .sort((a, b) => b.frac - a.frac);

  let cursor = 0;
  while (remainder > 0 && order.length > 0) {
    base[order[cursor % order.length].idx] += 1;
    remainder -= 1;
    cursor += 1;
  }

  return base;
};

export function buildPadelAnalytics(input: BuildPadelAnalyticsInput): PadelAnalyticsResult {
  const { event, matches, courts, courtCountFallback, saleLines, salesTotals } = input;
  const courtTotals = new Map<number, { minutes: number; matches: number }>();
  const uniqueCourts = new Set<number>();
  let totalDuration = 0;
  let durationCount = 0;
  let earliestStart: Date | null = null;
  let latestEnd: Date | null = null;
  let delayTotalMinutes = 0;
  let delayCount = 0;
  let delayedMatches = 0;

  const phaseStats = new Map<
    PadelPhaseKey,
    {
      matches: number;
      totalMinutes: number;
      durationCount: number;
      delayTotal: number;
      delayCount: number;
      delayedMatches: number;
    }
  >();

  const timezone = event.timezone || "UTC";
  const dayStats = new Map<string, { start: Date | null; end: Date | null; minutes: number; matches: number }>();
  const courtDayStats = new Map<string, { date: string; courtId: number; matches: number; minutes: number }>();

  const ensurePhase = (key: PadelPhaseKey) => {
    if (!phaseStats.has(key)) {
      phaseStats.set(key, {
        matches: 0,
        totalMinutes: 0,
        durationCount: 0,
        delayTotal: 0,
        delayCount: 0,
        delayedMatches: 0,
      });
    }
    return phaseStats.get(key)!;
  };

  const getDurationMinutes = (match: PadelAnalyticsMatch) => {
    if (match.actualStartAt && match.actualEndAt) {
      return Math.max(1, toMinutes(match.actualEndAt.getTime() - match.actualStartAt.getTime()));
    }
    if (match.plannedDurationMinutes && match.plannedDurationMinutes > 0) return match.plannedDurationMinutes;
    if (match.plannedStartAt && match.plannedEndAt) {
      return Math.max(1, toMinutes(match.plannedEndAt.getTime() - match.plannedStartAt.getTime()));
    }
    return null;
  };

  matches.forEach((m) => {
    const duration = getDurationMinutes(m);
    const plannedStart = m.plannedStartAt ?? m.startTime ?? m.actualStartAt ?? null;
    const plannedEnd =
      m.actualEndAt ??
      m.plannedEndAt ??
      (plannedStart && duration ? new Date(plannedStart.getTime() + duration * 60000) : null);
    if (plannedStart) {
      earliestStart = earliestStart ? (plannedStart < earliestStart ? plannedStart : earliestStart) : plannedStart;
    }
    if (plannedEnd) {
      latestEnd = latestEnd ? (plannedEnd > latestEnd ? plannedEnd : latestEnd) : plannedEnd;
    }

    if (duration && duration > 0) {
      totalDuration += duration;
      durationCount += 1;
      if (m.courtId) {
        uniqueCourts.add(m.courtId);
        const current = courtTotals.get(m.courtId) ?? { minutes: 0, matches: 0 };
        courtTotals.set(m.courtId, {
          minutes: current.minutes + duration,
          matches: current.matches + 1,
        });
      }
    }

    const delayPlanned = m.plannedStartAt ?? m.startTime ?? null;
    if (delayPlanned && m.actualStartAt) {
      delayCount += 1;
      const delayMinutes = Math.max(0, toMinutes(m.actualStartAt.getTime() - delayPlanned.getTime()));
      delayTotalMinutes += delayMinutes;
      if (delayMinutes > 0) delayedMatches += 1;
    }

    const phaseKey = resolvePhaseKey(m.roundType, m.roundLabel);
    const phase = ensurePhase(phaseKey);
    phase.matches += 1;
    if (duration && duration > 0) {
      phase.totalMinutes += duration;
      phase.durationCount += 1;
    }
    if (delayPlanned && m.actualStartAt) {
      phase.delayCount += 1;
      const delayMinutes = Math.max(0, toMinutes(m.actualStartAt.getTime() - delayPlanned.getTime()));
      phase.delayTotal += delayMinutes;
      if (delayMinutes > 0) phase.delayedMatches += 1;
    }

    if (plannedStart && plannedEnd) {
      const dayKey = formatDayKey(plannedStart, timezone);
      const day = dayStats.get(dayKey) ?? { start: null, end: null, minutes: 0, matches: 0 };
      day.start = day.start ? (plannedStart < day.start ? plannedStart : day.start) : plannedStart;
      day.end = day.end ? (plannedEnd > day.end ? plannedEnd : day.end) : plannedEnd;
      if (duration && duration > 0) day.minutes += duration;
      day.matches += 1;
      dayStats.set(dayKey, day);

      if (m.courtId) {
        const key = `${dayKey}:${m.courtId}`;
        const courtDay = courtDayStats.get(key) ?? {
          date: dayKey,
          courtId: m.courtId,
          matches: 0,
          minutes: 0,
        };
        if (duration && duration > 0) courtDay.minutes += duration;
        courtDay.matches += 1;
        courtDayStats.set(key, courtDay);
      }
    }
  });

  const courtsList =
    courts.length > 0
      ? courts
      : Array.from(uniqueCourts.values()).map((id) => ({ id, name: null }));
  const courtCount =
    courts.length > 0
      ? courts.length
      : courtCountFallback > 0
        ? courtCountFallback
        : Math.max(1, uniqueCourts.size);

  const windowStart = event.startsAt ?? earliestStart;
  const windowEnd = event.endsAt ?? latestEnd;
  const eventMinutes =
    windowStart && windowEnd
      ? Math.max(1, toMinutes(windowEnd.getTime() - windowStart.getTime()))
      : 0;

  const totalScheduledMinutes = Array.from(courtTotals.values()).reduce((acc, v) => acc + v.minutes, 0);
  const totalAvailableMinutes = eventMinutes > 0 ? eventMinutes * Math.max(1, courtCount) : 0;
  const occupancy = totalAvailableMinutes > 0 ? Math.round((totalScheduledMinutes / totalAvailableMinutes) * 100) : 0;

  const courtsBreakdown = (courtsList.length
    ? courtsList
    : Array.from(uniqueCourts.values()).map((id) => ({ id, name: null })))
    .map((court) => {
      const stats = courtTotals.get(court.id) ?? { minutes: 0, matches: 0 };
      const courtOccupancy = eventMinutes > 0 ? Math.round((stats.minutes / eventMinutes) * 100) : 0;
      return {
        courtId: court.id,
        name: court.name ?? null,
        matches: stats.matches,
        minutes: stats.minutes,
        occupancy: courtOccupancy,
      };
    })
    .sort((a, b) => b.minutes - a.minutes);

  const phaseStatsList = PHASES.map((phase) => {
    const data = phaseStats.get(phase.key);
    if (!data) return null;
    return {
      phase: phase.key,
      label: phase.label,
      matches: data.matches,
      avgMatchMinutes: data.durationCount > 0 ? Math.round(data.totalMinutes / data.durationCount) : 0,
      avgDelayMinutes: data.delayCount > 0 ? Math.round(data.delayTotal / data.delayCount) : 0,
      delayedMatches: data.delayedMatches,
      totalMinutes: data.totalMinutes,
    };
  }).filter((item): item is PadelPhaseStats => Boolean(item));

  const daySummaries: PadelDaySummary[] = Array.from(dayStats.entries())
    .map(([date, stats]) => {
      const windowMinutes = stats.start && stats.end ? Math.max(1, toMinutes(stats.end.getTime() - stats.start.getTime())) : 0;
      const occupancy =
        windowMinutes > 0
          ? Math.round((stats.minutes / (windowMinutes * Math.max(1, courtCount))) * 100)
          : 0;
      return {
        date,
        windowMinutes,
        totalMinutes: stats.minutes,
        occupancy,
        matches: stats.matches,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const courtNames = new Map(courtsList.map((court) => [court.id, court.name ?? null]));
  const courtDayBreakdown: PadelCourtDaySummary[] = Array.from(courtDayStats.values())
    .map((item) => {
      const dayWindow = dayStats.get(item.date);
      const windowMinutes =
        dayWindow?.start && dayWindow?.end
          ? Math.max(1, toMinutes(dayWindow.end.getTime() - dayWindow.start.getTime()))
          : 0;
      const occupancy = windowMinutes > 0 ? Math.round((item.minutes / windowMinutes) * 100) : 0;
      return {
        date: item.date,
        courtId: item.courtId,
        courtName: courtNames.get(item.courtId) ?? null,
        matches: item.matches,
        minutes: item.minutes,
        occupancy,
        windowMinutes,
      };
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return b.minutes - a.minutes;
    });

  const paymentsByCategoryMap = new Map<string, PadelPaymentBreakdown>();
  saleLines.forEach((line) => {
    const key = line.categoryId ? String(line.categoryId) : "none";
    const label = line.categoryLabel || "Sem categoria";
    const existing =
      paymentsByCategoryMap.get(key) ??
      {
        key,
        label,
        categoryId: line.categoryId ?? null,
        format: line.format ?? null,
        totalCents: 0,
        netCents: 0,
        platformFeeCents: 0,
        stripeFeeCents: 0,
      };
    existing.totalCents += line.grossCents;
    existing.netCents += line.netCents;
    existing.platformFeeCents += line.platformFeeCents;
    paymentsByCategoryMap.set(key, existing);
  });

  const paymentsByCategory = Array.from(paymentsByCategoryMap.values());
  const categoryTotals = paymentsByCategory.map((cat) => cat.totalCents);
  const stripeAllocations = allocateCents(salesTotals.stripeFeeCents, categoryTotals);
  paymentsByCategory.forEach((cat, idx) => {
    cat.stripeFeeCents = stripeAllocations[idx] ?? 0;
  });
  paymentsByCategory.sort((a, b) => b.totalCents - a.totalCents);

  const phaseTotals = new Map<PadelPhaseKey, PadelPhasePayment>();
  PHASES.forEach((phase) => {
    phaseTotals.set(phase.key, {
      phase: phase.key,
      label: phase.label,
      totalCents: 0,
      netCents: 0,
      platformFeeCents: 0,
      stripeFeeCents: 0,
    });
  });

  const matchCountsByCategory = new Map<number, Record<PadelPhaseKey, number>>();
  matches.forEach((match) => {
    if (!match.categoryId) return;
    const entry =
      matchCountsByCategory.get(match.categoryId) ?? { GROUPS: 0, KNOCKOUT_MAIN: 0, KNOCKOUT_B: 0 };
    const phaseKey = resolvePhaseKey(match.roundType, match.roundLabel);
    entry[phaseKey] += 1;
    matchCountsByCategory.set(match.categoryId, entry);
  });

  paymentsByCategory.forEach((category) => {
    const weights: Record<PadelPhaseKey, number> = { GROUPS: 0, KNOCKOUT_MAIN: 0, KNOCKOUT_B: 0 };
    const matchCounts = category.categoryId ? matchCountsByCategory.get(category.categoryId) : null;
    if (matchCounts) {
      PHASES.forEach((phase) => {
        weights[phase.key] = matchCounts[phase.key] ?? 0;
      });
    }

    const totalMatches = Object.values(weights).reduce((acc, v) => acc + v, 0);
    if (totalMatches === 0) {
      if (category.format === "QUADRO_ELIMINATORIO" || category.format === "QUADRO_AB") {
        weights.KNOCKOUT_MAIN = 1;
      } else if (category.format === "NON_STOP" || category.format === "TODOS_CONTRA_TODOS") {
        weights.GROUPS = 1;
      } else if (category.format === "GRUPOS_ELIMINATORIAS") {
        weights.GROUPS = 1;
        weights.KNOCKOUT_MAIN = 1;
      } else {
        weights.GROUPS = 1;
      }
    }

    const weightValues = PHASES.map((phase) => weights[phase.key]);
    const totalAlloc = allocateCents(category.totalCents, weightValues);
    const netAlloc = allocateCents(category.netCents, weightValues);
    const platformAlloc = allocateCents(category.platformFeeCents, weightValues);
    const stripeAlloc = allocateCents(category.stripeFeeCents, weightValues);

    PHASES.forEach((phase, idx) => {
      const target = phaseTotals.get(phase.key)!;
      target.totalCents += totalAlloc[idx] ?? 0;
      target.netCents += netAlloc[idx] ?? 0;
      target.platformFeeCents += platformAlloc[idx] ?? 0;
      target.stripeFeeCents += stripeAlloc[idx] ?? 0;
    });
  });

  return {
    occupancy,
    avgMatchMinutes: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    avgDelayMinutes: delayCount > 0 ? Math.round(delayTotalMinutes / delayCount) : 0,
    delayedMatches,
    scheduledMinutes: totalScheduledMinutes,
    courts: courtCount,
    matches: matches.length,
    windowMinutes: eventMinutes,
    courtsBreakdown,
    phaseStats: phaseStatsList,
    daySummaries,
    courtDayBreakdown,
    payments: {
      totalCents: salesTotals.totalCents,
      platformFeeCents: salesTotals.platformFeeCents,
      stripeFeeCents: salesTotals.stripeFeeCents,
      netCents: salesTotals.netCents,
    },
    paymentsByCategory,
    paymentsByPhase: Array.from(phaseTotals.values()),
  };
}
