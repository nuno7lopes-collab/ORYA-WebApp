import { SourceType } from "@prisma/client";

export type SourceRef = {
  sourceType: SourceType;
  sourceId: string;
};

const FINANCE_SOURCE_TYPES = [
  SourceType.TICKET_ORDER,
  SourceType.BOOKING,
  SourceType.PADEL_REGISTRATION,
  SourceType.STORE_ORDER,
  SourceType.SUBSCRIPTION,
  SourceType.MEMBERSHIP,
] as const;

const AGENDA_SOURCE_TYPES = [
  SourceType.EVENT,
  SourceType.TOURNAMENT,
  SourceType.MATCH,
  SourceType.CLASS_SESSION,
  SourceType.SOFT_BLOCK,
  SourceType.HARD_BLOCK,
] as const;

export type FinanceSourceType = (typeof FINANCE_SOURCE_TYPES)[number];
export type AgendaSourceType = (typeof AGENDA_SOURCE_TYPES)[number];

export const FINANCE_SOURCE_TYPE_ALLOWLIST = new Set<SourceType>(FINANCE_SOURCE_TYPES);
export const AGENDA_SOURCE_TYPE_ALLOWLIST = new Set<SourceType>(AGENDA_SOURCE_TYPES);

const AUX_SOURCE_TYPE_ALLOWLIST = new Set<SourceType>([
  SourceType.LOYALTY_TX,
]);

const LEGACY_SOURCE_TYPE_MAP: Record<string, SourceType> = {
  EVENT_TICKET: SourceType.TICKET_ORDER,
  SERVICE_BOOKING: SourceType.BOOKING,
  SERVICE_CREDITS: SourceType.STORE_ORDER,
  PADEL_PAIRING: SourceType.PADEL_REGISTRATION,
  RESERVATION: SourceType.BOOKING,
};

export function normalizeFinanceSourceType(value?: string | null): SourceType | null {
  if (!value) return null;
  const raw = String(value).trim().toUpperCase();
  const mapped = LEGACY_SOURCE_TYPE_MAP[raw] ?? (raw as SourceType);
  if (!FINANCE_SOURCE_TYPE_ALLOWLIST.has(mapped)) return null;
  return mapped;
}

export function normalizeAgendaSourceType(value?: string | null): SourceType | null {
  if (!value) return null;
  const raw = String(value).trim().toUpperCase();
  const mapped = raw as SourceType;
  if (!AGENDA_SOURCE_TYPE_ALLOWLIST.has(mapped)) return null;
  return mapped;
}

export function normalizeAnySourceType(value?: string | null): SourceType | null {
  return (
    normalizeFinanceSourceType(value) ??
    normalizeAgendaSourceType(value) ??
    (AUX_SOURCE_TYPE_ALLOWLIST.has(String(value ?? "").trim().toUpperCase() as SourceType)
      ? (String(value ?? "").trim().toUpperCase() as SourceType)
      : null)
  );
}

export function normalizeSourceType(value?: string | null): SourceType | null {
  return normalizeFinanceSourceType(value);
}

export function assertSourceRef(input: {
  sourceType?: SourceType | string | null;
  sourceId?: string | null;
}): SourceRef {
  const sourceType = normalizeFinanceSourceType(input.sourceType ?? null);
  const sourceId = input.sourceId?.trim();
  if (!sourceType) {
    throw new Error("SOURCE_TYPE_INVALID");
  }
  if (!sourceId) {
    throw new Error("SOURCE_ID_INVALID");
  }
  return { sourceType, sourceId };
}

export function normalizeSourceRef(input: {
  sourceType?: SourceType | string | null;
  sourceId?: string | null;
}): SourceRef | null {
  const sourceType = normalizeFinanceSourceType(input.sourceType ?? null);
  const sourceId = input.sourceId?.trim() ?? null;
  if (!sourceType || !sourceId) return null;
  return { sourceType, sourceId };
}
