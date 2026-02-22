export type AgendaCandidateType = "HARD_BLOCK" | "CLASS_SESSION" | "MATCH" | "BOOKING" | "SOFT_BLOCK";

export type PriorityRuleVersion = "v1";

export type AgendaCandidate = {
  type: AgendaCandidateType | string;
  sourceId: string;
  startsAt: Date;
  endsAt: Date;
  confirmedAt?: Date | null;
  createdAt?: Date | null;
  claimId?: string | null;
  reasonCode?: string | null;
  priorityRuleVersion?: PriorityRuleVersion | string | null;
  priority?: number;
  meta?: Record<string, unknown>;
};

export type ConflictReason =
  | "NO_CONFLICT"
  | "OVERRIDES_LOWER_PRIORITY"
  | "BLOCKED_BY_HIGHER_PRIORITY"
  | "BLOCKED_BY_EQUAL_PRIORITY"
  | "INVALID_INTERVAL"
  | "TYPE_NOT_SUPPORTED";

export type ConflictEntry = {
  withType: AgendaCandidateType | string;
  withSourceId: string;
  startsAt: Date;
  endsAt: Date;
  priority: number;
  reason: "OVERLAP" | "INVALID_INTERVAL" | "TYPE_NOT_SUPPORTED";
};

export type ConflictDecision = {
  allowed: boolean;
  winnerType?: AgendaCandidateType | string;
  blockedBy?: AgendaCandidateType | string;
  reason: ConflictReason;
  priorityRuleVersion: PriorityRuleVersion | string;
  conflicts: ConflictEntry[];
};

const ACTIVE_PRIORITY_RULE_VERSION: PriorityRuleVersion = "v1";

const PRIORITY_BY_TYPE: Record<AgendaCandidateType, number> = {
  HARD_BLOCK: 5,
  CLASS_SESSION: 4,
  MATCH: 3,
  BOOKING: 2,
  SOFT_BLOCK: 1,
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

const overlaps = (a: AgendaCandidate, b: AgendaCandidate) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;

const normalizeConfirmedAt = (value: Date | null | undefined) =>
  isValidDate(value) ? (value as Date).getTime() : Number.POSITIVE_INFINITY;

const normalizeCreatedAt = (value: Date | null | undefined) =>
  isValidDate(value) ? (value as Date).getTime() : Number.POSITIVE_INFINITY;

function resolvePriorityForActiveRule(candidate: AgendaCandidate): number | null {
  if (typeof candidate.priority === "number" && Number.isFinite(candidate.priority)) {
    return Math.floor(candidate.priority);
  }

  if (candidate.type === "HARD_BLOCK") return PRIORITY_BY_TYPE.HARD_BLOCK;
  if (candidate.type === "CLASS_SESSION") return PRIORITY_BY_TYPE.CLASS_SESSION;
  if (candidate.type === "BOOKING") return PRIORITY_BY_TYPE.BOOKING;
  if (candidate.type === "SOFT_BLOCK") return PRIORITY_BY_TYPE.SOFT_BLOCK;
  if (candidate.type === "MATCH") return PRIORITY_BY_TYPE.MATCH;
  return null;
}

function compareCandidates(a: AgendaCandidate, b: AgendaCandidate) {
  const confirmedA = normalizeConfirmedAt(a.confirmedAt);
  const confirmedB = normalizeConfirmedAt(b.confirmedAt);
  if (confirmedA !== confirmedB) return confirmedA - confirmedB;

  const priorityA = resolvePriorityForActiveRule(a) ?? Number.NEGATIVE_INFINITY;
  const priorityB = resolvePriorityForActiveRule(b) ?? Number.NEGATIVE_INFINITY;
  if (priorityA !== priorityB) return priorityB - priorityA;

  const claimIdA = String(a.claimId ?? a.sourceId ?? "");
  const claimIdB = String(b.claimId ?? b.sourceId ?? "");
  if (claimIdA !== claimIdB) return claimIdA.localeCompare(claimIdB);

  const createdA = normalizeCreatedAt(a.createdAt);
  const createdB = normalizeCreatedAt(b.createdAt);
  if (createdA !== createdB) return createdA - createdB;

  return String(a.sourceId).localeCompare(String(b.sourceId));
}

export function evaluateCandidate(params: {
  candidate: AgendaCandidate;
  existing: AgendaCandidate[];
  priorityRuleVersion?: PriorityRuleVersion | string | null;
}): ConflictDecision {
  const activePriorityRuleVersion = params.priorityRuleVersion ?? ACTIVE_PRIORITY_RULE_VERSION;
  const candidate = { ...params.candidate };
  const existing = [...params.existing];

  if (!isValidInterval(candidate)) {
    return {
      allowed: false,
      reason: "INVALID_INTERVAL",
      priorityRuleVersion: activePriorityRuleVersion,
      conflicts: [],
    };
  }

  if (candidate.priorityRuleVersion && candidate.priorityRuleVersion !== activePriorityRuleVersion) {
    return {
      allowed: false,
      reason: "TYPE_NOT_SUPPORTED",
      priorityRuleVersion: activePriorityRuleVersion,
      conflicts: [
        {
          withType: candidate.type,
          withSourceId: candidate.sourceId,
          startsAt: candidate.startsAt,
          endsAt: candidate.endsAt,
          priority: -1,
          reason: "TYPE_NOT_SUPPORTED",
        },
      ],
    };
  }

  const invalidExisting = existing.filter((item) => !isValidInterval(item));
  if (invalidExisting.length > 0) {
    return {
      allowed: false,
      reason: "INVALID_INTERVAL",
      priorityRuleVersion: activePriorityRuleVersion,
      conflicts: invalidExisting.map((item) => ({
        withType: item.type,
        withSourceId: item.sourceId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        priority: resolvePriorityForActiveRule(item) ?? -1,
        reason: "INVALID_INTERVAL",
      })),
    };
  }

  const candidatePriority = resolvePriorityForActiveRule(candidate);
  if (candidatePriority === null) {
    return {
      allowed: false,
      reason: "TYPE_NOT_SUPPORTED",
      priorityRuleVersion: activePriorityRuleVersion,
      conflicts: [
        {
          withType: candidate.type,
          withSourceId: candidate.sourceId,
          startsAt: candidate.startsAt,
          endsAt: candidate.endsAt,
          priority: -1,
          reason: "TYPE_NOT_SUPPORTED",
        },
      ],
    };
  }

  const overlapping = existing.filter((item) => overlaps(candidate, item));
  const conflicts: ConflictEntry[] = overlapping.map((item) => ({
    withType: item.type,
    withSourceId: item.sourceId,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    priority: resolvePriorityForActiveRule(item) ?? -1,
    reason: resolvePriorityForActiveRule(item) === null ? "TYPE_NOT_SUPPORTED" : "OVERLAP",
  }));

  const unsupported = overlapping.filter((item) => resolvePriorityForActiveRule(item) === null);
  if (unsupported.length > 0) {
    return {
      allowed: false,
      reason: "TYPE_NOT_SUPPORTED",
      priorityRuleVersion: activePriorityRuleVersion,
      conflicts,
    };
  }

  if (overlapping.length === 0) {
    return {
      allowed: true,
      winnerType: candidate.type,
      reason: "NO_CONFLICT",
      priorityRuleVersion: activePriorityRuleVersion,
      conflicts: [],
    };
  }

  const ordered = [candidate, ...overlapping].sort(compareCandidates);
  const winner = ordered[0];
  const winnerPriority = resolvePriorityForActiveRule(winner) ?? -1;

  if (winner.sourceId === candidate.sourceId && winner.type === candidate.type) {
    return {
      allowed: true,
      winnerType: candidate.type,
      reason: "OVERRIDES_LOWER_PRIORITY",
      priorityRuleVersion: activePriorityRuleVersion,
      conflicts,
    };
  }

  const blockedReason = winnerPriority > candidatePriority ? "BLOCKED_BY_HIGHER_PRIORITY" : "BLOCKED_BY_EQUAL_PRIORITY";
  return {
    allowed: false,
    winnerType: winner.type,
    blockedBy: winner.type,
    reason: blockedReason,
    priorityRuleVersion: activePriorityRuleVersion,
    conflicts,
  };
}
