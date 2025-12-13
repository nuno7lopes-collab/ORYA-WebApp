import { prisma } from "@/lib/prisma";

export type ResolvedUser = {
  userId: string;
  profile: {
    id: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    email: string | null;
  };
};

/**
 * Resolve um identificador fornecido (email, username ou UUID) para um utilizador.
 * Retorna informação básica do profile para evitar round-trips nos handlers.
 */
export async function resolveUserIdentifier(identifier: string): Promise<ResolvedUser | null> {
  const value = identifier.trim();
  if (!value) return null;

  const select = {
    id: true,
    username: true,
    fullName: true,
    avatarUrl: true,
    email: true,
  };

  // Se for UUID válido, tenta match direto
  if (/^[0-9a-fA-F-]{36}$/.test(value)) {
    const byId = await prisma.profile.findUnique({
      where: { id: value },
      select,
    });
    if (byId) {
      return {
        userId: byId.id,
        profile: {
          id: byId.id,
          username: byId.username,
          fullName: byId.fullName,
          avatarUrl: byId.avatarUrl,
          email: byId.email ?? null,
        },
      };
    }
  }

  // Username ou email (case insensitive nas colunas citext; para email usamos lower)
  const lowered = value.toLowerCase();
  const match = await prisma.profile.findFirst({
    where: {
      OR: [
        { username: value },
        { username: lowered },
        { email: value },
        { email: lowered },
      ],
      isDeleted: false,
    },
    select,
  });

  if (!match) return null;

  return {
    userId: match.id,
    profile: {
      id: match.id,
      username: match.username,
      fullName: match.fullName,
      avatarUrl: match.avatarUrl,
      email: match.email ?? null,
    },
  };
}
