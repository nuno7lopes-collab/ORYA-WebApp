import type { AgendaCandidateType, ConflictDecision, ConflictReason } from "@/domain/agenda/conflictEngine";

export type AgendaConflictReason = ConflictReason | "MISSING_EXISTING_DATA";

export type AgendaConflictDetails = {
  blockedByType?: AgendaCandidateType;
  blockedBySourceId?: string;
  reason: AgendaConflictReason;
};

export type AgendaConflictPayload = {
  errorCode: "AGENDA_CONFLICT";
  details: AgendaConflictDetails;
};

const pickPrimaryConflict = (decision: ConflictDecision) => {
  if (!decision.conflicts.length) return null;
  return decision.conflicts[0];
};

export function buildAgendaConflictPayload(params: {
  decision?: ConflictDecision | null;
  fallbackReason?: "MISSING_EXISTING_DATA";
}): AgendaConflictPayload {
  if (!params.decision) {
    return {
      errorCode: "AGENDA_CONFLICT",
      details: {
        reason: params.fallbackReason ?? "MISSING_EXISTING_DATA",
      },
    };
  }

  const primary = pickPrimaryConflict(params.decision);
  return {
    errorCode: "AGENDA_CONFLICT",
    details: {
      blockedByType: params.decision.blockedBy ?? primary?.withType,
      blockedBySourceId: primary?.withSourceId,
      reason: params.decision.reason,
    },
  };
}
