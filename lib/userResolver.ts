import { prisma } from "@/lib/prisma";
import { normalizeUsernameInput } from "@/lib/username";
import { resolveUsernameOwner } from "@/lib/username/resolveUsernameOwner";

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
  const normalized = value.startsWith("@") ? value.slice(1) : value;
  if (!normalized) return null;

  const select = {
    id: true,
    username: true,
    fullName: true,
    avatarUrl: true,
  };

  // Se for UUID válido, tenta match direto
  if (/^[0-9a-fA-F-]{36}$/.test(normalized)) {
    const byId = await prisma.profile.findUnique({
      where: { id: normalized },
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
  const lowered = normalized.toLowerCase();

  // Se for email, procurar em auth.users e ligar ao profile
  if (normalized.includes("@")) {
    const userByEmail = await prisma.users.findFirst({
      where: { email: lowered },
      select: { id: true, email: true },
    });

    if (userByEmail) {
      const match = await prisma.profile.findUnique({
        where: { id: userByEmail.id },
        select,
      });
      if (!match) return null;
      const resolvedEmail = userByEmail.email ?? null;
      return {
        userId: match.id,
        profile: {
          id: match.id,
          username: match.username,
          fullName: match.fullName,
          avatarUrl: match.avatarUrl,
          email: resolvedEmail ?? null,
        },
      };
    }
    return null;
  }

  const normalizedUsername = normalizeUsernameInput(normalized);
  if (!normalizedUsername) return null;

  const resolved = await resolveUsernameOwner(normalizedUsername, {
    expectedOwnerType: "user",
    includeDeletedUser: false,
    requireActiveOrganization: false,
    backfillGlobalUsername: true,
  });
  if (!resolved || resolved.ownerType !== "user") return null;

  const match = await prisma.profile.findUnique({
    where: { id: resolved.ownerId },
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
      email: null,
    },
  };
}
