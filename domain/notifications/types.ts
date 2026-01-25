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
  | "CHAMPION";

export type NotificationPayload = Record<string, unknown>;

export type DedupeKey = string;

export type CreateNotificationInput = {
  userId: string;
  type: import("@prisma/client").NotificationType;
  title?: string | null;
  body?: string | null;
  payload?: Record<string, unknown> | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  priority?: import("@prisma/client").NotificationPriority;
  senderVisibility?: "PUBLIC" | "PRIVATE";
  fromUserId?: string | null;
  organizationId?: number | null;
  eventId?: number | null;
  ticketId?: string | null;
  inviteId?: string | null;
};
