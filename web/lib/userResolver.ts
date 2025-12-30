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
          email: null,
        },
      };
    }
  }

  // Username (case insensitive). Para email, procura em auth.users e mapeia para profile.
  const lowered = value.toLowerCase();

  // Tenta por username no profile (citext)
  let match = await prisma.profile.findFirst({
    where: {
      OR: [{ username: value }, { username: lowered }],
      isDeleted: false,
    },
    select,
  });

  let resolvedEmail: string | null = null;
  // Se for email, procurar em auth.users e ligar ao profile
  if (!match && value.includes("@")) {
    const userByEmail = await prisma.users.findFirst({
      where: { email: lowered },
      select: { id: true, email: true },
    });

    if (userByEmail) {
      match = await prisma.profile.findUnique({
        where: { id: userByEmail.id },
        select,
      });
      resolvedEmail = userByEmail.email ?? null;
    }
  }

  if (!match) return null;

  return {
    userId: match.id,
    profile: {
      id: match.id,
      username: match.username,
      fullName: match.fullName,
      avatarUrl: match.avatarUrl,
      email: resolvedEmail ?? (value.includes("@") ? value : null),
    },
  };
}
