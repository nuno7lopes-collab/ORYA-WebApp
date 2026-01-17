import { OrganizationMemberRole, OrganizationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveOrganizationIdFromCookies } from "@/lib/organizationId";

type Options = {
  organizationId?: number | null;
  roles?: OrganizationMemberRole[];
  allowFallback?: boolean;
  allowedStatuses?: OrganizationStatus[];
  // Se quisermos forçar leitura de cookie, basta passar organizationId externamente
};

export async function getActiveOrganizationForUser(userId: string, opts: Options = {}) {
  const { roles, allowFallback = false } = opts;
  const allowedStatuses = opts.allowedStatuses ?? [OrganizationStatus.ACTIVE];
  const directOrganizationId =
    typeof opts.organizationId === "number" && Number.isFinite(opts.organizationId)
      ? opts.organizationId
      : null;
  const cookieOrganizationId = directOrganizationId ? null : await resolveOrganizationIdFromCookies();
  const organizationId = directOrganizationId ?? cookieOrganizationId;

  // 1) Se organizationId foi especificado, tenta buscar diretamente essa membership primeiro
  if (organizationId) {
    const direct = await prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        ...(roles ? { role: { in: roles } } : {}),
        organization: { status: { in: allowedStatuses } },
      },
      include: { organization: true },
    });
    if (direct?.organization) {
      return { organization: direct.organization, membership: direct };
    }
    // Se o organizationId foi pedido explicitamente e não existe membership, não faz fallback.
    if (!allowFallback) {
      return { organization: null, membership: null };
    }
  }

  const memberships = await prisma.organizationMember.findMany({
    where: {
      userId,
      ...(roles ? { role: { in: roles } } : {}),
      organization: { status: { in: allowedStatuses } },
    },
    include: { organization: true },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "asc" }],
  });

  if (memberships && memberships.length > 0) {
    const selected = memberships[0];
    if (selected?.organization) {
      return { organization: selected.organization, membership: selected };
    }
  }

  return { organization: null, membership: null };
}
