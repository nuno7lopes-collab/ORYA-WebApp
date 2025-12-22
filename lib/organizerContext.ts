import { OrganizerMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Options = {
  organizerId?: number | null;
  roles?: OrganizerMemberRole[];
  // Se quisermos forçar leitura de cookie, basta passar organizerId externamente
};

export async function getActiveOrganizerForUser(userId: string, opts: Options = {}) {
  const { roles } = opts;
  const organizerId = opts.organizerId;

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
    const selected =
      (organizerId ? memberships.find((m) => m.organizerId === organizerId) : null) ??
      memberships[0];
    if (selected?.organizer) {
      return { organizer: selected.organizer, membership: selected };
    }
  }

  return { organizer: null, membership: null };
}
