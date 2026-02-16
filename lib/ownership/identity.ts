import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/utils/email";
import type { Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

type IdentityResult = {
  id: string | null;
  emailNormalized: string | null;
  userId: string | null;
  emailVerifiedAt?: Date | null;
};

function getClient(tx?: DbClient) {
  return (tx ?? prisma) as any;
}

async function resolveIdentityIdByTombstone(identityId: string, tx?: DbClient): Promise<string> {
  const client = getClient(tx);
  if (!client.identityTombstone || typeof client.identityTombstone.findUnique !== "function") {
    return identityId;
  }

  let current = identityId;
  const seen = new Set<string>();
  for (let depth = 0; depth < 8; depth += 1) {
    if (seen.has(current)) return current;
    seen.add(current);

    const tombstone = await client.identityTombstone.findUnique({
      where: { fromIdentityId: current },
      select: { toIdentityId: true },
    });
    if (!tombstone?.toIdentityId || tombstone.toIdentityId === current) return current;
    current = tombstone.toIdentityId;
  }
  return current;
}

async function findIdentityById(identityId: string, tx?: DbClient) {
  const client = getClient(tx);
  if (!client.emailIdentity || typeof client.emailIdentity.findUnique !== "function") return null;
  return client.emailIdentity.findUnique({
    where: { id: identityId },
    select: { id: true, emailNormalized: true, userId: true, emailVerifiedAt: true },
  });
}

export async function resolveIdentityForRead(identityId: string, tx?: DbClient): Promise<IdentityResult> {
  const resolvedId = await resolveIdentityIdByTombstone(identityId, tx);
  const identity = await findIdentityById(resolvedId, tx);
  return {
    id: identity?.id ?? null,
    emailNormalized: identity?.emailNormalized ?? null,
    userId: identity?.userId ?? null,
    emailVerifiedAt: identity?.emailVerifiedAt ?? null,
  };
}

async function fetchUserEmailNormalized(userId: string, tx?: DbClient): Promise<string | null> {
  const client = getClient(tx);
  if (!client.users || typeof client.users.findUnique !== "function") return null;
  const authUser = await client.users.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return normalizeEmail(authUser?.email ?? null);
}

export async function ensureEmailIdentity(params: {
  email: string | null | undefined;
  userId?: string | null;
  tx?: DbClient;
}): Promise<IdentityResult> {
  const emailNormalized = normalizeEmail(params.email ?? null);
  if (!emailNormalized) {
    return { id: null, emailNormalized: null, userId: params.userId ?? null, emailVerifiedAt: null };
  }

  const client = getClient(params.tx);
  if (!client.emailIdentity || typeof client.emailIdentity.findUnique !== "function") {
    return { id: null, emailNormalized, userId: params.userId ?? null, emailVerifiedAt: null };
  }

  let identity = await client.emailIdentity.findUnique({
    where: { emailNormalized },
    select: { id: true, emailNormalized: true, userId: true, emailVerifiedAt: true },
  });

  if (!identity) {
    try {
      identity = await client.emailIdentity.create({
        data: {
          emailNormalized,
          ...(params.userId ? { userId: params.userId } : {}),
        },
        select: { id: true, emailNormalized: true, userId: true, emailVerifiedAt: true },
      });
    } catch {
      identity = await client.emailIdentity.findUnique({
        where: { emailNormalized },
        select: { id: true, emailNormalized: true, userId: true, emailVerifiedAt: true },
      });
    }
  } else if (params.userId && !identity.userId) {
    await client.emailIdentity.update({
      where: { emailNormalized },
      data: { userId: params.userId },
    });
    identity = { ...identity, userId: params.userId };
  }

  const resolvedId = identity?.id
    ? await resolveIdentityIdByTombstone(identity.id, params.tx)
    : null;
  if (resolvedId && identity?.id && resolvedId !== identity.id) {
    const resolvedIdentity = await findIdentityById(resolvedId, params.tx);
    if (resolvedIdentity) {
      identity = {
        id: resolvedIdentity.id,
        userId: resolvedIdentity.userId,
        emailVerifiedAt: resolvedIdentity.emailVerifiedAt,
      };
    }
  }

  if (params.userId && identity?.id && !identity.userId) {
    await client.emailIdentity.update({
      where: { id: identity.id },
      data: { userId: params.userId },
    });
    identity = { ...identity, userId: params.userId };
  }

  return {
    id: identity?.id ?? null,
    emailNormalized: (identity as { emailNormalized?: string | null } | null)?.emailNormalized ?? emailNormalized,
    userId: identity?.userId ?? params.userId ?? null,
    emailVerifiedAt: identity?.emailVerifiedAt ?? null,
  };
}

export async function resolveIdentityForUser(params: {
  userId: string;
  email?: string | null;
  tx?: DbClient;
}): Promise<IdentityResult> {
  const emailNormalized =
    normalizeEmail(params.email ?? null) ?? (await fetchUserEmailNormalized(params.userId, params.tx));
  if (!emailNormalized) {
    return { id: null, emailNormalized: null, userId: params.userId, emailVerifiedAt: null };
  }
  return ensureEmailIdentity({ email: emailNormalized, userId: params.userId, tx: params.tx });
}

export async function getUserIdentityIds(userId: string, tx?: DbClient): Promise<string[]> {
  const client = getClient(tx);
  if (!client.emailIdentity || typeof client.emailIdentity.findMany !== "function") return [];

  const identities = await client.emailIdentity.findMany({
    where: { userId },
    select: { id: true },
  });
  if (identities.length) {
    const resolved = await Promise.all(
      identities.map((identity: { id: string }) => resolveIdentityIdByTombstone(identity.id, tx)),
    );
    return Array.from(new Set(resolved));
  }

  const resolved = await resolveIdentityForUser({ userId, tx });
  return resolved.id ? [resolved.id] : [];
}
