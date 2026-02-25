import { buildOrgHref, parseOrganizationId } from "@/lib/organizationIdUtils";

type ErrorDetails = Record<string, unknown>;

export type ParsedApiError = {
  errorCode: string | null;
  message: string;
  details: ErrorDetails | null;
};

export type PaymentGateUiState = {
  message: string;
  ctaHref: string | null;
  ctaLabel: string | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function resolveDefaultPaymentsHref(organizationId: number | null) {
  if (!organizationId) return "/org-hub/organizations";
  return buildOrgHref(organizationId, "/finance", { view: "payouts" });
}

function resolveDefaultOfficialEmailHref(organizationId: number | null) {
  if (!organizationId) return "/org-hub/organizations";
  return buildOrgHref(organizationId, "/settings", { tab: "official-email" });
}

export function parseApiError(payload: unknown, fallbackMessage: string): ParsedApiError {
  const topLevel = asObject(payload);
  const data = asObject(topLevel?.data);
  const details = asObject(topLevel?.details) ?? asObject(data?.details) ?? asObject(data);
  const errorCodeRaw = topLevel?.errorCode ?? topLevel?.code ?? topLevel?.error ?? data?.errorCode ?? data?.error;
  const message =
    (typeof topLevel?.message === "string" && topLevel.message.trim()) ||
    (typeof topLevel?.error === "string" && topLevel.error.trim()) ||
    (typeof data?.message === "string" && data.message.trim()) ||
    fallbackMessage;
  const errorCode = typeof errorCodeRaw === "string" && errorCodeRaw.trim() ? errorCodeRaw.trim() : null;
  return { errorCode, message, details };
}

function toBoolean(value: unknown) {
  return value === true;
}

function resolveCtaHref(details: ErrorDetails | null, fallbackHref: string) {
  const candidate = typeof details?.ctaHref === "string" ? details.ctaHref.trim() : "";
  if (candidate.length > 0) return candidate;
  return fallbackHref;
}

export function mapPaymentGateUiState(input: {
  organizationId?: number | null;
  errorCode: string | null;
  message: string;
  details?: ErrorDetails | null;
}): PaymentGateUiState {
  const organizationId = parseOrganizationId(input.organizationId ?? null);
  const details = input.details ?? null;
  const fallbackPaymentsHref = resolveDefaultPaymentsHref(organizationId);
  const fallbackOfficialEmailHref = resolveDefaultOfficialEmailHref(organizationId);
  const errorCode = input.errorCode?.trim().toUpperCase() ?? null;

  if (errorCode === "PAYMENTS_NOT_READY") {
    const missingEmail = toBoolean(details?.missingEmail);
    const missingStripe = toBoolean(details?.missingStripe);
    let message = "Pagamentos ainda não configurados para preços pagos.";
    if (missingEmail && missingStripe) {
      message = "Confirma o email oficial e liga Stripe Connect para usar preços pagos.";
    } else if (missingEmail) {
      message = "Confirma o email oficial da organização para usar preços pagos.";
    } else if (missingStripe) {
      message = "Liga Stripe Connect para usar preços pagos.";
    }
    return {
      message,
      ctaHref: resolveCtaHref(details, fallbackPaymentsHref),
      ctaLabel: "Configurar pagamentos",
    };
  }

  if (errorCode === "STRIPE_REQUIRED") {
    return {
      message: "Liga Stripe Connect para usar preços pagos.",
      ctaHref: fallbackPaymentsHref,
      ctaLabel: "Configurar pagamentos",
    };
  }

  if (errorCode === "OFFICIAL_EMAIL_REQUIRED") {
    return {
      message: "Define o email oficial da organização antes de continuar.",
      ctaHref: fallbackOfficialEmailHref,
      ctaLabel: "Configurar email oficial",
    };
  }

  if (errorCode === "OFFICIAL_EMAIL_NOT_VERIFIED") {
    return {
      message: "Confirma o email oficial da organização antes de continuar.",
      ctaHref: fallbackOfficialEmailHref,
      ctaLabel: "Verificar email oficial",
    };
  }

  return {
    message: input.message,
    ctaHref: null,
    ctaLabel: null,
  };
}
