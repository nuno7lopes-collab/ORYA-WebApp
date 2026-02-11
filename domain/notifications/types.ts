export type NotificationTemplate =
  | "PAIRING_INVITE"
  | "PAIRING_REMINDER"
  | "PARTNER_PAID"
  | "PAIRING_WINDOW_OPEN"
  | "PAIRING_CONFIRMED"
  | "PAIRING_REFUND"
  | "DEADLINE_EXPIRED"
  | "OFFSESSION_ACTION_REQUIRED"
  | "WAITLIST_JOINED"
  | "WAITLIST_PROMOTED"
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

export type NotificationPayload = import("@prisma/client").Prisma.InputJsonValue;

export type DedupeKey = string;

export type CreateNotificationInput = {
  userId: string;
  type: import("@prisma/client").NotificationType;
  dedupeKey?: string | null;
  title?: string | null;
  body?: string | null;
  payload?: NotificationPayload | null;
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
