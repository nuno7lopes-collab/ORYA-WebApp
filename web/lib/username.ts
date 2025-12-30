const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/;

export type UsernameValidation =
  | { valid: true; normalized: string }
  | { valid: false; error: string };

/**
 * Remove acentos, espaços e caracteres inválidos, deixando apenas letras, números, _ e . (lowercase).
 * Limita a 30 chars e evita que termine/comece em '.'.
 */
export function sanitizeUsername(input: string): string {
  const base = (input ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, ""); // remove diacríticos
  const cleaned = base.replace(/[^A-Za-z0-9._]/g, "");
  const trimmed = cleaned.replace(/^\.+/, "").replace(/\.+$/, "");
  const collapsedDots = trimmed.replace(/\.{2,}/g, ".");
  return collapsedDots.toLowerCase().slice(0, 30);
}

export function validateUsername(raw: string): UsernameValidation {
  const normalized = sanitizeUsername(raw);
  if (!normalized || normalized.length < 3 || normalized.length > 30) {
    return {
      valid: false,
      error: "Escolhe um username entre 3 e 30 caracteres (letras, números, _ ou .).",
    };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return {
      valid: false,
      error: "O username só pode ter letras, números, _ e . (sem espaços ou acentos).",
    };
  }
  if (normalized.includes("..")) {
    return {
      valid: false,
      error: "O username não pode ter '..' seguido.",
    };
  }
  return { valid: true, normalized };
}

export const USERNAME_RULES_HINT =
  "3-30 caracteres, letras ou números, opcionalmente _ ou ., sem espaços ou acentos.";
