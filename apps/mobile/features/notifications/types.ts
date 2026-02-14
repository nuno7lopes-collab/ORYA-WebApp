export type NotificationCategory = "network" | "events" | "system" | "marketing";

export type NotificationActor = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  username?: string | null;
};

export type NotificationAction = {
  type: string;
  label: string;
  style?: "primary" | "secondary" | string;
  payload?: Record<string, unknown>;
};

export type AggregatedNotificationItem = {
  id: string;
  type: string;
  category: NotificationCategory;
  createdAt: string;
  isRead: boolean;
  title: string;
  body?: string | null;
  actors: NotificationActor[];
  actorCount: number;
  thumbnailUrl?: string | null;
  ctaUrl?: string | null;
  ctaLabel?: string | null;
  actions?: NotificationAction[];
  organizationId?: number | null;
  eventId?: number | null;
  payloadKind?: string | null;
};

export type NotificationsPage = {
  items: AggregatedNotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
};

export type OrganizationInvite = {
  id: string;
  inviteType?: "ORGANIZATION_MEMBER" | "CLUB_STAFF" | "TEAM_MEMBER";
  organizationId: number;
  role: string;
  status: "PENDING" | "EXPIRED" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  canRespond?: boolean;
  expiresAt?: string | null;
  invitedBy?: {
    id: string;
    fullName?: string | null;
    username?: string | null;
    avatarUrl?: string | null;
  } | null;
  organization?: {
    id: number;
    publicName?: string | null;
    businessName?: string | null;
    username?: string | null;
    brandingAvatarUrl?: string | null;
    brandingCoverUrl?: string | null;
  } | null;
  padelClubId?: number | null;
  padelClub?: {
    id: number;
    name?: string | null;
  } | null;
  teamId?: number | null;
  team?: {
    id: number;
    name?: string | null;
  } | null;
};
