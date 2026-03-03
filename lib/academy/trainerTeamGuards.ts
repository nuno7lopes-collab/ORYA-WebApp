import { OrganizationMemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listEffectiveOrganizationMembers } from "@/lib/organizationMembers";

const TRAINER_ELIGIBLE_TEAM_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function parsePositiveInt(raw: unknown) {
  const parsed = typeof raw === "number" || typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

export function parseProfessionalIdsInput(payload: Record<string, unknown>) {
  const hasInput = Object.prototype.hasOwnProperty.call(payload, "professionalIds");
  if (!hasInput) {
    return { ok: true as const, provided: false, ids: [] as number[] };
  }

  const raw = payload.professionalIds;
  if (raw == null) {
    return { ok: true as const, provided: true, ids: [] as number[] };
  }
  if (!Array.isArray(raw)) {
    return {
      ok: false as const,
      status: 400,
      errorCode: "BAD_REQUEST",
      message: "Profissionais inválidos.",
    };
  }

  const ids: number[] = [];
  for (const value of raw) {
    const parsed = parsePositiveInt(value);
    if (!parsed) {
      return {
        ok: false as const,
        status: 400,
        errorCode: "BAD_REQUEST",
        message: "Profissionais inválidos.",
      };
    }
    ids.push(parsed);
  }

  return { ok: true as const, provided: true, ids: Array.from(new Set(ids)) };
}

export function parseProfessionalIdInput(payload: Record<string, unknown>) {
  const hasInput = Object.prototype.hasOwnProperty.call(payload, "professionalId");
  if (!hasInput) {
    return { ok: true as const, provided: false, professionalId: null as number | null };
  }

  const raw = payload.professionalId;
  if (raw == null || raw === "") {
    return { ok: true as const, provided: true, professionalId: null as number | null };
  }

  const professionalId = parsePositiveInt(raw);
  if (!professionalId) {
    return {
      ok: false as const,
      status: 400,
      errorCode: "BAD_REQUEST",
      message: "Treinador inválido.",
    };
  }

  return { ok: true as const, provided: true, professionalId };
}

export async function assertTrainerIdsBelongToEligibleTeamMembers(params: {
  organizationId: number;
  professionalIds: number[];
}) {
  const professionalIds = Array.from(new Set(params.professionalIds.filter((id) => Number.isFinite(id) && id > 0)));
  if (professionalIds.length === 0) {
    return { ok: true as const };
  }

  const professionals = await prisma.reservationProfessional.findMany({
    where: {
      organizationId: params.organizationId,
      id: { in: professionalIds },
    },
    select: {
      id: true,
      userId: true,
      isActive: true,
    },
  });
  const professionalById = new Map(professionals.map((professional) => [professional.id, professional]));

  const prelimValidUserIds = new Set<string>();
  const invalidProfessionalIds = new Set<number>();

  for (const professionalId of professionalIds) {
    const professional = professionalById.get(professionalId);
    if (!professional || !professional.userId || !professional.isActive) {
      invalidProfessionalIds.add(professionalId);
      continue;
    }
    prelimValidUserIds.add(professional.userId);
  }

  if (prelimValidUserIds.size > 0) {
    const members = await listEffectiveOrganizationMembers({
      organizationId: params.organizationId,
      userIds: Array.from(prelimValidUserIds),
      roles: [...TRAINER_ELIGIBLE_TEAM_ROLES],
    });
    const validTeamUserIds = new Set(members.map((member) => member.userId));

    for (const professionalId of professionalIds) {
      const professional = professionalById.get(professionalId);
      if (!professional?.userId) continue;
      if (!validTeamUserIds.has(professional.userId)) {
        invalidProfessionalIds.add(professionalId);
      }
    }
  }

  if (invalidProfessionalIds.size > 0) {
    return {
      ok: false as const,
      invalidProfessionalIds: Array.from(invalidProfessionalIds).sort((a, b) => a - b),
    };
  }

  return { ok: true as const };
}
