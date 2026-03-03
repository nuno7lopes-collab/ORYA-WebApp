export const CRM_PADEL_INTERACTION_TYPE_VALUES = [
  "PADEL_BOOKING_CONFIRMED",
  "PADEL_BOOKING_CANCELLED",
  "PADEL_BOOKING_NO_SHOW",
  "PADEL_MATCH_PAYMENT",
  "PADEL_MATCH_PLAYED",
  "PADEL_MATCH_WIN",
  "PADEL_MATCH_LOSS",
  "PADEL_CLASS_ATTENDED",
  "PADEL_CLASS_MISSED",
  "PADEL_TOURNAMENT_ENTRY",
  "PADEL_TOURNAMENT_REGISTERED",
  "PADEL_TOURNAMENT_PLAYED",
  "PADEL_TOURNAMENT_PODIUM",
] as const;

export type CrmPadelInteractionTypeValue =
  (typeof CRM_PADEL_INTERACTION_TYPE_VALUES)[number];

export const CRM_PADEL_JOURNEY_TRIGGER_VALUES = [
  "PADEL_BOOKING_CONFIRMED",
  "PADEL_BOOKING_CANCELLED",
  "PADEL_BOOKING_NO_SHOW",
  "PADEL_MATCH_PLAYED",
  "PADEL_MATCH_WIN",
  "PADEL_MATCH_LOSS",
  "PADEL_CLASS_ATTENDED",
  "PADEL_CLASS_MISSED",
  "PADEL_TOURNAMENT_ENTRY",
  "PADEL_TOURNAMENT_REGISTERED",
  "PADEL_TOURNAMENT_PLAYED",
  "PADEL_TOURNAMENT_PODIUM",
] as const;

export type CrmPadelJourneyTriggerValue =
  (typeof CRM_PADEL_JOURNEY_TRIGGER_VALUES)[number];

const PADEL_INTERACTION_TYPE_SET = new Set<string>(
  CRM_PADEL_INTERACTION_TYPE_VALUES,
);
const PADEL_JOURNEY_TRIGGER_SET = new Set<string>(CRM_PADEL_JOURNEY_TRIGGER_VALUES);

export function isCrmPadelInteractionTypeToken(value: unknown): value is CrmPadelInteractionTypeValue {
  if (typeof value !== "string") return false;
  return PADEL_INTERACTION_TYPE_SET.has(value.trim().toUpperCase());
}

export function isCrmPadelJourneyTriggerToken(value: unknown): value is CrmPadelJourneyTriggerValue {
  if (typeof value !== "string") return false;
  return PADEL_JOURNEY_TRIGGER_SET.has(value.trim().toUpperCase());
}
