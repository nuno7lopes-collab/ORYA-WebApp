export type NotificationTemplate =
  | "PAIRING_INVITE"
  | "PAIRING_REMINDER"
  | "PARTNER_PAID"
  | "DEADLINE_EXPIRED"
  | "OFFSESSION_ACTION_REQUIRED"
  | "NEW_FOLLOWER"
  | "PAIRING_REQUEST_RECEIVED"
  | "PAIRING_REQUEST_ACCEPTED"
  | "TICKET_WAITING_CLAIM"
  | "BRACKET_PUBLISHED"
  | "TOURNAMENT_EVE_REMINDER"
  | "MATCH_RESULT"
  | "NEXT_OPPONENT"
  | "MATCH_CHANGED"
  | "ELIMINATED"
  | "CHAMPION"
  | "BROADCAST";

export type NotificationPayload = Record<string, unknown>;

export type DedupeKey = string;
