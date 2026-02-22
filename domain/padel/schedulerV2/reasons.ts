import type { PadelUnscheduledReason } from "@/domain/padel/schedulerV2/types";

export const PADEL_UNSCHEDULED_REASONS: ReadonlySet<PadelUnscheduledReason> = new Set([
  "INVALID_WINDOW",
  "WINDOW_NOT_SET",
  "NO_COURTS_CONFIGURED",
  "NO_SLOT_IN_WINDOW",
  "NO_COURT_WINDOW",
  "COURT_BLOCKED",
  "PLAYER_UNAVAILABLE",
  "REST_CONFLICT",
  "OVERLAP_CONFLICT",
  "NO_PARTICIPANTS",
  "MISSING_PARTICIPANTS",
  "COURT_NOT_AVAILABLE",
  "NO_SLOT_AVAILABLE",
  "CATEGORY_WINDOW_EXHAUSTED",
  "HARD_BLOCK_CONFLICT",
  "CLASS_SESSION_CONFLICT",
  "BOOKING_CONFLICT",
  "MATCH_CONFLICT",
  "SOFT_BLOCK_CONFLICT",
  "AGENDA_CONFLICT",
]);

export const PadelUnscheduledReasonLabel: Record<string, string> = {
  INVALID_WINDOW: "janela inválida",
  WINDOW_NOT_SET: "janela não definida",
  NO_COURTS_CONFIGURED: "sem campos configurados",
  NO_SLOT_IN_WINDOW: "sem slot na janela",
  NO_COURT_WINDOW: "sem janela de campo",
  COURT_BLOCKED: "campo bloqueado",
  PLAYER_UNAVAILABLE: "jogador indisponível",
  REST_CONFLICT: "conflito de descanso",
  OVERLAP_CONFLICT: "sobreposição",
  NO_PARTICIPANTS: "sem participantes",
  MISSING_PARTICIPANTS: "participantes em falta",
  COURT_NOT_AVAILABLE: "campo indisponível",
  NO_SLOT_AVAILABLE: "sem slot viável",
  CATEGORY_WINDOW_EXHAUSTED: "janela esgotada para categoria",
  HARD_BLOCK_CONFLICT: "conflito com bloqueio rígido",
  CLASS_SESSION_CONFLICT: "conflito com aula",
  BOOKING_CONFLICT: "conflito com reserva",
  MATCH_CONFLICT: "conflito com outro jogo",
  SOFT_BLOCK_CONFLICT: "conflito com bloqueio suave",
  AGENDA_CONFLICT: "conflito de agenda",
};

export const normalizeUnscheduledReason = (value: unknown): PadelUnscheduledReason => {
  if (typeof value !== "string") return "NO_SLOT_AVAILABLE";
  const normalized = value.trim().toUpperCase();
  if (!normalized) return "NO_SLOT_AVAILABLE";
  return normalized as PadelUnscheduledReason;
};
