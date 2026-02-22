import type { AgendaCandidate, AgendaCandidateType, ConflictDecision } from "@/domain/agenda/conflictEngine";
import { evaluateCandidate } from "@/domain/agenda/conflictEngine";
import { resolveAgendaDomainConflictReason, type AgendaDomainConflictReason } from "@/domain/agenda/arbitrationPolicy";

const AGENDA_TYPE_LABEL: Record<AgendaCandidateType, string> = {
  HARD_BLOCK: "bloqueio",
  CLASS_SESSION: "aula",
  MATCH: "jogo",
  BOOKING: "reserva",
  SOFT_BLOCK: "bloqueio suave",
};

type ExistingHardBlock = {
  id: string | number;
  courtId: number | null;
  startAt: Date;
  endAt: Date;
};

type ExistingScheduledMatch = {
  id: number;
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
  courtId: number | null;
};

type ExistingBooking = {
  id: number;
  courtId: number | null;
  startsAt: Date;
  durationMinutes: number;
  status: string;
  pendingExpiresAt: Date | null;
  updatedAt?: Date | null;
};

type ExistingSoftBlock = {
  id: number;
  scopeType: string;
  scopeId: number | null;
  startsAt: Date;
  endsAt: Date;
};

type ExistingClassSession = {
  id: number;
  courtId: number | null;
  startsAt: Date;
  endsAt: Date;
};

export type ScheduleBatchUpdate = {
  matchId: number;
  courtId: number;
  start: Date;
  end: Date;
};

export type ScheduleBatchRejected = {
  matchId: number;
  reason: AgendaDomainConflictReason;
  blockedByType?: AgendaCandidateType | string;
  blockedBySourceId?: string;
  decision: ConflictDecision;
};

export type ScheduleBatchWarning = {
  matchId: number;
  message: string;
  details?: Record<string, unknown>;
};

export type ScheduleBatchEvaluationResult = {
  acceptedUpdates: ScheduleBatchUpdate[];
  rejectedUpdates: ScheduleBatchRejected[];
  warnings: ScheduleBatchWarning[];
  missingExisting: boolean;
  blockedDecision?: {
    matchId: number;
    decision: ConflictDecision;
  };
};

export type ScheduleCandidateEvaluation = {
  allowed: boolean;
  decision: ConflictDecision;
  reason: AgendaDomainConflictReason | null;
  blockedByType?: AgendaCandidateType | string;
  blockedBySourceId?: string;
  warning: ReturnType<typeof buildAgendaWarning>;
};

function resolveAgendaTypeLabel(type: AgendaCandidateType | string, fallback: string) {
  if (type in AGENDA_TYPE_LABEL) {
    return AGENDA_TYPE_LABEL[type as AgendaCandidateType];
  }
  return fallback;
}

export function buildAgendaWarning(decision: ConflictDecision, candidateType: AgendaCandidateType | string) {
  if (!decision.allowed || decision.conflicts.length === 0) return null;
  const primary = decision.conflicts[0];
  const candidateLabel = resolveAgendaTypeLabel(candidateType, "agendamento");
  const conflictLabel = resolveAgendaTypeLabel(primary.withType, "registo");
  return {
    message: `Aviso: ${candidateLabel} sobrepõe-se a ${conflictLabel}.`,
    details: {
      blockedByType: primary.withType,
      blockedBySourceId: primary.withSourceId,
      reason: decision.reason,
    },
  };
}

export function evaluateCandidateAgainstAgenda(params: {
  candidate: AgendaCandidate;
  existing: AgendaCandidate[];
}): ScheduleCandidateEvaluation {
  const decision = evaluateCandidate({
    candidate: params.candidate,
    existing: params.existing,
  });

  if (!decision.allowed) {
    const primaryConflict = decision.conflicts[0];
    const blockedByType = decision.blockedBy ?? primaryConflict?.withType;
    return {
      allowed: false,
      decision,
      reason: resolveAgendaDomainConflictReason(blockedByType),
      ...(blockedByType ? { blockedByType } : {}),
      ...(primaryConflict?.withSourceId ? { blockedBySourceId: primaryConflict.withSourceId } : {}),
      warning: null,
    };
  }

  return {
    allowed: true,
    decision,
    reason: null,
    warning: buildAgendaWarning(decision, params.candidate.type),
  };
}

function isActiveBooking(booking: { status: string; pendingExpiresAt: Date | null }) {
  if (["CONFIRMED", "DISPUTED", "NO_SHOW"].includes(booking.status)) return true;
  if (["PENDING_CONFIRMATION", "PENDING"].includes(booking.status)) {
    return booking.pendingExpiresAt ? booking.pendingExpiresAt > new Date() : false;
  }
  return false;
}

export function buildMatchWindow(match: {
  plannedStartAt: Date | null;
  plannedEndAt: Date | null;
  plannedDurationMinutes: number | null;
  startTime: Date | null;
}) {
  const start = match.plannedStartAt ?? match.startTime;
  const end =
    match.plannedEndAt ||
    (start && match.plannedDurationMinutes
      ? new Date(start.getTime() + Number(match.plannedDurationMinutes) * 60 * 1000)
      : match.startTime);
  return { start, end: end ?? start };
}

export function buildExistingByCourt(params: {
  courtIds: number[];
  hardBlocks: ExistingHardBlock[];
  scheduledMatches: ExistingScheduledMatch[];
  bookings: ExistingBooking[];
  softBlocks: ExistingSoftBlock[];
  classSessions: ExistingClassSession[];
}): { existingByCourt: Map<number, AgendaCandidate[]>; missingExisting: boolean } {
  const existingByCourt = new Map<number, AgendaCandidate[]>();
  params.courtIds.forEach((courtId) => {
    existingByCourt.set(courtId, []);
  });

  let missingExisting = false;

  const addExisting = (courtId: number, candidate: AgendaCandidate) => {
    const bucket = existingByCourt.get(courtId);
    if (!bucket) {
      missingExisting = true;
      return;
    }
    bucket.push(candidate);
  };

  params.hardBlocks.forEach((block) => {
    if (!block.courtId) return;
    addExisting(block.courtId, {
      type: "HARD_BLOCK",
      sourceId: String(block.id),
      startsAt: block.startAt,
      endsAt: block.endAt,
    });
  });

  params.scheduledMatches.forEach((match) => {
    if (!match.courtId) return;
    const { start, end } = buildMatchWindow(match);
    if (!start || !end) {
      missingExisting = true;
      return;
    }
    addExisting(match.courtId, {
      type: "MATCH",
      sourceId: String(match.id),
      startsAt: start,
      endsAt: end,
      reasonCode: "MATCH_SLOT",
    });
  });

  params.bookings.forEach((booking) => {
    if (!booking.courtId || !isActiveBooking(booking)) return;
    const end = new Date(booking.startsAt.getTime() + booking.durationMinutes * 60 * 1000);
    addExisting(booking.courtId, {
      type: "BOOKING",
      sourceId: String(booking.id),
      startsAt: booking.startsAt,
      endsAt: end,
      confirmedAt: booking.updatedAt ?? booking.startsAt,
    });
  });

  params.softBlocks.forEach((block) => {
    if (block.scopeType === "ORGANIZATION") {
      params.courtIds.forEach((courtId) => {
        addExisting(courtId, {
          type: "SOFT_BLOCK",
          sourceId: String(block.id),
          startsAt: block.startsAt,
          endsAt: block.endsAt,
        });
      });
      return;
    }
    if (block.scopeType !== "COURT" || !block.scopeId) return;
    addExisting(block.scopeId, {
      type: "SOFT_BLOCK",
      sourceId: String(block.id),
      startsAt: block.startsAt,
      endsAt: block.endsAt,
    });
  });

  params.classSessions.forEach((session) => {
    if (!session.courtId) return;
    addExisting(session.courtId, {
      type: "CLASS_SESSION",
      sourceId: String(session.id),
      startsAt: session.startsAt,
      endsAt: session.endsAt,
    });
  });

  return { existingByCourt, missingExisting };
}

export function evaluateMatchBatchAgainstAgenda(params: {
  updates: ScheduleBatchUpdate[];
  existingByCourt: Map<number, AgendaCandidate[]>;
  partialMode: "ALLOW_PARTIAL" | "REQUIRE_FULL";
}): ScheduleBatchEvaluationResult {
  const sortedUpdates = [...params.updates].sort((a, b) => {
    if (a.courtId !== b.courtId) return a.courtId - b.courtId;
    const startDiff = a.start.getTime() - b.start.getTime();
    if (startDiff !== 0) return startDiff;
    return a.matchId - b.matchId;
  });

  const acceptedUpdates: ScheduleBatchUpdate[] = [];
  const rejectedUpdates: ScheduleBatchRejected[] = [];
  const warnings: ScheduleBatchWarning[] = [];
  let missingExisting = false;
  let blockedDecision: { matchId: number; decision: ConflictDecision } | undefined;

  for (const update of sortedUpdates) {
    const bucket = params.existingByCourt.get(update.courtId);
    if (!bucket) {
      missingExisting = true;
      continue;
    }

    const candidate: AgendaCandidate = {
      type: "MATCH",
      sourceId: String(update.matchId),
      startsAt: update.start,
      endsAt: update.end,
      reasonCode: "MATCH_SLOT",
    };
    const evaluation = evaluateCandidateAgainstAgenda({
      candidate,
      existing: bucket,
    });

    if (!evaluation.allowed) {
      rejectedUpdates.push({
        matchId: update.matchId,
        reason: evaluation.reason ?? "AGENDA_CONFLICT",
        blockedByType: evaluation.blockedByType,
        blockedBySourceId: evaluation.blockedBySourceId,
        decision: evaluation.decision,
      });

      if (params.partialMode === "REQUIRE_FULL") {
        blockedDecision = { matchId: update.matchId, decision: evaluation.decision };
        break;
      }
      continue;
    }

    const warning = evaluation.warning;
    if (warning) {
      warnings.push({
        matchId: update.matchId,
        message: warning.message,
        details: warning.details,
      });
    }

    acceptedUpdates.push(update);
    bucket.push(candidate);
  }

  return {
    acceptedUpdates,
    rejectedUpdates,
    warnings,
    missingExisting,
    ...(blockedDecision ? { blockedDecision } : {}),
  };
}
