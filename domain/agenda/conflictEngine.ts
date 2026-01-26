export type AgendaCandidateType = "HARD_BLOCK" | "MATCH_SLOT" | "BOOKING" | "SOFT_BLOCK";

export type AgendaCandidate = {
  type: AgendaCandidateType;
  sourceId: string;
  startsAt: Date;
  endsAt: Date;
  priority?: number;
  meta?: Record<string, unknown>;
};

export type ConflictReason =
  | "NO_CONFLICT"
  | "OVERRIDES_LOWER_PRIORITY"
  | "BLOCKED_BY_HIGHER_PRIORITY"
  | "BLOCKED_BY_EQUAL_PRIORITY"
  | "INVALID_INTERVAL";

export type ConflictEntry = {
  withType: AgendaCandidateType;
  withSourceId: string;
  startsAt: Date;
  endsAt: Date;
  priority: number;
  reason: "OVERLAP" | "INVALID_INTERVAL";
};

export type ConflictDecision = {
  allowed: boolean;
  winnerType?: AgendaCandidateType;
  blockedBy?: AgendaCandidateType;
  reason: ConflictReason;
  conflicts: ConflictEntry[];
};

const DEFAULT_PRIORITY: Record<AgendaCandidateType, number> = {
  HARD_BLOCK: 4,
  MATCH_SLOT: 3,
  BOOKING: 2,
  SOFT_BLOCK: 1,
};

const toPriority = (candidate: AgendaCandidate) => {
  if (typeof candidate.priority === "number" && Number.isFinite(candidate.priority)) {
    return Math.floor(candidate.priority);
  }
  return DEFAULT_PRIORITY[candidate.type];
};

const isValidDate = (value: Date | null | undefined) => {
  if (!value) return false;
  if (!(value instanceof Date)) return false;
  return !Number.isNaN(value.getTime());
};

const isValidInterval = (candidate: AgendaCandidate) => {
  if (!isValidDate(candidate.startsAt) || !isValidDate(candidate.endsAt)) return false;
  return candidate.endsAt.getTime() > candidate.startsAt.getTime();
};

const overlaps = (a: AgendaCandidate, b: AgendaCandidate) => {
  return a.startsAt < b.endsAt && b.startsAt < a.endsAt;
};

const normalize = (items: AgendaCandidate[]) => {
  return [...items]
    .map((item) => ({ ...item, priority: toPriority(item) }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aStart = a.startsAt.getTime();
      const bStart = b.startsAt.getTime();
      if (aStart !== bStart) return aStart - bStart;
      return String(a.sourceId).localeCompare(String(b.sourceId));
    });
};

export function evaluateCandidate(params: {
  candidate: AgendaCandidate;
  existing: AgendaCandidate[];
}): ConflictDecision {
  const candidate = { ...params.candidate, priority: toPriority(params.candidate) };
  const existing = normalize(params.existing);

  if (!isValidInterval(candidate)) {
    return {
      allowed: false,
      reason: "INVALID_INTERVAL",
      conflicts: [],
    };
  }

  const invalidExisting = existing.filter((item) => !isValidInterval(item));
  if (invalidExisting.length > 0) {
    return {
      allowed: false,
      reason: "INVALID_INTERVAL",
      conflicts: invalidExisting.map((item) => ({
        withType: item.type,
        withSourceId: item.sourceId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        priority: toPriority(item),
        reason: "INVALID_INTERVAL",
      })),
    };
  }

  const overlapping = existing.filter((item) => overlaps(candidate, item));
  const conflicts: ConflictEntry[] = overlapping.map((item) => ({
    withType: item.type,
    withSourceId: item.sourceId,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    priority: toPriority(item),
    reason: "OVERLAP",
  }));

  if (overlapping.length === 0) {
    return {
      allowed: true,
      winnerType: candidate.type,
      reason: "NO_CONFLICT",
      conflicts: [],
    };
  }

  const top = overlapping[0];
  if (candidate.priority > toPriority(top)) {
    return {
      allowed: true,
      winnerType: candidate.type,
      reason: "OVERRIDES_LOWER_PRIORITY",
      conflicts,
    };
  }

  if (candidate.priority === toPriority(top)) {
    return {
      allowed: false,
      winnerType: top.type,
      blockedBy: top.type,
      reason: "BLOCKED_BY_EQUAL_PRIORITY",
      conflicts,
    };
  }

  return {
    allowed: false,
    winnerType: top.type,
    blockedBy: top.type,
    reason: "BLOCKED_BY_HIGHER_PRIORITY",
    conflicts,
  };
}
