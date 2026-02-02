export type SearchUser = {
  id: string;
  username?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  isFollowing?: boolean;
  isRequested?: boolean;
};

export type SearchOrganization = {
  id: number;
  username?: string | null;
  publicName?: string | null;
  businessName?: string | null;
  brandingAvatarUrl?: string | null;
  primaryModule?: string | null;
  city?: string | null;
  isFollowing?: boolean;
};
