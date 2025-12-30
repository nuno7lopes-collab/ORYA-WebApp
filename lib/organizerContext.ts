import { OrganizerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureUserIsOrganizer } from "@/lib/organizerRoles";
import { resolveOrganizerIdFromCookies } from "@/lib/organizerId";

type Options = {
  organizerId?: number | null;
  roles?: OrganizerMemberRole[];
  // Se quisermos forçar leitura de cookie, basta passar organizerId externamente
};

export async function ensureLegacyOrganizerMemberships(userId: string, organizerId?: number | null) {
  if (!userId) return 0;

  const legacyOrganizers = await prisma.organizer.findMany({
    where: {
      userId,
      ...(Number.isFinite(organizerId) ? { id: organizerId! } : {}),
    },
    select: { id: true },
  });

  if (legacyOrganizers.length === 0) return 0;

  try {
    await prisma.$transaction(async (tx) => {
      for (const organizer of legacyOrganizers) {
        await tx.organizerMember.upsert({
          where: {
            organizerId_userId: {
              organizerId: organizer.id,
              userId,
            },
          },
          update: { role: OrganizerMemberRole.OWNER },
          create: {
            organizerId: organizer.id,
            userId,
            role: OrganizerMemberRole.OWNER,
          },
        });
      }

      await ensureUserIsOrganizer(tx, userId);
    });
  } catch (err: unknown) {
    const msg =
      typeof err === "object" && err && "message" in err ? String((err as { message?: unknown }).message) : "";
    if (msg.includes("does not exist") || msg.includes("organizer_members")) {
      return 0;
    }
    throw err;
  }

  return legacyOrganizers.length;
}

export async function getActiveOrganizerForUser(userId: string, opts: Options = {}) {
  const { roles } = opts;
  const directOrganizerId =
    typeof opts.organizerId === "number" && Number.isFinite(opts.organizerId)
      ? opts.organizerId
      : null;
  const cookieOrganizerId = directOrganizerId ? null : await resolveOrganizerIdFromCookies();
  const organizerId = directOrganizerId ?? cookieOrganizerId;

  // 1) Se organizerId foi especificado, tenta buscar diretamente essa membership primeiro
  if (organizerId) {
    const direct = await prisma.organizerMember.findFirst({
      where: {
        userId,
        organizerId,
        ...(roles ? { role: { in: roles } } : {}),
        organizer: { status: "ACTIVE" },
      },
      include: { organizer: true },
    });
    if (direct?.organizer) {
      return { organizer: direct.organizer, membership: direct };
    }

    const legacyFixed = await ensureLegacyOrganizerMemberships(userId, organizerId);
    if (legacyFixed > 0) {
      const retry = await prisma.organizerMember.findFirst({
        where: {
          userId,
          organizerId,
          ...(roles ? { role: { in: roles } } : {}),
          organizer: { status: "ACTIVE" },
        },
        include: { organizer: true },
      });
      if (retry?.organizer) {
        return { organizer: retry.organizer, membership: retry };
      }
    }
    // Se o organizerId foi pedido explicitamente e não existe membership, não faz fallback.
    return { organizer: null, membership: null };
  }

  let memberships = await prisma.organizerMember.findMany({
    where: {
      userId,
      ...(roles ? { role: { in: roles } } : {}),
      organizer: { status: "ACTIVE" },
    },
    include: { organizer: true },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
  });

  if (memberships.length === 0) {
    const legacyFixed = await ensureLegacyOrganizerMemberships(userId);
    if (legacyFixed > 0) {
      memberships = await prisma.organizerMember.findMany({
        where: {
          userId,
          ...(roles ? { role: { in: roles } } : {}),
          organizer: { status: "ACTIVE" },
        },
        include: { organizer: true },
        orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
      });
    }
  }

  if (memberships && memberships.length > 0) {
    if (memberships.length > 1) {
      return { organizer: null, membership: null };
    }
    const selected = memberships[0];
    if (selected?.organizer) {
      return { organizer: selected.organizer, membership: selected };
    }
  }

  return { organizer: null, membership: null };
}
