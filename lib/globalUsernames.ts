import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateUsername } from "@/lib/username";

type Tx = Prisma.TransactionClient | PrismaClient;
export type UsernameOwnerType = "user" | "organizer";

export class UsernameTakenError extends Error {
  code = "USERNAME_TAKEN";
  constructor(username: string) {
    super(`Username ${username} já está a ser usado`);
  }
}

export function normalizeAndValidateUsername(raw: string) {
  const result = validateUsername(raw);
  if (!result.valid) {
    return { ok: false as const, error: result.error };
  }
  return { ok: true as const, username: result.normalized };
}

export async function checkUsernameAvailability(username: string, tx: Tx = prisma) {
  const normalizedResult = normalizeAndValidateUsername(username);
  if (!normalizedResult.ok) return normalizedResult;

  try {
    const existing = await tx.globalUsername.findUnique({
      where: { username: normalizedResult.username },
      select: { ownerType: true, ownerId: true },
    });
    return { ok: true as const, available: !existing, username: normalizedResult.username };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : "";
    const missingTable = code === "P2021" || code === "P2022" || msg.toLowerCase().includes("does not exist");
    if (missingTable) {
      console.warn("[globalUsernames] table/column missing while checking availability");
      return { ok: true as const, available: true, username: normalizedResult.username };
    }
    throw err;
  }
}

export async function setUsernameForOwner(options: {
  username: string;
  ownerType: UsernameOwnerType;
  ownerId: string | number;
  tx?: Tx;
}) {
  const { username: rawUsername, ownerType, ownerId } = options;
  const providedTx = options.tx;

  const validated = normalizeAndValidateUsername(rawUsername);
  if (!validated.ok) {
    return { ok: false as const, error: validated.error };
  }

  const username = validated.username;
  const ownerIdStr = String(ownerId);

  const run = async (trx: Tx) => {
    const existing = await trx.globalUsername.findUnique({
      where: { username },
      select: { ownerType: true, ownerId: true },
    });

    if (existing && (existing.ownerType !== ownerType || existing.ownerId !== ownerIdStr)) {
      throw new UsernameTakenError(username);
    }

    await trx.globalUsername.deleteMany({
      where: {
        ownerType,
        ownerId: ownerIdStr,
        username: { not: username },
      },
    });

    await trx.globalUsername.upsert({
      where: { username },
      update: { ownerType, ownerId: ownerIdStr, updatedAt: new Date() },
      create: {
        username,
        ownerType,
        ownerId: ownerIdStr,
      },
    });

    return { ok: true as const, username };
  };

  if (providedTx) {
    try {
      return await run(providedTx);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      const msg = err instanceof Error ? err.message : "";
      const missingTable = code === "P2021" || code === "P2022" || msg.toLowerCase().includes("relation") || msg.toLowerCase().includes("does not exist");
      if (missingTable) {
        console.warn("[globalUsernames] table/column missing, skipping username reservation");
        return { ok: false as const, error: "USERNAME_TABLE_MISSING" as const };
      }
      throw err;
    }
  }

  try {
    return await prisma.$transaction(run);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : "";
    const missingTable = code === "P2021" || code === "P2022" || msg.toLowerCase().includes("relation") || msg.toLowerCase().includes("does not exist");
    if (missingTable) {
      console.warn("[globalUsernames] table/column missing, skipping username reservation");
      return { ok: false as const, error: "USERNAME_TABLE_MISSING" as const };
    }
    throw err;
  }
}

/**
 * Remove usernames associados a um owner específico (user ou organizer).
 * Útil em deletes/cleanup de conta/org.
 */
export async function clearUsernameForOwner(options: {
  ownerType: UsernameOwnerType;
  ownerId: string | number;
  tx?: Tx;
}) {
  const { ownerType, ownerId } = options;
  const client = options.tx ?? prisma;
  await client.globalUsername.deleteMany({
    where: { ownerType, ownerId: String(ownerId) },
  });
  return { ok: true as const };
}
