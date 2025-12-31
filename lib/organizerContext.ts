import { OrganizerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveOrganizerIdFromCookies } from "@/lib/organizerId";

type Options = {
  organizerId?: number | null;
  roles?: OrganizerMemberRole[];
  // Se quisermos forçar leitura de cookie, basta passar organizerId externamente
};

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
    // Se o organizerId foi pedido explicitamente e não existe membership, não faz fallback.
    return { organizer: null, membership: null };
  }

  const memberships = await prisma.organizerMember.findMany({
    where: {
      userId,
      ...(roles ? { role: { in: roles } } : {}),
      organizer: { status: "ACTIVE" },
    },
    include: { organizer: true },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
  });

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
