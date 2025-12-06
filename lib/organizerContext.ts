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

  const client = prisma as unknown as {
    organizerMember?: { findFirst: typeof prisma.organizerMember.findFirst; findMany: typeof prisma.organizerMember.findMany };
    organizer?: { findFirst: typeof prisma.organizer.findFirst };
  };

  if (!client || typeof client.organizerMember?.findFirst !== "function") {
    console.error("[organizerContext] prisma client sem modelo organizerMember");
    return { organizer: null, membership: null };
  }

  let membershipsFallbackAllowed = false;
  let memberships: Array<
    Awaited<ReturnType<typeof prisma.organizerMember.findMany>>[number]
  > | null = null;
  try {
    memberships = await client.organizerMember!.findMany({
      where: {
        userId,
        ...(roles ? { role: { in: roles } } : {}),
        organizer: { status: "ACTIVE" },
      },
      include: { organizer: true },
      orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
    });
  } catch (err: unknown) {
    const message = typeof err === "object" && err && "message" in err ? String((err as { message?: unknown }).message) : "";
    const code = typeof err === "object" && err && "code" in err ? (err as { code?: string }).code : undefined;
    // Se a coluna lastUsedAt não existir ou a tabela não existir, faz fallback sem ela
    if (code === "P2021" || message.includes("does not exist") || message.includes("Unknown argument `lastUsedAt`")) {
      membershipsFallbackAllowed = true;
      try {
        memberships = await client.organizerMember!.findMany({
          where: {
            userId,
            ...(roles ? { role: { in: roles } } : {}),
            organizer: { status: "ACTIVE" },
          },
          include: { organizer: true },
          orderBy: [{ createdAt: "asc" }],
        });
      } catch (fallbackErr) {
        const fallbackCode =
          typeof fallbackErr === "object" && fallbackErr && "code" in fallbackErr
            ? (fallbackErr as { code?: string }).code
            : undefined;
        const fallbackMsg =
          typeof fallbackErr === "object" && fallbackErr && "message" in fallbackErr
            ? String((fallbackErr as { message?: unknown }).message)
            : "";
        if (fallbackCode === "P2021" || fallbackMsg.includes("does not exist")) {
          console.warn("[organizerContext] organizer_members não existe no schema atual");
        } else {
          throw fallbackErr;
        }
      }
    } else {
      throw err;
    }
  }

  if (memberships && memberships.length > 0) {
    const selected =
      (organizerId ? memberships.find((m) => m.organizerId === organizerId) : null) ??
      memberships[0];
    if (selected?.organizer) {
      return { organizer: selected.organizer, membership: selected };
    }
  }

  // 3) Legacy fallback (organizers.user_id) — apenas se a tabela de memberships estiver em falta
  if (memberships === null && membershipsFallbackAllowed && typeof client.organizer?.findFirst === "function") {
    const organizer = await client.organizer.findFirst({
      where: { userId, status: "ACTIVE" },
    });
    return { organizer, membership: null };
  }

  return { organizer: null, membership: null };
}
