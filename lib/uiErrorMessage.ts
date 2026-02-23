const TECHNICAL_ERROR_CODES = new Set([
  "NOT_ORGANIZATION",
  "UNAUTHENTICATED",
  "INTERNAL_ERROR",
  "FORBIDDEN",
  "ORG_ID_REQUIRED",
  "INVALID_ORG_ID",
  "INVALID_STATE",
]);

const FUNCTIONAL_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_NOT_VERIFIED: "Confirma o teu email para continuar.",
  AUTO_SCHEDULE_INFEASIBLE: "Auto-agendamento inviável para os critérios selecionados.",
  NO_COURTS_CONFIGURED: "Não existem campos configurados para este torneio.",
  INVALID_DATE_RANGE: "Janela temporal inválida.",
  EVENT_WINDOW_REQUIRED: "Define a janela do evento para agendar.",
  MATCH_NOT_AVAILABLE: "Um ou mais jogos já não estão disponíveis para agendamento.",
  CATEGORY_NOT_AVAILABLE: "Categoria não disponível neste torneio.",
  SEEDS_REQUIRED: "Este modo exige cabeças de série válidas.",
  GENERATION_PLAN_INFEASIBLE: "A geração é inviável com a janela/campos atuais.",
  RUN_NOT_APPLIED: "Este lote não foi aplicado e não pode ser desfeito.",
  RUN_NOT_FINALIZED: "O lote ainda está em execução. Tenta novamente em instantes.",
  RUN_NOT_FOUND: "Lote de agendamento não encontrado.",
  RUN_EVENT_MISMATCH: "O lote não pertence ao torneio selecionado.",
};

const TECHNICAL_TOKEN_PATTERN = /^[A-Z0-9_]{4,}$/;

export function sanitizeUiErrorMessage(raw: unknown, fallback: string): string {
  if (typeof raw !== "string") return fallback;
  const message = raw.trim();
  if (!message) return fallback;

  const upper = message.toUpperCase();
  if (FUNCTIONAL_ERROR_MESSAGES[upper]) return FUNCTIONAL_ERROR_MESSAGES[upper];
  if (TECHNICAL_ERROR_CODES.has(upper)) return fallback;
  if (TECHNICAL_TOKEN_PATTERN.test(message) && message === upper) return fallback;

  return message;
}
