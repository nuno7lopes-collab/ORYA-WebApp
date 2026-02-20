export type AutoScheduleMatch = {
  id: number;
  categoryId?: number | null;
  plannedDurationMinutes: number | null;
  courtId: number | null;
  sideAProfileIds: number[];
  sideBProfileIds: number[];
  sideAEmails?: string[];
  sideBEmails?: string[];
  roundLabel?: string | null;
  roundType?: string | null;
  groupLabel?: string | null;
};

export type AutoScheduleExistingMatch = {
  id: number;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
  courtId: number | null;
  sideAProfileIds: number[];
  sideBProfileIds: number[];
  sideAEmails?: string[];
  sideBEmails?: string[];
};

export type AutoScheduleCourt = {
  id: number;
  name?: string | null;
};

export type AutoScheduleAvailability = {
  playerProfileId?: number | null;
  playerEmail?: string | null;
  startAt: Date | null;
  endAt: Date | null;
};

export type AutoScheduleCourtBlock = {
  courtId?: number | null;
  startAt: Date | null;
  endAt: Date | null;
};

export type AutoScheduleConfig = {
  windowStart: Date;
  windowEnd: Date;
  timeWindows?: Array<{ start: Date; end: Date }>;
  courtPriorityOrder?: number[];
  durationMinutes: number;
  slotMinutes: number;
  bufferMinutes: number;
  minRestMinutes: number;
  priority: "GROUPS_FIRST" | "KNOCKOUT_FIRST";
  allowPlaceholderMatches?: boolean;
  preserveInputOrder?: boolean;
};

export type AutoScheduleResult = {
  scheduled: Array<{
    matchId: number;
    courtId: number;
    start: Date;
    end: Date;
    durationMinutes: number;
  }>;
  skipped: Array<{ matchId: number; reason: string }>;
  unscheduledByReason: Record<string, number>;
};

type Interval = { start: Date; end: Date };

const normalizeSchedulingWindows = (config: AutoScheduleConfig) => {
  const windows =
    Array.isArray(config.timeWindows) && config.timeWindows.length > 0
      ? config.timeWindows
          .filter((window) => window?.start instanceof Date && window?.end instanceof Date && window.end > window.start)
          .map((window) => ({ start: window.start, end: window.end }))
      : config.windowEnd > config.windowStart
        ? [{ start: config.windowStart, end: config.windowEnd }]
        : [];

  return windows.sort((a, b) => a.start.getTime() - b.start.getTime());
};

const roundUpToSlot = (value: Date, slotMinutes: number) => {
  const d = new Date(value);
  const minutes = d.getMinutes();
  const remainder = minutes % slotMinutes;
  if (remainder !== 0) {
    d.setMinutes(minutes + (slotMinutes - remainder), 0, 0);
  } else {
    d.setSeconds(0, 0);
  }
  return d;
};

const compareRoundLabels = (a?: string | null, b?: string | null) => {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, "pt-PT", { numeric: true, sensitivity: "base" });
};

const overlapsWithBuffer = (start: Date, end: Date, interval: Interval, bufferMs: number) => {
  const startBuffered = new Date(start.getTime() - bufferMs);
  const endBuffered = new Date(end.getTime() + bufferMs);
  return startBuffered < interval.end && interval.start < endBuffered;
};

const overlapsWithExtra = (start: Date, end: Date, interval: Interval, extraMs: number) => {
  const startBuffered = new Date(start.getTime() - extraMs);
  const endBuffered = new Date(end.getTime() + extraMs);
  return startBuffered < interval.end && interval.start < endBuffered;
};

const addInterval = (map: Map<number, Interval[]>, key: number, interval: Interval) => {
  const list = map.get(key) ?? [];
  list.push(interval);
  map.set(key, list);
};

const addIntervalByKey = (map: Map<string, Interval[]>, key: string, interval: Interval) => {
  const list = map.get(key) ?? [];
  list.push(interval);
  map.set(key, list);
};

const parseRoundLabel = (label?: string | null) => {
  if (!label) return { prefix: "", size: null, label: "" };
  const trimmed = label.trim();
  const prefix = trimmed.startsWith("A ") ? "A" : trimmed.startsWith("B ") ? "B" : "";
  const base = prefix ? trimmed.slice(2).trim() : trimmed;
  let size: number | null = null;
  if (/^L\d+$/i.test(base)) {
    const parsed = Number(base.slice(1));
    size = Number.isFinite(parsed) ? 1000 - parsed : null;
  } else if (/^GF2$|^GRAND_FINAL_RESET$|^GRAND FINAL 2$/i.test(base)) {
    size = 0;
  } else if (/^GF$|^GRAND_FINAL$|^GRAND FINAL$/i.test(base)) {
    size = 1;
  } else if (base.startsWith("R")) {
    const parsed = Number(base.slice(1));
    size = Number.isFinite(parsed) ? parsed : null;
  }
  if (size === null) {
    if (base === "QUARTERFINAL") size = 8;
    else if (base === "SEMIFINAL") size = 4;
    else if (base === "FINAL") size = 2;
  }
  return { prefix, size, label: base };
};

const prefixOrder = (prefix: string) => (prefix === "A" ? 0 : prefix === "B" ? 1 : 2);

const roundTypeOrder = (roundType?: string | null, priority?: AutoScheduleConfig["priority"]) => {
  if (priority === "KNOCKOUT_FIRST") {
    if (roundType === "KNOCKOUT") return 0;
    if (roundType === "GROUPS") return 1;
    return 2;
  }
  if (roundType === "GROUPS") return 0;
  if (roundType === "KNOCKOUT") return 1;
  return 2;
};

export function computeAutoSchedulePlan({
  unscheduledMatches,
  scheduledMatches,
  courts,
  availabilities,
  courtBlocks,
  config,
}: {
  unscheduledMatches: AutoScheduleMatch[];
  scheduledMatches: AutoScheduleExistingMatch[];
  courts: AutoScheduleCourt[];
  availabilities: AutoScheduleAvailability[];
  courtBlocks: AutoScheduleCourtBlock[];
  config: AutoScheduleConfig;
}): AutoScheduleResult {
  const {
    windowStart,
    windowEnd,
    timeWindows,
    courtPriorityOrder,
    durationMinutes,
    slotMinutes,
    bufferMinutes,
    minRestMinutes,
    priority,
    allowPlaceholderMatches = false,
    preserveInputOrder = false,
  } = config;
  const schedulingWindows = normalizeSchedulingWindows({
    windowStart,
    windowEnd,
    timeWindows,
    durationMinutes,
    slotMinutes,
    bufferMinutes,
    minRestMinutes,
    priority,
    allowPlaceholderMatches,
  });

  const courtIdsRaw = courts.map((court) => court.id);
  const configuredCourtPriority = Array.isArray(courtPriorityOrder)
    ? courtPriorityOrder.filter((courtId) => typeof courtId === "number" && Number.isFinite(courtId))
    : [];
  const courtIds = [
    ...configuredCourtPriority.filter((courtId) => courtIdsRaw.includes(courtId)),
    ...courtIdsRaw.filter((courtId) => !configuredCourtPriority.includes(courtId)),
  ];
  const courtIdSet = new Set(courtIds);
  const courtRankById = new Map(courtIds.map((courtId, idx) => [courtId, idx]));
  const bufferMs = bufferMinutes * 60 * 1000;
  const restMs = minRestMinutes * 60 * 1000;

  const availabilityByProfile = new Map<number, Interval[]>();
  const availabilityByEmail = new Map<string, Interval[]>();
  availabilities.forEach((availability) => {
    if (!availability.startAt || !availability.endAt) return;
    const interval = { start: availability.startAt, end: availability.endAt };
    if (availability.playerProfileId) {
      addInterval(availabilityByProfile, availability.playerProfileId, interval);
    }
    const email = availability.playerEmail?.trim().toLowerCase();
    if (email) {
      addIntervalByKey(availabilityByEmail, email, interval);
    }
  });

  const occupiedByCourt = new Map<number, Interval[]>();
  const scheduledCountByCourt = new Map<number, number>();
  courtIds.forEach((id) => occupiedByCourt.set(id, []));
  courtIds.forEach((id) => scheduledCountByCourt.set(id, 0));
  const globalBlocks: Interval[] = [];

  const busyByProfile = new Map<number, Interval[]>();
  const busyByEmail = new Map<string, Interval[]>();

  courtBlocks.forEach((block) => {
    if (!block.startAt || !block.endAt) return;
    const interval = { start: block.startAt, end: block.endAt };
    if (block.courtId) {
      if (courtIdSet.has(block.courtId)) {
        addInterval(occupiedByCourt, block.courtId, interval);
      }
    } else {
      globalBlocks.push(interval);
    }
  });

  const resolveMatchParticipants = (match: {
    sideAProfileIds: number[];
    sideBProfileIds: number[];
    sideAEmails?: string[];
    sideBEmails?: string[];
  }) => {
    const profileIds = new Set<number>();
    const emails = new Set<string>();
    [...(match.sideAProfileIds ?? []), ...(match.sideBProfileIds ?? [])].forEach((id) => {
      if (typeof id === "number" && Number.isFinite(id)) profileIds.add(id);
    });
    [...(match.sideAEmails ?? []), ...(match.sideBEmails ?? [])].forEach((email) => {
      const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (normalized) emails.add(normalized);
    });
    return {
      profileIds: Array.from(profileIds),
      emails: Array.from(emails),
    };
  };

  const addBusy = (participants: { profileIds: number[]; emails: string[] }, interval: Interval) => {
    participants.profileIds.forEach((profileId) => {
      addInterval(busyByProfile, profileId, interval);
    });
    participants.emails.forEach((email) => {
      addIntervalByKey(busyByEmail, email, interval);
    });
  };

  const computeMatchWindow = (match: AutoScheduleExistingMatch) => {
    const start = match.plannedStartAt ?? match.startTime;
    if (!start) return null;
    const duration =
      match.plannedDurationMinutes && match.plannedDurationMinutes > 0
        ? match.plannedDurationMinutes
        : durationMinutes;
    const end = match.plannedEndAt ?? new Date(start.getTime() + duration * 60 * 1000);
    return { start, end };
  };

  scheduledMatches.forEach((match) => {
    const window = computeMatchWindow(match);
    if (!window) return;
    if (match.courtId && courtIdSet.has(match.courtId)) {
      addInterval(occupiedByCourt, match.courtId, { start: window.start, end: window.end });
      scheduledCountByCourt.set(match.courtId, (scheduledCountByCourt.get(match.courtId) ?? 0) + 1);
    }
    addBusy(resolveMatchParticipants(match), { start: window.start, end: window.end });
  });

  const hasOverlap = (list: Interval[] | undefined, start: Date, end: Date) =>
    (list ?? []).some((interval) => overlapsWithBuffer(start, end, interval, bufferMs));
  const hasOverlapWithRest = (list: Interval[] | undefined, start: Date, end: Date) =>
    (list ?? []).some((interval) => overlapsWithExtra(start, end, interval, bufferMs + restMs));

  const isCourtAvailable = (courtId: number, start: Date, end: Date) => {
    if (globalBlocks.some((interval) => overlapsWithBuffer(start, end, interval, bufferMs))) return false;
    return !hasOverlap(occupiedByCourt.get(courtId), start, end);
  };

  const isPlayersAvailable = (
    participants: { profileIds: number[]; emails: string[] },
    start: Date,
    end: Date,
  ) => {
    for (const profileId of participants.profileIds) {
      if (hasOverlapWithRest(busyByProfile.get(profileId), start, end)) return false;
      if (hasOverlap(availabilityByProfile.get(profileId), start, end)) return false;
    }
    for (const email of participants.emails) {
      if (hasOverlapWithRest(busyByEmail.get(email), start, end)) return false;
      if (hasOverlap(availabilityByEmail.get(email), start, end)) return false;
    }
    return true;
  };

  const sortedMatches = preserveInputOrder
    ? [...unscheduledMatches]
    : [...unscheduledMatches].sort((a, b) => {
        const typeDiff = roundTypeOrder(a.roundType, priority) - roundTypeOrder(b.roundType, priority);
        if (typeDiff !== 0) return typeDiff;
        if (a.roundType === "KNOCKOUT" || b.roundType === "KNOCKOUT") {
          const aMeta = parseRoundLabel(a.roundLabel);
          const bMeta = parseRoundLabel(b.roundLabel);
          if (prefixOrder(aMeta.prefix) !== prefixOrder(bMeta.prefix)) {
            return prefixOrder(aMeta.prefix) - prefixOrder(bMeta.prefix);
          }
          if (aMeta.size !== null && bMeta.size !== null && aMeta.size !== bMeta.size) {
            return bMeta.size - aMeta.size;
          }
        }
        if (a.groupLabel && b.groupLabel && a.groupLabel !== b.groupLabel) {
          return a.groupLabel.localeCompare(b.groupLabel);
        }
        if (a.roundLabel && b.roundLabel && a.roundLabel !== b.roundLabel) {
          return compareRoundLabels(a.roundLabel, b.roundLabel);
        }
        return a.id - b.id;
      });

  const nextStartByCourt = new Map<number, Date>();
  const firstWindowStart = schedulingWindows[0]?.start ?? windowStart;
  courtIds.forEach((courtId) => {
    nextStartByCourt.set(courtId, roundUpToSlot(firstWindowStart, slotMinutes));
  });

  const scheduled: AutoScheduleResult["scheduled"] = [];
  const skipped: AutoScheduleResult["skipped"] = [];

  for (const match of sortedMatches) {
    const hasSideA = Array.isArray(match.sideAProfileIds) && match.sideAProfileIds.length > 0;
    const hasSideB = Array.isArray(match.sideBProfileIds) && match.sideBProfileIds.length > 0;
    if ((!hasSideA || !hasSideB) && !allowPlaceholderMatches) {
      skipped.push({ matchId: match.id, reason: "MISSING_PARTICIPANTS" });
      continue;
    }

    const participants = hasSideA && hasSideB ? resolveMatchParticipants(match) : { profileIds: [], emails: [] };
    const matchDuration =
      match.plannedDurationMinutes && match.plannedDurationMinutes > 0
        ? match.plannedDurationMinutes
        : durationMinutes;
    const matchDurationMs = matchDuration * 60 * 1000;
    const candidateCourts = match.courtId
      ? courtIdSet.has(match.courtId)
        ? [match.courtId]
        : []
      : courtIds;

    if (candidateCourts.length === 0) {
      skipped.push({ matchId: match.id, reason: "COURT_NOT_AVAILABLE" });
      continue;
    }

    let bestSlot: { start: Date; end: Date; courtId: number } | null = null;
    let hasAnyCourtWindow = false;
    let hasAnyPlayerWindow = false;
    for (const courtId of candidateCourts) {
      const baseStart = nextStartByCourt.get(courtId) ?? firstWindowStart;
      for (const window of schedulingWindows) {
        if (window.end <= window.start) continue;
        if (baseStart >= window.end) continue;

        let candidate = roundUpToSlot(
          new Date(Math.max(baseStart.getTime(), window.start.getTime())),
          slotMinutes,
        );

        while (candidate.getTime() + matchDurationMs <= window.end.getTime()) {
          const end = new Date(candidate.getTime() + matchDurationMs);
          const courtAvailable = isCourtAvailable(courtId, candidate, end);
          const playersAvailable = isPlayersAvailable(participants, candidate, end);
          if (courtAvailable) hasAnyCourtWindow = true;
          if (playersAvailable) hasAnyPlayerWindow = true;
          if (courtAvailable && playersAvailable) {
            const candidateRank = courtRankById.get(courtId) ?? Number.MAX_SAFE_INTEGER;
            const bestRank = bestSlot ? courtRankById.get(bestSlot.courtId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
            const candidateLoad = scheduledCountByCourt.get(courtId) ?? 0;
            const bestLoad = bestSlot ? scheduledCountByCourt.get(bestSlot.courtId) ?? 0 : Number.MAX_SAFE_INTEGER;
            if (
              !bestSlot ||
              candidate.getTime() < bestSlot.start.getTime() ||
              (candidate.getTime() === bestSlot.start.getTime() && candidateLoad < bestLoad) ||
              (candidate.getTime() === bestSlot.start.getTime() && candidateLoad === bestLoad && candidateRank < bestRank) ||
              (candidate.getTime() === bestSlot.start.getTime() &&
                candidateLoad === bestLoad &&
                candidateRank === bestRank &&
                courtId < bestSlot.courtId)
            ) {
              bestSlot = { start: candidate, end, courtId };
            }
            break;
          }
          candidate = roundUpToSlot(new Date(candidate.getTime() + slotMinutes * 60 * 1000), slotMinutes);
        }
      }
    }

    if (!bestSlot) {
      const reason = !hasAnyCourtWindow
        ? "NO_COURT_WINDOW"
        : !hasAnyPlayerWindow
          ? "PLAYER_UNAVAILABLE"
          : "NO_SLOT_AVAILABLE";
      skipped.push({ matchId: match.id, reason });
      continue;
    }

    scheduled.push({
      matchId: match.id,
      courtId: bestSlot.courtId,
      start: bestSlot.start,
      end: bestSlot.end,
      durationMinutes: Math.round((bestSlot.end.getTime() - bestSlot.start.getTime()) / 60000),
    });

    addInterval(occupiedByCourt, bestSlot.courtId, { start: bestSlot.start, end: bestSlot.end });
    scheduledCountByCourt.set(bestSlot.courtId, (scheduledCountByCourt.get(bestSlot.courtId) ?? 0) + 1);
    addBusy(participants, { start: bestSlot.start, end: bestSlot.end });
    const nextStart = roundUpToSlot(new Date(bestSlot.end.getTime() + bufferMs), slotMinutes);
    nextStartByCourt.set(bestSlot.courtId, nextStart);
  }

  const unscheduledByReason = skipped.reduce<Record<string, number>>((acc, item) => {
    const reason = item.reason?.trim() || "UNKNOWN";
    acc[reason] = (acc[reason] ?? 0) + 1;
    return acc;
  }, {});

  return { scheduled, skipped, unscheduledByReason };
}
