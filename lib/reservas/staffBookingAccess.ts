import { OrganizationMemberRole } from "@prisma/client";
import { intersectIds, resolveReservasScopesForMember, resolveTrainerProfessionalIds } from "@/lib/reservas/memberScopes";

type BookingScopeFields = {
  professionalId: number | null;
  resourceId: number | null;
  courtId: number | null;
};

type AccessResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      errorCode: string;
      message: string;
    };

export async function ensureStaffCanAccessBooking(params: {
  organizationId: number;
  userId: string;
  role: OrganizationMemberRole;
  isCoach: boolean;
  booking: BookingScopeFields;
}): Promise<AccessResult> {
  if (params.role !== OrganizationMemberRole.STAFF) return { ok: true };

  const scopes = await resolveReservasScopesForMember({
    organizationId: params.organizationId,
    userId: params.userId,
  });
  if (!scopes.hasAny) {
    return { ok: false, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
  }

  if (params.isCoach) {
    const trainerProfessionalIds = await resolveTrainerProfessionalIds({
      organizationId: params.organizationId,
      userId: params.userId,
    });
    const allowedProfessionals = scopes.professionalIds.length
      ? intersectIds(trainerProfessionalIds, scopes.professionalIds)
      : trainerProfessionalIds;
    if (!allowedProfessionals.length || !params.booking.professionalId || !allowedProfessionals.includes(params.booking.professionalId)) {
      return { ok: false, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
    }
    if (scopes.courtIds.length && params.booking.courtId && !scopes.courtIds.includes(params.booking.courtId)) {
      return { ok: false, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
    }
    if (scopes.resourceIds.length && params.booking.resourceId && !scopes.resourceIds.includes(params.booking.resourceId)) {
      return { ok: false, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
    }
    return { ok: true };
  }

  const allowed = [
    params.booking.courtId && scopes.courtIds.includes(params.booking.courtId),
    params.booking.resourceId && scopes.resourceIds.includes(params.booking.resourceId),
    params.booking.professionalId && scopes.professionalIds.includes(params.booking.professionalId),
  ].some(Boolean);
  if (!allowed) {
    return { ok: false, status: 403, errorCode: "FORBIDDEN", message: "Sem permissões." };
  }

  return { ok: true };
}
