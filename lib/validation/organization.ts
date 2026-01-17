import { z } from "zod";
import { OPERATION_MODULES, ORGANIZATION_MODULES } from "@/lib/organizationCategories";

/**
 * Valida NIF português (9 dígitos, dígito de controlo módulo 11).
 */
export function isValidPortugueseNIF(value: string): boolean {
  const numeric = value.replace(/\D/g, "");
  if (numeric.length !== 9) return false;

  const firstDigit = Number(numeric[0]);
  if (![1, 2, 3, 5, 6, 8, 9].includes(firstDigit)) return false;

  const digits = numeric.split("").map((d) => Number(d));
  const sum = digits.slice(0, 8).reduce((acc, digit, idx) => acc + digit * (9 - idx), 0);
  const modulo11 = sum % 11;
  const checkDigit = modulo11 < 2 ? 0 : 11 - modulo11;

  return checkDigit === digits[8];
}

/**
 * Valida IBAN (internacional) pelo algoritmo oficial.
 * Aceita qualquer país; não restringe a PT.
 */
export function isValidIBAN(value: string): boolean {
  const cleaned = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/.test(cleaned)) return false;
  if (cleaned.length < 15 || cleaned.length > 34) return false;

  // Move os 4 primeiros caracteres para o fim
  const rearranged = `${cleaned.slice(4)}${cleaned.slice(0, 4)}`;

  // Substitui letras por números (A=10 ... Z=35)
  const numericRepresentation = rearranged
    .split("")
    .map((char) => (/[A-Z]/.test(char) ? (char.charCodeAt(0) - 55).toString() : char))
    .join("");

  // Calcula mod 97 com BigInt para evitar overflow
  let remainder = 0n;
  for (let i = 0; i < numericRepresentation.length; i += 1) {
    const digit = BigInt(numericRepresentation[i] ?? "0");
    remainder = (remainder * 10n + digit) % 97n;
  }

  return remainder === 1n;
}

/**
 * Valida website (URL com domínio válido).
 */
export function isValidWebsite(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;

  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(normalized);
    return Boolean(url.hostname);
  } catch {
    return false;
  }
}

const moduleKeys = ORGANIZATION_MODULES as unknown as [string, ...string[]];

export const becomeOrganizationSchema = z.object({
  primaryModule: z
    .string()
    .trim()
    .min(1, "Escolhe uma operação principal.")
    .refine((value) => OPERATION_MODULES.includes(value as (typeof OPERATION_MODULES)[number]), {
      message: "Operação inválida.",
    }),
  modules: z.array(z.enum(moduleKeys)).default([]),
  businessName: z
    .string()
    .trim()
    .min(1, "Indica o nome da tua organização."),
  username: z
    .string()
    .trim()
    .min(1, "O username é obrigatório.")
    .min(3, "Mínimo 3 caracteres.")
    .max(15, "Máximo 15 caracteres."),
});

export type BecomeOrganizationSchema = typeof becomeOrganizationSchema;
export type BecomeOrganizationFormValues = z.input<typeof becomeOrganizationSchema>;
