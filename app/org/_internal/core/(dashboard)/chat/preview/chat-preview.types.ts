export type ConversationPreview = {
  id: string;
  name: string;
  snippet: string;
  time: string;
  unread: number;
  isActive?: boolean;
  isPinned?: boolean;
  isGroup?: boolean;
  hasMention?: boolean;
  memberCount?: number;
  onlineCount?: number;
  presenceLabel?: string;
  hasPinned?: boolean;
  notifLevel?: "ALL" | "MENTIONS_ONLY" | "OFF";
  mutedUntil?: string | null;
};

export type AttachmentPreview = {
  id: string;
  kind: "file" | "image" | "link";
  title: string;
  meta?: string;
  url?: string;
  urlLabel?: string;
};

export type ReplyPreview = {
  id: string;
  author: string;
  text: string;
};

export type MessagePreview = {
  id: string;
  author: string;
  authorId?: string;
  isSelf: boolean;
  text: string;
  time: string;
  createdAt?: string;
  kind?: "TEXT" | "SYSTEM";
  status?: "sending" | "sent" | "delivered" | "read" | "failed";
  reactions?: ReactionPreview[];
  attachments?: AttachmentPreview[];
  replyTo?: ReplyPreview;
  edited?: boolean;
  error?: string;
};

export type ReactionPreview = {
  label: string;
  count: number;
  active?: boolean;
};

export type ComposerAttachment = AttachmentPreview & {
  file?: File;
};

export type MessageAction = {
  messageId: string;
  type: "reactions" | "menu";
  placement: "top" | "bottom";
};

export type ChatFilterId = "all" | "unread" | "mentions" | "groups";

export type SkeletonRow = {
  id: string;
  align: "left" | "right";
  widthClass: string;
};

export type Reaction = {
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user?: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
};

export type Pin = {
  id: string;
  messageId: string;
  pinnedBy: string;
  pinnedAt: string;
};

export type ConversationMember = {
  userId: string;
  role: "MEMBER" | "ADMIN";
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  lastSeenAt: string | null;
};

export type ConversationItem = {
  id: string;
  type: "DIRECT" | "GROUP" | "CHANNEL";
  title: string | null;
  lastMessageAt: string | null;
  lastMessage: {
    id: string;
    body: string | null;
    createdAt: string;
    senderId: string | null;
  } | null;
  unreadCount: number;
  members: ConversationMember[];
  viewerLastReadMessageId: string | null;
  mutedUntil?: string | null;
  notifLevel?: "ALL" | "MENTIONS_ONLY" | "OFF";
};

export type MemberReadState = {
  userId: string;
  role: "MEMBER" | "ADMIN";
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  mutedUntil: string | null;
  notifLevel?: "ALL" | "MENTIONS_ONLY" | "OFF";
  profile: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
    lastSeenAt: string | null;
  };
};

export type Attachment = {
  id: string;
  type: "IMAGE" | "VIDEO" | "FILE";
  url: string;
  mime: string;
  size: number;
  metadata?: Record<string, unknown> | null;
};

export type Message = {
  id: string;
  conversationId: string;
  body: string | null;
  kind?: "TEXT" | "SYSTEM";
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  sender: {
    id: string;
    fullName: string | null;
    username: string | null;
    avatarUrl: string | null;
  } | null;
  attachments: Attachment[];
  replyTo?: {
    id: string;
    body: string | null;
    senderId: string | null;
    createdAt: string;
  } | null;
  reactions?: Reaction[];
  pins?: Pin[];
};

export type MessagesResponse = {
  ok: boolean;
  conversation: { id: string; type: "DIRECT" | "GROUP" | "CHANNEL"; title: string | null };
  members: MemberReadState[];
  items: Message[];
  nextCursor: string | null;
  error?: string;
};

export type ConversationsResponse = {
  ok: boolean;
  items: ConversationItem[];
  error?: string;
};

export type OrganizationMemberDirectoryItem = {
  userId: string;
  role: string | null;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type OrganizationMembersResponse = {
  ok: boolean;
  items: OrganizationMemberDirectoryItem[];
  organizationId?: number | null;
  error?: string;
};

export type ChatEvent =
  | {
      type: "message:new";
      conversationId: string;
      message: Message;
    }
  | {
      type: "message:update";
      conversationId: string;
      message: Message;
    }
  | {
      type: "message:delete";
      conversationId: string;
      messageId: string;
      deletedAt: string;
      lastMessage?: {
        id: string;
        body: string | null;
        createdAt: string;
        senderId: string | null;
      } | null;
    }
  | {
      type: "reaction:update";
      conversationId: string;
      messageId: string;
      reactions: Reaction[];
    }
  | {
      type: "pin:update";
      conversationId: string;
      messageId: string;
      pins: Pin[];
    }
  | {
      type: "message:read";
      conversationId: string;
      userId: string;
      lastReadMessageId: string;
    }
  | {
      type: "typing:start" | "typing:stop";
      conversationId: string;
      userId: string;
    }
  | {
      type: "presence:update";
      userId: string;
      status: "online" | "offline";
      lastSeenAt?: string;
    }
  | {
      type: "conversation:update";
      conversationId: string;
    };
