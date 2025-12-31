export type BasicProfile = {
  id: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  visibility?: string | null;
  isDeleted?: boolean | null;
};

/**
 * Normaliza visibilidade de perfis, ocultando dados apenas de contas apagadas.
 * Nome/username/avatar ficam sempre públicos.
 */
export function sanitizeProfileVisibility(profile: BasicProfile | null | undefined) {
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

  return {
    id: profile.id,
    username: profile.username,
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl,
    visibility: profile.visibility ?? null,
    isDeleted: !!profile.isDeleted,
  };
}
