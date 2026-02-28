import crypto from "crypto";
import { SourceType } from "@prisma/client";
import { checkoutKey } from "@/lib/stripe/idempotency";
import type { PaymentSubject } from "@/lib/payments/types";

type LegacyPaymentSubjectIdempotencyInput = {
  subject: PaymentSubject;
  purchaseId: string;
};

export type PaymentSubjectIdempotencyInput = {
  orgId: number;
  subjectType: string;
  subjectId: string;
  amount?: number;
  currency?: string;
  version?: string;
  extra?: Record<string, unknown>;
};

export type BuildPaymentSubjectIdempotencyInput =
  | PaymentSubjectIdempotencyInput
  | LegacyPaymentSubjectIdempotencyInput;

const LEGACY_SUBJECT_TO_SOURCE_TYPE: Record<PaymentSubject, SourceType> = {
  BOOKING: SourceType.BOOKING,
  EVENT_TICKET: SourceType.TICKET_ORDER,
  STORE_ORDER: SourceType.STORE_ORDER,
  PADEL_REGISTRATION: SourceType.PADEL_REGISTRATION,
};

function normalizeString(value: string | number | null | undefined) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

function normalizeSubjectType(value: string) {
  return value.trim().toUpperCase();
}

function stableNormalize(value: unknown): unknown {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => stableNormalize(entry));
    return normalized.sort((left, right) =>
      stableStringify(left).localeCompare(stableStringify(right)),
    );
  }
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      result[key] = stableNormalize(source[key]);
    }
    return result;
  }
  return value;
}

function stableStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
    .join(",")}}`;
}

function buildLegacyPaymentSubjectIdempotencyKey(
  input: LegacyPaymentSubjectIdempotencyInput,
) {
  const purchaseId = normalizeString(input.purchaseId);
  if (!purchaseId) {
    throw new Error("PURCHASE_ID_REQUIRED");
  }
  const sourceType = LEGACY_SUBJECT_TO_SOURCE_TYPE[input.subject];
  return checkoutKey(`${sourceType}:${purchaseId}`);
}

export function buildPaymentSubjectIdempotencyKey(
  input: BuildPaymentSubjectIdempotencyInput,
) {
  if ("purchaseId" in input) {
    return buildLegacyPaymentSubjectIdempotencyKey(input);
  }

  const orgId = Number(input.orgId);
  if (!Number.isInteger(orgId) || orgId <= 0) {
    throw new Error("ORG_ID_REQUIRED");
  }
  const subjectType = normalizeSubjectType(input.subjectType);
  if (!subjectType) {
    throw new Error("SUBJECT_TYPE_REQUIRED");
  }
  const subjectId = normalizeString(input.subjectId);
  if (!subjectId) {
    throw new Error("SUBJECT_ID_REQUIRED");
  }

  const canonical: Record<string, unknown> = {
    version: normalizeString(input.version) || "v1",
    orgId,
    subjectType,
    subjectId,
  };
  if (typeof input.amount === "number" && Number.isFinite(input.amount)) {
    canonical.amount = input.amount;
  }
  if (typeof input.currency === "string" && input.currency.trim()) {
    canonical.currency = input.currency.trim().toUpperCase();
  }
  if (input.extra && typeof input.extra === "object") {
    canonical.extra = stableNormalize(input.extra);
  }

  const digest = crypto
    .createHash("sha256")
    .update(stableStringify(canonical))
    .digest("hex");
  return checkoutKey(`pk:${subjectType}:${subjectId}:${digest}`);
}
