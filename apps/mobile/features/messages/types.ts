export type InboxItem = {
  id: string;
  kind: "EVENT" | "CONVERSATION";
  threadId?: string;
  conversationId?: string;
  contextType?: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  lastMessageAt?: string | null;
  lastMessage?: { id: string; body: string | null; createdAt: string } | null;
  unreadCount?: number;
  status?: string | null;
  event?: {
    id: number;
    slug: string | null;
    startsAt: string | null;
    endsAt: string | null;
  } | null;
  mutedUntil?: string | null;
};

export type InboxResponse = {
  items: InboxItem[];
};

export type MessageInviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export type MessageInvite = {
  id: string;
  threadId: string;
  conversationId?: string | null;
  status: MessageInviteStatus;
  expiresAt: string;
  event: {
    id: number;
    slug: string | null;
    title: string;
    startsAt: string | null;
    endsAt: string | null;
    coverImageUrl: string | null;
    addressId: string | null;
    locationFormattedAddress: string | null;
    status: string | null;
  };
};

export type MessageInvitesResponse = {
  items: MessageInvite[];
};

export type MessageInviteAcceptResponse = {
  invite: Pick<MessageInvite, "id" | "threadId" | "status" | "expiresAt">;
  threadId: string;
  conversationId?: string | null;
};

export type MessageRequest = {
  id: string;
  status: string;
  contextType: string;
  contextId?: string | null;
  createdAt: string;
  requester: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  };
};

export type MessageRequestsResponse = {
  items: MessageRequest[];
};

export type MessageRequestResponse = {
  ok: boolean;
  request?: { id: string; status: string; createdAt: string };
  conversationId?: string;
};

export type ConversationMember = {
  userId: string;
  displayAs?: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type ConversationMessage = {
  id: string;
  body: string | null;
  createdAt: string;
  deletedAt?: string | null;
  sender: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
};

export type ConversationMessagesResponse = {
  conversation: {
    id: string;
    type: string;
    title: string | null;
    contextType: string;
    contextId: string | null;
    organizationId: number | null;
    customerId: string | null;
    professionalId: string | null;
  };
  members: ConversationMember[];
  items: ConversationMessage[];
  nextCursor?: string | null;
  latestCursor?: string | null;
  canPost?: boolean;
  readOnlyReason?: string | null;
};

export type ConversationMessageSendResponse = {
  item: ConversationMessage;
};

export type ConversationReadResponse = {
  ok: boolean;
  lastReadMessageId: string | null;
};

export type ConversationNotificationResponse = {
  ok: boolean;
  notifLevel: string;
  mutedUntil: string | null;
};
