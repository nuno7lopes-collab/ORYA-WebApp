import { NextRequest } from "next/server";
import {
  OrganizationMemberRole,
  OrganizationRolePack,
  TrainerProfileReviewStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdStrict } from "@/lib/organizationId";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import {
  getEffectiveOrganizationMember,
  listEffectiveOrganizationMembers,
  type EffectiveOrganizationMember,
} from "@/lib/organizationMembers";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

const MEMBER_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const MANAGER_ROLE_PACKS = new Set<OrganizationRolePack>([
  OrganizationRolePack.CLUB_MANAGER,
  OrganizationRolePack.TOURNAMENT_DIRECTOR,
]);

type ProfessionalRow = {
  id: number;
  userId: string | null;
  isActive: boolean;
  updatedAt: Date;
  createdAt: Date;
};

type TrainerProfileRow = {
  id: number;
  userId: string;
  reservationProfessionalId: number | null;
};

type TrainerItem = {
  userId: string;
  fullName: string | null;
  username: string | null;
  avatarUrl: string | null;
  role: OrganizationMemberRole;
  rolePack: OrganizationRolePack | null;
  professionalId: number | null;
  professionalIsActive: boolean | null;
};

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(
    ctx,
    { errorCode: resolvedCode, message: resolvedMessage, retryable },
    { status },
  );
}

function canManageTrainers(
  role: OrganizationMemberRole | null | undefined,
  rolePack: OrganizationRolePack | null | undefined,
) {
  if (!role) return false;
  if (
    role === OrganizationMemberRole.OWNER ||
    role === OrganizationMemberRole.CO_OWNER ||
    role === OrganizationMemberRole.ADMIN
  ) {
    return true;
  }
  if (role === OrganizationMemberRole.STAFF && rolePack && MANAGER_ROLE_PACKS.has(rolePack)) {
    return true;
  }
  return false;
}

function isTrainerEligibleRole(role: OrganizationMemberRole) {
  return MEMBER_ROLES.includes(role);
}

function pickCanonicalProfessional(rows: ProfessionalRow[]) {
  if (rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    const updatedDiff = b.updatedAt.getTime() - a.updatedAt.getTime();
    if (updatedDiff !== 0) return updatedDiff;
    const createdDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdDiff !== 0) return createdDiff;
    return a.id - b.id;
  });
  return sorted[0] ?? null;
}

function resolveTrainerDisplayName(profile: { fullName: string | null; username: string | null } | null) {
  const fullName = profile?.fullName?.trim();
  if (fullName) return fullName;
  const username = profile?.username?.trim();
  if (username) return username;
  return "Treinador";
}

async function ensureTrainerProfessionalLink(params: {
  organizationId: number;
  userId: string;
}) {
  const { organizationId, userId } = params;
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { fullName: true, username: true },
  });
  const displayName = resolveTrainerDisplayName(profile);

  const professional = await prisma.reservationProfessional.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    update: {
      name: displayName,
      roleTitle: "Treinador",
      isActive: true,
    },
    create: {
      organizationId,
      userId,
      name: displayName,
      roleTitle: "Treinador",
      isActive: true,
      priority: 0,
    },
    select: { id: true },
  });

  return professional.id;
}

async function upsertTrainerProfile(params: {
  organizationId: number;
  userId: string;
  reservationProfessionalId: number | null;
}) {
  const { organizationId, userId, reservationProfessionalId } = params;
  const now = new Date();

  return prisma.trainerProfile.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    update: {
      reservationProfessionalId,
      isPublished: true,
      reviewStatus: TrainerProfileReviewStatus.APPROVED,
      reviewNote: null,
      reviewRequestedAt: null,
      reviewedAt: now,
      reviewedByUserId: null,
    },
    create: {
      organizationId,
      userId,
      reservationProfessionalId,
      isPublished: true,
      reviewStatus: TrainerProfileReviewStatus.APPROVED,
      reviewRequestedAt: now,
      reviewedAt: now,
    },
    select: { id: true, userId: true },
  });
}

async function listTrainerItems(organizationId: number): Promise<TrainerItem[]> {
  const trainerProfiles = await prisma.trainerProfile.findMany({
    where: { organizationId },
    select: { id: true, userId: true, reservationProfessionalId: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  if (trainerProfiles.length === 0) return [];

  const userIds = Array.from(new Set(trainerProfiles.map((entry) => entry.userId)));
  const [members, profiles, professionals] = await Promise.all([
    listEffectiveOrganizationMembers({ organizationId, userIds, roles: MEMBER_ROLES }),
    prisma.profile.findMany({
      where: { id: { in: userIds }, isDeleted: false },
      select: { id: true, fullName: true, username: true, avatarUrl: true },
    }),
    prisma.reservationProfessional.findMany({
      where: { organizationId, userId: { in: userIds } },
      select: { id: true, userId: true, isActive: true, updatedAt: true, createdAt: true },
    }),
  ]);

  const memberByUserId = new Map(members.map((member) => [member.userId, member]));
  const profileByUserId = new Map(profiles.map((profile) => [profile.id, profile]));
  const professionalById = new Map(professionals.map((professional) => [professional.id, professional]));
  const professionalByUserId = new Map<string, ProfessionalRow[]>();
  for (const professional of professionals) {
    if (!professional.userId) continue;
    const current = professionalByUserId.get(professional.userId) ?? [];
    current.push(professional);
    professionalByUserId.set(professional.userId, current);
  }

  const items: TrainerItem[] = [];
  for (const trainerProfile of trainerProfiles as TrainerProfileRow[]) {
    const member = memberByUserId.get(trainerProfile.userId);
    if (!member) continue;
    if (!isTrainerEligibleRole(member.role)) continue;

    const linkedProfessional =
      trainerProfile.reservationProfessionalId != null
        ? professionalById.get(trainerProfile.reservationProfessionalId) ?? null
        : null;
    const professional =
      linkedProfessional ??
      pickCanonicalProfessional(professionalByUserId.get(trainerProfile.userId) ?? []);
    const profile = profileByUserId.get(trainerProfile.userId) ?? null;

    items.push({
      userId: trainerProfile.userId,
      fullName: profile?.fullName ?? null,
      username: profile?.username ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
      role: member.role,
      rolePack: member.rolePack ?? null,
      professionalId: professional?.id ?? null,
      professionalIsActive: professional ? professional.isActive : null,
    });
  }

  return items.sort((a, b) =>
    (a.fullName || a.username || "").localeCompare((b.fullName || b.username || ""), "pt-PT"),
  );
}

async function resolveTrainerItemForUser(params: {
  organizationId: number;
  userId: string;
}) {
  const { organizationId, userId } = params;
  const items = await listTrainerItems(organizationId);
  return items.find((item) => item.userId === userId) ?? null;
}

async function _GET(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
    if (error || !user) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }

    const orgResolution = resolveOrganizationIdStrict({ req, allowFallback: false });
    if (!orgResolution.ok) {
      if (orgResolution.reason === "CONFLICT") return fail(ctx, 400, "ORGANIZATION_ID_CONFLICT");
      if (orgResolution.reason === "INVALID") return fail(ctx, 400, "INVALID_ORGANIZATION_ID");
      return fail(ctx, 400, "INVALID_ORGANIZATION_ID");
    }

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: orgResolution.organizationId,
      allowFallback: false,
      roles: MEMBER_ROLES,
    });
    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const items = await listTrainerItems(organization.id);
    return respondOk(ctx, { items }, { status: 200 });
  } catch (err) {
    console.error("[org/padel/trainers][GET]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

async function _POST(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
    if (error || !user) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }

    const body = await req.json().catch(() => null);
    const orgResolution = resolveOrganizationIdStrict({
      req,
      body: body && typeof body === "object" ? (body as Record<string, unknown>) : null,
      allowFallback: false,
    });
    if (!orgResolution.ok) {
      if (orgResolution.reason === "CONFLICT") return fail(ctx, 400, "ORGANIZATION_ID_CONFLICT");
      if (orgResolution.reason === "INVALID") return fail(ctx, 400, "INVALID_ORGANIZATION_ID");
      return fail(ctx, 400, "INVALID_ORGANIZATION_ID");
    }

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: orgResolution.organizationId,
      allowFallback: false,
      roles: MEMBER_ROLES,
    });
    if (!organization || !membership) {
      return fail(ctx, 403, "Sem permissões para gerir treinadores.");
    }
    if (!canManageTrainers(membership.role, membership.rolePack ?? null)) {
      return fail(ctx, 403, "Sem permissões para gerir treinadores.");
    }

    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "TRAINERS" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.errorCode ?? "FORBIDDEN",
          message: emailGate.message ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }

    const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    if (!userId) {
      return fail(ctx, 400, "Seleciona um membro da equipa.");
    }

    const targetMembership = await getEffectiveOrganizationMember({
      organizationId: organization.id,
      userId,
    });
    if (!targetMembership) {
      return fail(ctx, 400, "Utilizador não pertence à organização.");
    }
    if (!isTrainerEligibleRole(targetMembership.role)) {
      return fail(ctx, 400, "Só membros da equipa podem ser treinador.");
    }

    const professionalId = await ensureTrainerProfessionalLink({
      organizationId: organization.id,
      userId,
    });
    await upsertTrainerProfile({
      organizationId: organization.id,
      userId,
      reservationProfessionalId: professionalId,
    });

    const item = await resolveTrainerItemForUser({ organizationId: organization.id, userId });
    return respondOk(ctx, { item }, { status: 200 });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return fail(ctx, 409, "Conflito ao associar treinador. Atualiza e tenta novamente.");
    }
    console.error("[org/padel/trainers][POST]", err);
    return fail(ctx, 500, "Não foi possível adicionar o treinador.");
  }
}

async function _DELETE(req: NextRequest) {
  const ctx = getRequestContext(req);
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
    if (error || !user) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }

    const body = await req.json().catch(() => null);
    const orgResolution = resolveOrganizationIdStrict({
      req,
      body: body && typeof body === "object" ? (body as Record<string, unknown>) : null,
      allowFallback: false,
    });
    if (!orgResolution.ok) {
      if (orgResolution.reason === "CONFLICT") return fail(ctx, 400, "ORGANIZATION_ID_CONFLICT");
      if (orgResolution.reason === "INVALID") return fail(ctx, 400, "INVALID_ORGANIZATION_ID");
      return fail(ctx, 400, "INVALID_ORGANIZATION_ID");
    }

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: orgResolution.organizationId,
      allowFallback: false,
      roles: MEMBER_ROLES,
    });
    if (!organization || !membership) {
      return fail(ctx, 403, "Sem permissões para gerir treinadores.");
    }
    if (!canManageTrainers(membership.role, membership.rolePack ?? null)) {
      return fail(ctx, 403, "Sem permissões para gerir treinadores.");
    }

    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "TRAINERS" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.errorCode ?? "FORBIDDEN",
          message: emailGate.message ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }

    const userIdRaw =
      typeof body?.userId === "string"
        ? body.userId
        : typeof req.nextUrl.searchParams.get("userId") === "string"
          ? req.nextUrl.searchParams.get("userId")
          : "";
    const userId = userIdRaw.trim();
    if (!userId) {
      return fail(ctx, 400, "Seleciona um treinador.");
    }

    const targetProfile = await prisma.trainerProfile.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId } },
      select: { id: true },
    });
    if (!targetProfile) {
      return fail(ctx, 404, "Treinador não encontrado.");
    }

    await prisma.trainerProfile.delete({ where: { id: targetProfile.id } });
    return respondOk(ctx, { deleted: true, userId }, { status: 200 });
  } catch (err) {
    console.error("[org/padel/trainers][DELETE]", err);
    return fail(ctx, 500, "Não foi possível remover o treinador.");
  }
}

export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
export const DELETE = withApiEnvelope(_DELETE);
