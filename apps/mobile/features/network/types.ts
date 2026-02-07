export type SocialSuggestion = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  city: string | null;
  mutualsCount?: number;
  isFollowing?: boolean;
  isRequested?: boolean;
};

export type FollowStatus = "FOLLOWING" | "REQUESTED" | "NONE";

export type FollowListItem = {
  userId: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  kind?: "user" | "organization";
  isMutual?: boolean;
};

export type FollowRequest = {
  id: number;
  requesterId: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};
