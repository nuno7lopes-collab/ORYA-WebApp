export type BasicProfile = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  visibility?: string | null;
  isDeleted?: boolean | null;
};

/**
 * Normaliza visibilidade de perfis, ocultando dados de contas apagadas ou privadas.
 */
export function sanitizeProfileVisibility(profile: BasicProfile | null | undefined, viewerId?: string | null) {
  if (!profile) return null;
  if (profile.isDeleted) {
    return {
      id: profile.id,
      username: null,
      fullName: "Conta apagada",
      avatarUrl: null,
      visibility: "PRIVATE",
      isDeleted: true,
    };
  }

  const isSelf = viewerId && profile.id === viewerId;
  const isPrivate = profile.visibility === "PRIVATE";

  return {
    id: profile.id,
    username: profile.username,
    fullName: isPrivate && !isSelf ? null : profile.fullName,
    avatarUrl: isPrivate && !isSelf ? null : profile.avatarUrl,
    visibility: profile.visibility ?? null,
    isDeleted: !!profile.isDeleted,
  };
}

