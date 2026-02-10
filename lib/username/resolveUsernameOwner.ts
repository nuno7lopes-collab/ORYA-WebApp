import { prisma } from "@/lib/prisma";
import { normalizeUsernameInput } from "@/lib/username";
import { setUsernameForOwner } from "@/lib/globalUsernames";
import { isReservedUsername } from "@/lib/reservedUsernames";

export type ResolvedUsernameOwner =
  | { normalized: string; ownerType: "user"; ownerId: string }
  | { normalized: string; ownerType: "organization"; ownerId: number };

export type ResolveUsernameOwnerOptions = {
  expectedOwnerType?: "user" | "organization";
  includeDeletedUser?: boolean;
  requireActiveOrganization?: boolean;
  backfillGlobalUsername?: boolean;
};

function normalizeOwnerType(raw: string | null | undefined) {
  return raw === "organization" ? "organization" : "user";
}

async function tryBackfillGlobalUsername(owner: {
  ownerType: "user" | "organization";
  ownerId: string | number;
  username: string;
}) {
  if (!owner.username) return;
  if (isReservedUsername(owner.username)) {
    return;
  }
  try {
    await setUsernameForOwner({
      username: owner.username,
      ownerType: owner.ownerType,
      ownerId: owner.ownerId,
    });
  } catch {
    // best-effort only
  }
}

export async function resolveUsernameOwner(
  raw: string | null | undefined,
  options: ResolveUsernameOwnerOptions = {},
): Promise<ResolvedUsernameOwner | null> {
  const normalized = normalizeUsernameInput(raw);
  if (!normalized) return null;

  const expectedOwnerType = options.expectedOwnerType ?? null;
  const includeDeletedUser = options.includeDeletedUser ?? false;
  const requireActiveOrganization = options.requireActiveOrganization ?? true;
  const backfillGlobalUsername = options.backfillGlobalUsername ?? true;

  const global = await prisma.globalUsername.findUnique({
    where: { username: normalized },
    select: { ownerType: true, ownerId: true },
  });

  if (global) {
    const ownerType = normalizeOwnerType(global.ownerType);
    if (expectedOwnerType && ownerType !== expectedOwnerType) {
      return null;
    }
    if (ownerType === "user") {
      const profile = await prisma.profile.findUnique({
        where: { id: global.ownerId },
        select: { id: true, isDeleted: true },
      });
      if (profile && (includeDeletedUser || !profile.isDeleted)) {
        return { normalized, ownerType: "user", ownerId: profile.id };
      }
    } else {
      const orgId = Number(global.ownerId);
      if (!Number.isFinite(orgId)) return null;
      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, status: true },
      });
      if (organization && (!requireActiveOrganization || organization.status === "ACTIVE")) {
        return { normalized, ownerType: "organization", ownerId: organization.id };
      }
    }
  }

  if (!expectedOwnerType || expectedOwnerType === "user") {
    const profile = await prisma.profile.findFirst({
      where: {
        username: { equals: normalized, mode: "insensitive" },
        ...(includeDeletedUser ? {} : { isDeleted: false }),
      },
      select: { id: true, username: true, isDeleted: true },
    });
    if (profile && (includeDeletedUser || !profile.isDeleted)) {
      if (backfillGlobalUsername && profile.username) {
        await tryBackfillGlobalUsername({
          ownerType: "user",
          ownerId: profile.id,
          username: profile.username,
        });
      }
      return { normalized, ownerType: "user", ownerId: profile.id };
    }
  }

  if (!expectedOwnerType || expectedOwnerType === "organization") {
    const organization = await prisma.organization.findFirst({
      where: {
        username: { equals: normalized, mode: "insensitive" },
        ...(requireActiveOrganization ? { status: "ACTIVE" } : {}),
      },
      select: { id: true, username: true },
    });
    if (organization) {
      if (backfillGlobalUsername && organization.username) {
        await tryBackfillGlobalUsername({
          ownerType: "organization",
          ownerId: organization.id,
          username: organization.username,
        });
      }
      return { normalized, ownerType: "organization", ownerId: organization.id };
    }
  }

  return null;
}
