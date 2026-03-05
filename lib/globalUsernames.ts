import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sanitizeUsername, validateUsername, type UsernameValidationOptions } from "@/lib/username";
import { isReservedAllowlistEntry } from "@/lib/reservedUsernames";

type Tx = Prisma.TransactionClient | PrismaClient;
export type UsernameOwnerType = "user" | "organization";
type UsernameOwnerIdentity = { ownerType: UsernameOwnerType; ownerId: string | number };
type CheckUsernameAvailabilityOptions = UsernameValidationOptions & {
  ignoreOwner?: UsernameOwnerIdentity;
};

const USER_OWNER_TYPE_ALIASES = ["user", "USER"] as const;
const ORGANIZATION_OWNER_TYPE_ALIASES = ["organization", "ORG"] as const;

export function canonicalizeUsernameOwnerType(raw: string | null | undefined): UsernameOwnerType | null {
  if (!raw) return null;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "user") return "user";
  if (normalized === "organization" || normalized === "org") return "organization";
  return null;
}

function ownerTypeAliases(ownerType: UsernameOwnerType) {
  return ownerType === "organization" ? [...ORGANIZATION_OWNER_TYPE_ALIASES] : [...USER_OWNER_TYPE_ALIASES];
}

export class UsernameTakenError extends Error {
  code = "USERNAME_TAKEN";
  constructor(username: string) {
    super(`Username ${username} já está a ser usado`);
  }
}

export function normalizeAndValidateUsername(raw: string, options?: UsernameValidationOptions) {
  const result = validateUsername(raw, options);
  if (!result.valid) {
    return {
      ok: false as const,
      error: result.error,
      code: result.code ?? "USERNAME_INVALID",
      username: result.normalized ?? sanitizeUsername(raw),
    };
  }
  return { ok: true as const, username: result.normalized };
}

export async function checkUsernameAvailability(
  username: string,
  tx?: Tx,
  options?: CheckUsernameAvailabilityOptions,
) {
  const client = tx ?? prisma;
  const { ignoreOwner, ...validationOptions } = options ?? {};
  const ignoreOwnerId = ignoreOwner ? String(ignoreOwner.ownerId) : null;
  const ignoreOrganizationId =
    ignoreOwner?.ownerType === "organization" ? Number(ignoreOwner.ownerId) : null;

  const normalizedResult = normalizeAndValidateUsername(username, validationOptions);
  if (!normalizedResult.ok) {
    if (normalizedResult.code === "USERNAME_RESERVED") {
      if (isReservedAllowlistEntry(normalizedResult.username)) {
        return {
          ok: true as const,
          available: false,
          username: normalizedResult.username,
        };
      }
      return {
        ok: true as const,
        available: false,
        reason: "reserved" as const,
        username: normalizedResult.username,
      };
    }
    return normalizedResult;
  }

  const normalized = normalizedResult.username;

  const checkLocalAvailability = async (client: Tx) => {
    const [profile, organization] = await Promise.all([
      client.profile.findFirst({
        where: {
          username: { equals: normalized, mode: "insensitive" },
          ...(ignoreOwner?.ownerType === "user" && ignoreOwnerId ? { NOT: { id: ignoreOwnerId } } : {}),
        },
        select: { id: true },
      }),
      client.organization.findFirst({
        where: {
          username: { equals: normalized, mode: "insensitive" },
          ...(ignoreOwner?.ownerType === "organization" &&
          ignoreOrganizationId !== null &&
          Number.isFinite(ignoreOrganizationId)
            ? { NOT: { id: ignoreOrganizationId } }
            : {}),
        },
        select: { id: true },
      }),
    ]);
    return !profile && !organization;
  };

  const existing = await client.globalUsername.findUnique({
    where: { username: normalized },
    select: { ownerType: true, ownerId: true },
  });
  const existingOwnerType = canonicalizeUsernameOwnerType(existing?.ownerType);
  const existingBelongsToIgnoredOwner = Boolean(
    existing &&
      ignoreOwner &&
      existingOwnerType === ignoreOwner.ownerType &&
      String(existing.ownerId) === ignoreOwnerId,
  );

  if (existing && !existingBelongsToIgnoredOwner) {
    return { ok: true as const, available: false, username: normalized };
  }
  const available = await checkLocalAvailability(client);
  return { ok: true as const, available, username: normalized };
}

export async function setUsernameForOwner(options: {
  username: string;
  ownerType: UsernameOwnerType;
  ownerId: string | number;
  tx?: Tx;
  allowReservedForEmail?: string | null;
}) {
  const { username: rawUsername, ownerType, ownerId, allowReservedForEmail } = options;
  const providedTx = options.tx;

  const validated = normalizeAndValidateUsername(rawUsername, { allowReservedForEmail });
  if (!validated.ok) {
    return { ok: false as const, error: validated.error };
  }

  const username = validated.username;
  const ownerIdStr = String(ownerId);
  const ownerIdNumber = ownerType === "organization" ? Number(ownerId) : null;

  const run = async (trx: Tx) => {
    const [profile, organization] = await Promise.all([
      trx.profile.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
          ...(ownerType === "user" ? { NOT: { id: ownerIdStr } } : {}),
        },
        select: { id: true },
      }),
      trx.organization.findFirst({
        where: {
          username: { equals: username, mode: "insensitive" },
          ...(ownerType === "organization" && ownerIdNumber && Number.isFinite(ownerIdNumber)
            ? { NOT: { id: ownerIdNumber } }
            : {}),
        },
        select: { id: true },
      }),
    ]);
    if (profile || organization) {
      throw new UsernameTakenError(username);
    }

    const existing = await trx.globalUsername.findUnique({
      where: { username },
      select: { ownerType: true, ownerId: true },
    });

    const existingOwnerType = canonicalizeUsernameOwnerType(existing?.ownerType);
    if (existing && (existingOwnerType !== ownerType || existing.ownerId !== ownerIdStr)) {
      throw new UsernameTakenError(username);
    }

    await trx.globalUsername.deleteMany({
      where: {
        ownerType: { in: ownerTypeAliases(ownerType) },
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
    return run(providedTx);
  }

  return prisma.$transaction(run);
}

/**
 * Remove usernames associados a um owner específico (user ou organization).
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
    where: { ownerType: { in: ownerTypeAliases(ownerType) }, ownerId: String(ownerId) },
  });
  return { ok: true as const };
}
