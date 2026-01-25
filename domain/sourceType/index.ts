import { SourceType } from "@prisma/client";

export type SourceRef = {
  sourceType: SourceType;
  sourceId: string;
};

export const SOURCE_TYPE_ALLOWLIST = new Set<SourceType>([
  SourceType.TICKET_ORDER,
  SourceType.BOOKING,
  SourceType.PADEL_REGISTRATION,
  SourceType.STORE_ORDER,
  SourceType.SUBSCRIPTION,
  SourceType.MEMBERSHIP,
  SourceType.EVENT,
  SourceType.TOURNAMENT,
  SourceType.MATCH,
  SourceType.LOYALTY_TX,
]);

const LEGACY_SOURCE_TYPE_MAP: Record<string, SourceType> = {
  EVENT_TICKET: SourceType.TICKET_ORDER,
  SERVICE_BOOKING: SourceType.BOOKING,
  SERVICE_CREDITS: SourceType.STORE_ORDER,
  PADEL_PAIRING: SourceType.PADEL_REGISTRATION,
  RESERVATION: SourceType.BOOKING,
};

export function normalizeSourceType(value?: string | null): SourceType | null {
  if (!value) return null;
  const raw = String(value).trim().toUpperCase();
  const mapped = LEGACY_SOURCE_TYPE_MAP[raw] ?? (raw as SourceType);
  if (!SOURCE_TYPE_ALLOWLIST.has(mapped)) return null;
  return mapped;
}

export function assertSourceRef(input: {
  sourceType?: SourceType | string | null;
  sourceId?: string | null;
}): SourceRef {
  const sourceType = normalizeSourceType(input.sourceType ?? null);
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
  const sourceType = normalizeSourceType(input.sourceType ?? null);
  const sourceId = input.sourceId?.trim() ?? null;
  if (!sourceType || !sourceId) return null;
  return { sourceType, sourceId };
}
