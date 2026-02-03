export type SocialSuggestion = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  city: string | null;
  mutualsCount?: number;
  isFollowing?: boolean;
};

export type FollowStatus = "FOLLOWING" | "REQUESTED" | "NONE";
