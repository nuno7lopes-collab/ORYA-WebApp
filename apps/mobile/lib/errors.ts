const normalize = (message: string) => message.replace(/\s+/g, " ").trim();

const looksTechnical = (message: string) => {
  const lower = message.toLowerCase();
  if (lower.includes("api ") || lower.includes("errorcode") || lower.includes("requestid") || lower.includes("correlationid")) {
    return true;
  }
  if (message.includes("{") && message.includes("}")) return true;
  return false;
};

export const getUserFacingError = (err: unknown, fallback: string) => {
  if (!err) return fallback;
  const raw = err instanceof Error ? err.message : String(err);
  const message = normalize(raw);
  if (!message) return fallback;
  if (message.length > 160) return fallback;
  if (looksTechnical(message)) return fallback;
  return message;
};
