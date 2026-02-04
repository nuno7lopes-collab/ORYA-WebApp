import { PublicEventCard } from "@orya/shared";

export type SocialFeedItem = {
  id: string;
  kind: "event";
  createdAt: string;
  organization: {
    id: number;
    name: string;
    username: string | null;
    avatarUrl: string | null;
  };
  event: PublicEventCard;
};

export type SocialFeedPage = {
  items: SocialFeedItem[];
  hasMore: boolean;
  nextCursor: string | null;
};
