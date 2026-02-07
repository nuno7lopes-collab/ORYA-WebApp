export type NotificationPriority = "LOW" | "NORMAL" | "HIGH";

export type NotificationItem = {
  id: string;
  title?: string | null;
  body?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  type?: string | null;
  isRead?: boolean | null;
  createdAt?: string | null;
  priority?: NotificationPriority | null;
  payload?: Record<string, unknown> | null;
};

export type NotificationsPage = {
  items: NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
};

export type NotificationsStatus = "all" | "unread";
