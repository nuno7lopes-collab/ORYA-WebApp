import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AccessResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      errorCode: string;
      message: string;
    };

export async function ensureChangesetScopeAccess(params: {
  organizationId: number;
  changeSetId: number;
  role: OrganizationMemberRole;
  userId: string;
}): Promise<AccessResult> {
  if (params.role !== OrganizationMemberRole.STAFF) {
    return { ok: true };
  }

  const changeSet = await prisma.availabilityChangeSet.findFirst({
    where: {
      id: params.changeSetId,
      organizationId: params.organizationId,
    },
    select: { scopeType: true, scopeId: true },
  });

  // Mantém semântica 404 na rota principal quando o changeset não existe.
  if (!changeSet) {
    return { ok: true };
  }

  if (changeSet.scopeType !== "PROFESSIONAL") {
    return { ok: false, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
  }

  const professional = await prisma.reservationProfessional.findFirst({
    where: {
      id: changeSet.scopeId,
      organizationId: params.organizationId,
      userId: params.userId,
    },
    select: { id: true },
  });

  if (!professional) {
    return { ok: false, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
  }

  return { ok: true };
}
