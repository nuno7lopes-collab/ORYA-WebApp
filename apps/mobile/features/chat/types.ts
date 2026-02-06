export type ChatStatus = "ANNOUNCEMENTS" | "OPEN" | "READ_ONLY" | "CLOSED";

export type ChatEventSummary = {
  id: number;
  slug: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  coverImageUrl: string | null;
  locationName: string | null;
  locationCity: string | null;
  status?: string | null;
};

export type ChatThread = {
  id: string;
  status: ChatStatus;
  openAt: string;
  readOnlyAt: string;
  closeAt: string;
};

export type ChatThreadDetail = {
  thread: ChatThread;
  canPost: boolean;
  event: ChatEventSummary;
};

export type ChatMessageSender = {
  id: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type ChatMessage = {
  id: string;
  body: string;
  kind: "USER" | "ANNOUNCEMENT" | "SYSTEM";
  createdAt: string;
  sender: ChatMessageSender | null;
};

export type ChatThreadListItem = {
  threadId: string;
  status: ChatStatus;
  event: ChatEventSummary;
  lastMessage: ChatMessage | null;
};

export type ChatThreadsResponse = {
  items: ChatThreadListItem[];
};

export type ChatMessagesResponse = {
  thread: ChatThread;
  items: ChatMessage[];
  nextCursor?: string | null;
  latestCursor?: string | null;
};
