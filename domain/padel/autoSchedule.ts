export type AutoScheduleMatch = {
  id: number;
  plannedDurationMinutes: number | null;
  courtId: number | null;
  pairingAId: number | null;
  pairingBId: number | null;
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
  pairingAId: number | null;
  pairingBId: number | null;
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
  durationMinutes: number;
  slotMinutes: number;
  bufferMinutes: number;
  minRestMinutes: number;
  priority: "GROUPS_FIRST" | "KNOCKOUT_FIRST";
};

export type AutoScheduleParticipants = Map<
  number,
  {
    profileIds: number[];
    emails: string[];
  }
>;

export type AutoScheduleResult = {
  scheduled: Array<{
    matchId: number;
    courtId: number;
    start: Date;
    end: Date;
    durationMinutes: number;
  }>;
  skipped: Array<{ matchId: number; reason: string }>;
};

type Interval = { start: Date; end: Date };

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
  if (base.startsWith("R")) {
    const parsed = Number(base.slice(1));
    size = Number.isFinite(parsed) ? parsed : null;
  } else if (base === "QUARTERFINAL") size = 8;
  else if (base === "SEMIFINAL") size = 4;
  else if (base === "FINAL") size = 2;
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
  pairingPlayers,
  availabilities,
  courtBlocks,
  config,
}: {
  unscheduledMatches: AutoScheduleMatch[];
  scheduledMatches: AutoScheduleExistingMatch[];
  courts: AutoScheduleCourt[];
  pairingPlayers: AutoScheduleParticipants;
  availabilities: AutoScheduleAvailability[];
  courtBlocks: AutoScheduleCourtBlock[];
  config: AutoScheduleConfig;
}): AutoScheduleResult {
  const {
    windowStart,
    windowEnd,
    durationMinutes,
    slotMinutes,
    bufferMinutes,
    minRestMinutes,
    priority,
  } = config;

  const courtIds = courts.map((court) => court.id);
  const courtIdSet = new Set(courtIds);
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
  courtIds.forEach((id) => occupiedByCourt.set(id, []));
  const globalBlocks: Interval[] = [];

  const busyByPairing = new Map<number, Interval[]>();
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

  const resolveMatchParticipants = (match: { pairingAId: number | null; pairingBId: number | null }) => {
    const profileIds = new Set<number>();
    const emails = new Set<string>();
    const pairingIdsForMatch: number[] = [];
    [match.pairingAId, match.pairingBId].forEach((pairingId) => {
      if (!pairingId) return;
      pairingIdsForMatch.push(pairingId);
      const players = pairingPlayers.get(pairingId);
      players?.profileIds.forEach((id) => profileIds.add(id));
      players?.emails.forEach((email) => emails.add(email));
    });
    return {
      profileIds: Array.from(profileIds),
      emails: Array.from(emails),
      pairingIds: pairingIdsForMatch,
    };
  };

  const addBusy = (
    participants: { profileIds: number[]; emails: string[]; pairingIds: number[] },
    interval: Interval,
  ) => {
    participants.pairingIds.forEach((pairingId) => {
      addInterval(busyByPairing, pairingId, interval);
    });
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
    participants: { profileIds: number[]; emails: string[]; pairingIds: number[] },
    start: Date,
    end: Date,
  ) => {
    for (const pairingId of participants.pairingIds) {
      if (hasOverlapWithRest(busyByPairing.get(pairingId), start, end)) return false;
    }
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

  const sortedMatches = [...unscheduledMatches].sort((a, b) => {
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
      return a.roundLabel.localeCompare(b.roundLabel);
    }
    return a.id - b.id;
  });

  const nextStartByCourt = new Map<number, Date>();
  courtIds.forEach((courtId) => {
    nextStartByCourt.set(courtId, roundUpToSlot(windowStart, slotMinutes));
  });

  const scheduled: AutoScheduleResult["scheduled"] = [];
  const skipped: AutoScheduleResult["skipped"] = [];

  for (const match of sortedMatches) {
    if (!match.pairingAId || !match.pairingBId) {
      skipped.push({ matchId: match.id, reason: "MISSING_PAIRINGS" });
      continue;
    }
    const participants = resolveMatchParticipants(match);
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
    for (const courtId of candidateCourts) {
      const baseStart = nextStartByCourt.get(courtId) ?? windowStart;
      let candidate = roundUpToSlot(
        new Date(Math.max(baseStart.getTime(), windowStart.getTime())),
        slotMinutes,
      );

      while (candidate.getTime() + matchDurationMs <= windowEnd.getTime()) {
        const end = new Date(candidate.getTime() + matchDurationMs);
        if (isCourtAvailable(courtId, candidate, end) && isPlayersAvailable(participants, candidate, end)) {
          bestSlot =
            !bestSlot || candidate.getTime() < bestSlot.start.getTime()
              ? { start: candidate, end, courtId }
              : bestSlot;
          break;
        }
        candidate = roundUpToSlot(new Date(candidate.getTime() + slotMinutes * 60 * 1000), slotMinutes);
      }
    }

    if (!bestSlot) {
      skipped.push({ matchId: match.id, reason: "NO_SLOT_AVAILABLE" });
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
    addBusy(participants, { start: bestSlot.start, end: bestSlot.end });
    const nextStart = roundUpToSlot(new Date(bestSlot.end.getTime() + bufferMs), slotMinutes);
    nextStartByCourt.set(bestSlot.courtId, nextStart);
  }

  return { scheduled, skipped };
}
