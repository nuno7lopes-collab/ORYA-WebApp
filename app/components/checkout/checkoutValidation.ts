import { isValidPhone, sanitizePhone } from "@/lib/phone";
import { isValidEmail } from "./checkoutUtils";

export type GuestValidationMessages = {
  nameRequired?: string;
  emailRequired?: string;
  emailInvalid?: string;
  emailMismatch?: string;
  phoneInvalid?: string;
};

export type GuestValidationInput = {
  name: string;
  email: string;
  emailConfirm?: string;
  phone?: string;
};

export type GuestValidationResult = {
  errors: { name?: string; email?: string; phone?: string };
  normalized: { name: string; email: string; phone?: string };
  hasErrors: boolean;
};

export function validateGuestDetails(
  input: GuestValidationInput,
  messages: GuestValidationMessages = {},
): GuestValidationResult {
  const errors: { name?: string; email?: string; phone?: string } = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const emailConfirm = (input.emailConfirm ?? "").trim();
  const phoneSanitized = sanitizePhone(input.phone ?? "");

  if (!name) {
    errors.name = messages.nameRequired ?? "Nome é obrigatório.";
  }
  if (!email) {
    errors.email = messages.emailRequired ?? "Email é obrigatório.";
  } else if (!isValidEmail(email)) {
    errors.email = messages.emailInvalid ?? "Email inválido.";
  } else if (emailConfirm && emailConfirm !== email) {
    errors.email = messages.emailMismatch ?? "Email e confirmação não coincidem.";
  }

  if (phoneSanitized) {
    if (!isValidPhone(phoneSanitized)) {
      errors.phone =
        messages.phoneInvalid ??
        "Telemóvel inválido. Usa apenas dígitos e opcional + no início.";
    }
  }

  return {
    errors,
    normalized: { name, email, phone: phoneSanitized || undefined },
    hasErrors: Boolean(errors.name || errors.email || errors.phone),
  };
}
