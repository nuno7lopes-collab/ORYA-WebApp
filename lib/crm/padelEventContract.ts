import type {
  CrmInteractionSource,
  CrmInteractionType,
} from "@prisma/client";

export type PadelCrmCanonicalType = Extract<
  CrmInteractionType,
  | "PADEL_BOOKING_CONFIRMED"
  | "PADEL_BOOKING_CANCELLED"
  | "PADEL_BOOKING_NO_SHOW"
  | "PADEL_MATCH_PAYMENT"
  | "PADEL_MATCH_PLAYED"
  | "PADEL_MATCH_WIN"
  | "PADEL_MATCH_LOSS"
  | "PADEL_CLASS_ATTENDED"
  | "PADEL_CLASS_MISSED"
  | "PADEL_TOURNAMENT_ENTRY"
  | "PADEL_TOURNAMENT_REGISTERED"
  | "PADEL_TOURNAMENT_PLAYED"
  | "PADEL_TOURNAMENT_PODIUM"
>;

const MATCH_OUTCOME_TYPES = new Set<PadelCrmCanonicalType>([
  "PADEL_MATCH_PLAYED",
  "PADEL_MATCH_WIN",
  "PADEL_MATCH_LOSS",
]);

const REQUIRED_METADATA: Record<PadelCrmCanonicalType, readonly string[]> = {
  PADEL_BOOKING_CONFIRMED: ["bookingId", "serviceId", "timeslot"],
  PADEL_BOOKING_CANCELLED: ["bookingId", "serviceId", "timeslot"],
  PADEL_BOOKING_NO_SHOW: ["bookingId", "serviceId", "timeslot"],
  PADEL_MATCH_PAYMENT: ["eventId"],
  PADEL_MATCH_PLAYED: ["matchId", "eventId", "categoryId", "resultType", "winnerSide", "participantIds"],
  PADEL_MATCH_WIN: ["matchId", "eventId", "categoryId", "resultType", "winnerSide", "participantIds"],
  PADEL_MATCH_LOSS: ["matchId", "eventId", "categoryId", "resultType", "winnerSide", "participantIds"],
  PADEL_CLASS_ATTENDED: ["classSessionId"],
  PADEL_CLASS_MISSED: ["classSessionId"],
  PADEL_TOURNAMENT_ENTRY: ["eventId", "entryId", "pairingId", "phase"],
  PADEL_TOURNAMENT_REGISTERED: ["eventId"],
  PADEL_TOURNAMENT_PLAYED: ["eventId"],
  PADEL_TOURNAMENT_PODIUM: ["eventId"],
};

function normalizeToken(value: string | number | null | undefined) {
  const raw = `${value ?? ""}`.trim().toLowerCase();
  if (!raw) return null;
  return raw.replace(/[^a-z0-9:_-]+/g, "_").replace(/_+/g, "_");
}

export function buildPadelExternalId(
  type: PadelCrmCanonicalType,
  sourceType: CrmInteractionSource,
  sourceId: string | number,
  contactRef?: string | number | null,
  statusVersion?: string | number | null,
) {
  const sourceToken = normalizeToken(sourceId) ?? "unknown";
  const contactToken = normalizeToken(contactRef);
  const statusToken = normalizeToken(statusVersion);
  if (MATCH_OUTCOME_TYPES.has(type) && contactToken) {
    return `padel-match:${sourceToken}:${contactToken}:${type}${statusToken ? `:${statusToken}` : ""}`;
  }
  return `padel:${type}:${sourceType}:${sourceToken}${contactToken ? `:${contactToken}` : ""}`;
}

function isPresentMetadataValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

export function validatePadelInteractionMetadata(
  type: PadelCrmCanonicalType,
  metadata: Record<string, unknown> | null | undefined,
): { ok: boolean; missing: string[] } {
  const rules = REQUIRED_METADATA[type] ?? [];
  const payload = metadata && typeof metadata === "object" ? metadata : {};
  const missing = rules.filter((key) => !isPresentMetadataValue(payload[key]));
  return { ok: missing.length === 0, missing };
}
