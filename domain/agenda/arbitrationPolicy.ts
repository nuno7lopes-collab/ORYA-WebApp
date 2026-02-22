import { SourceType } from "@prisma/client";
import type { AgendaCandidateType } from "@/domain/agenda/conflictEngine";

export const AGENDA_PRIORITY_RULE_VERSION = "v1" as const;

export type AgendaPriorityRuleVersion = typeof AGENDA_PRIORITY_RULE_VERSION;

export const AGENDA_PRIORITY_BY_TYPE: Record<AgendaCandidateType, number> = {
  HARD_BLOCK: 5,
  CLASS_SESSION: 4,
  MATCH: 3,
  BOOKING: 2,
  SOFT_BLOCK: 1,
};

export type AgendaDomainConflictReason =
  | "HARD_BLOCK_CONFLICT"
  | "CLASS_SESSION_CONFLICT"
  | "MATCH_CONFLICT"
  | "BOOKING_CONFLICT"
  | "SOFT_BLOCK_CONFLICT"
  | "AGENDA_CONFLICT";

export function mapSourceTypeToAgendaCandidateType(sourceType: SourceType): AgendaCandidateType | null {
  if (sourceType === SourceType.HARD_BLOCK) return "HARD_BLOCK";
  if (sourceType === SourceType.CLASS_SESSION) return "CLASS_SESSION";
  if (sourceType === SourceType.BOOKING) return "BOOKING";
  if (sourceType === SourceType.SOFT_BLOCK) return "SOFT_BLOCK";
  if (
    sourceType === SourceType.MATCH ||
    sourceType === SourceType.EVENT ||
    sourceType === SourceType.TOURNAMENT ||
    sourceType === SourceType.PADEL_REGISTRATION
  ) {
    return "MATCH";
  }
  return null;
}

export function resolveAgendaDomainConflictReason(blockedByType: string | null | undefined): AgendaDomainConflictReason {
  if (blockedByType === "HARD_BLOCK") return "HARD_BLOCK_CONFLICT";
  if (blockedByType === "CLASS_SESSION") return "CLASS_SESSION_CONFLICT";
  if (blockedByType === "MATCH") return "MATCH_CONFLICT";
  if (blockedByType === "BOOKING") return "BOOKING_CONFLICT";
  if (blockedByType === "SOFT_BLOCK") return "SOFT_BLOCK_CONFLICT";
  return "AGENDA_CONFLICT";
}

