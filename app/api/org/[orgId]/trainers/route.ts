import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import {
  NotificationType,
  OrganizationMemberRole,
  OrganizationModule,
  TrainerProfileReviewStatus,
} from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId, resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { createNotification } from "@/lib/notifications";
import { getEffectiveOrganizationMember, listEffectiveOrganizationMembers } from "@/lib/organizationMembers";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { buildOrgHref } from "@/lib/organizationIdUtils";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
const TRAINER_MEMBER_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];
const TRAINER_ROLE_TITLE = "Treinador";

function isTrainerEligibleRole(role: OrganizationMemberRole | null | undefined) {
  return !!role && TRAINER_MEMBER_ROLES.includes(role);
}

async function ensureReservationProfessionalForTrainer(params: {
  tx: Pick<typeof prisma, "profile" | "reservationProfessional">;
  organizationId: number;
  userId: string;
}) {
  const profile = await params.tx.profile.findUnique({
    where: { id: params.userId },
    select: { fullName: true, username: true },
  });
  const professionalName = profile?.fullName?.trim() || profile?.username?.trim() || TRAINER_ROLE_TITLE;

  return params.tx.reservationProfessional.upsert({
    where: {
      organizationId_userId: {
        organizationId: params.organizationId,
        userId: params.userId,
      },
    },
    update: {
      isActive: true,
      name: professionalName,
      roleTitle: TRAINER_ROLE_TITLE,
    },
    create: {
      organizationId: params.organizationId,
      userId: params.userId,
      name: professionalName,
      roleTitle: TRAINER_ROLE_TITLE,
      isActive: true,
      priority: 0,
    },
    select: { id: true, isActive: true },
  });
}

function fail(
  ctx: ReturnType<typeof getRequestContext>,
  status: number,
  message: string,
  errorCode = errorCodeForStatus(status),
  retryable = status >= 500,
  details?: Record<string, unknown>,
) {
  const resolvedMessage = typeof message === "string" ? message : String(message);
  const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
  return respondError(
    ctx,
    { errorCode: resolvedCode, message: resolvedMessage, retryable, ...(details ? { details } : {}) },
    { status },
  );
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

    const organizationId = resolveOrganizationIdFromRequest(req);

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "TRAINERS" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.errorCode ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.errorCode ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.STAFF,
      required: "VIEW",
    });
    if (!access.ok) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const trainerMembers = await listEffectiveOrganizationMembers({
      organizationId: organization.id,
      roles: TRAINER_MEMBER_ROLES,
    });

    const explicitTrainerProfiles = await prisma.trainerProfile.findMany({
      where: { organizationId: organization.id },
      select: {
        id: true,
        organizationId: true,
        userId: true,
        title: true,
        bio: true,
        specialties: true,
        certifications: true,
        experienceYears: true,
        coverImageUrl: true,
        isPublished: true,
        reviewStatus: true,
        reviewNote: true,
        reviewRequestedAt: true,
        reviewedAt: true,
        reviewedByUserId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const trainerMembersByUserId = new Map(trainerMembers.map((member) => [member.userId, member]));
    const explicitTrainerUserIds = explicitTrainerProfiles
      .map((profile) => profile.userId)
      .filter((userId) => trainerMembersByUserId.has(userId));
    const trainerUserIds = Array.from(new Set(explicitTrainerUserIds));

    const users = trainerUserIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: trainerUserIds }, isDeleted: false },
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        })
      : [];
    const userById = new Map(users.map((entry) => [entry.id, entry]));
    const reservationProfessionals = trainerUserIds.length
      ? await prisma.reservationProfessional.findMany({
          where: { organizationId: organization.id, userId: { in: trainerUserIds } },
          select: { id: true, userId: true, isActive: true },
        })
      : [];
    const profileByUser = new Map(explicitTrainerProfiles.map((profile) => [profile.userId, profile]));
    const professionalByUser = new Map(
      reservationProfessionals
        .filter((professional) => !!professional.userId)
        .map((professional) => [professional.userId as string, professional]),
    );

    const items = trainerUserIds
      .map((userId) => trainerMembersByUserId.get(userId))
      .filter(Boolean)
      .map((member) => {
      if (!member) return null;
      const profile = profileByUser.get(member.userId) ?? null;
      const professional = professionalByUser.get(member.userId) ?? null;
      const userProfile = userById.get(member.userId);
      return {
        userId: member.userId,
        fullName: userProfile?.fullName ?? null,
        username: userProfile?.username ?? null,
        avatarUrl: userProfile?.avatarUrl ?? null,
        role: member.role,
        rolePack: member.rolePack ?? null,
        professionalId: professional?.id ?? null,
        professionalIsActive: professional?.isActive ?? null,
        isPublished: profile?.isPublished ?? false,
        reviewStatus: profile?.reviewStatus ?? TrainerProfileReviewStatus.DRAFT,
        reviewNote: profile?.reviewNote ?? null,
        reviewRequestedAt: profile?.reviewRequestedAt?.toISOString() ?? null,
        profile,
      };
    })
      .filter(Boolean)
      .sort((a, b) => {
        const aName = (a?.fullName || a?.username || "").toLowerCase();
        const bName = (b?.fullName || b?.username || "").toLowerCase();
        return aName.localeCompare(bName, "pt-PT");
      });

    return respondOk(ctx, { items, organizationId: organization.id }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/trainers][GET]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

async function _PATCH(req: NextRequest) {
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
    const organizationId = resolveOrganizationIdFromRequest(req) ?? parseOrganizationId(body?.organizationId);
    const targetUserId = typeof body?.userId === "string" ? body.userId : null;
    const action = typeof body?.action === "string" ? body.action.toUpperCase() : null;
    const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.trim() : null;

    if (!targetUserId || !action) {
      return fail(ctx, 400, "INVALID_PAYLOAD");
    }

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.STAFF,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const trainerMembership = await getEffectiveOrganizationMember({
      organizationId: organization.id,
      userId: targetUserId,
    });

    if (
      !trainerMembership ||
      !isTrainerEligibleRole(trainerMembership.role)
    ) {
      return fail(ctx, 404, "NOT_TEAM_MEMBER");
    }

    const existingProfile = await prisma.trainerProfile.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId: targetUserId } },
    });

    const allowedActions = new Set(["APPROVE", "REJECT", "HIDE", "PUBLISH"]);
    if (!allowedActions.has(action)) {
      return fail(ctx, 400, "UNKNOWN_ACTION");
    }
    if (action === "PUBLISH" && existingProfile?.reviewStatus !== TrainerProfileReviewStatus.APPROVED) {
      return fail(ctx, 400, "NEEDS_APPROVAL");
    }

    const now = new Date();

    const profile = await prisma.$transaction(async (tx) => {
      const upserted = await tx.trainerProfile.upsert({
        where: { organizationId_userId: { organizationId: organization.id, userId: targetUserId } },
        update: (() => {
          if (action === "APPROVE") {
            return {
              isPublished: true,
              reviewStatus: TrainerProfileReviewStatus.APPROVED,
              reviewNote: null,
              reviewRequestedAt: null,
              reviewedAt: now,
              reviewedByUserId: user.id,
            };
          }
          if (action === "REJECT") {
            return {
              isPublished: false,
              reviewStatus: TrainerProfileReviewStatus.REJECTED,
              reviewNote,
              reviewRequestedAt: null,
              reviewedAt: now,
              reviewedByUserId: user.id,
            };
          }
          if (action === "HIDE") {
            return {
              isPublished: false,
            };
          }
          if (action === "PUBLISH") {
            return {
              isPublished: true,
            };
          }
          return {};
        })(),
        create: {
          organizationId: organization.id,
          userId: targetUserId,
          isPublished: action === "APPROVE" || action === "PUBLISH",
          reviewStatus:
            action === "APPROVE"
              ? TrainerProfileReviewStatus.APPROVED
              : action === "REJECT"
                ? TrainerProfileReviewStatus.REJECTED
                : TrainerProfileReviewStatus.DRAFT,
          reviewNote: action === "REJECT" ? reviewNote : null,
          reviewedAt: action === "APPROVE" || action === "REJECT" ? now : null,
          reviewedByUserId: action === "APPROVE" || action === "REJECT" ? user.id : null,
        },
      });

      if (action === "APPROVE" || action === "PUBLISH") {
        const professional = await ensureReservationProfessionalForTrainer({
          tx,
          organizationId: organization.id,
          userId: targetUserId,
        });
        if (upserted.reservationProfessionalId !== professional.id) {
          return tx.trainerProfile.update({
            where: { id: upserted.id },
            data: { reservationProfessionalId: professional.id },
          });
        }
      }

      return upserted;
    });

    if (action === "APPROVE" || action === "REJECT") {
      const trainersHref = buildOrgHref(organization.id, "/team/trainers");
      await createNotification({
        userId: targetUserId,
        type: NotificationType.SYSTEM_ANNOUNCE,
        title: action === "APPROVE" ? "Perfil aprovado" : "Perfil recusado",
        body:
          action === "APPROVE"
            ? `A organização ${organization.publicName ?? "ORYA"} aprovou o teu perfil de treinador.`
            : `A organização ${organization.publicName ?? "ORYA"} recusou o teu perfil. ${reviewNote ? `Motivo: ${reviewNote}` : ""}`,
        ctaUrl: trainersHref,
        ctaLabel: "Ver perfil",
        organizationId: organization.id,
      }).catch((err) => console.warn("[trainer][review] notification fail", err));
    }

    return respondOk(ctx, { profile }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/trainers][PATCH]", err);
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
    const organizationId = resolveOrganizationIdFromRequest(req) ?? parseOrganizationId(body?.organizationId);
    const targetUserId = typeof body?.userId === "string" ? body.userId.trim() : "";

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.STAFF,
      required: "EDIT",
    });
    if (!access.ok) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    if (!targetUserId) {
      return fail(ctx, 400, "INVALID_PAYLOAD");
    }

    const member = await getEffectiveOrganizationMember({
      organizationId: organization.id,
      userId: targetUserId,
    });
    if (!member || !isTrainerEligibleRole(member.role)) {
      return fail(ctx, 404, "NOT_TEAM_MEMBER");
    }

    const targetProfile = await prisma.profile.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });
    if (!targetProfile) {
      return fail(ctx, 404, "USER_NOT_FOUND");
    }

    const existingTrainerProfile = await prisma.trainerProfile.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId: targetUserId } },
      select: { id: true },
    });

    const { trainerProfile, professionalId } = await prisma.$transaction(async (tx) => {
      const profile = await tx.trainerProfile.upsert({
        where: { organizationId_userId: { organizationId: organization.id, userId: targetUserId } },
        update: {},
        create: {
          organizationId: organization.id,
          userId: targetUserId,
          isPublished: false,
          reviewStatus: TrainerProfileReviewStatus.DRAFT,
        },
      });

      const professional = await ensureReservationProfessionalForTrainer({
        tx,
        organizationId: organization.id,
        userId: targetUserId,
      });

      const linkedProfile =
        profile.reservationProfessionalId === professional.id
          ? profile
          : await tx.trainerProfile.update({
              where: { id: profile.id },
              data: { reservationProfessionalId: professional.id },
            });

      return { trainerProfile: linkedProfile, professionalId: professional.id };
    });

    return respondOk(
      ctx,
      {
        trainer: {
          userId: targetUserId,
          role: member.role,
          rolePack: member.rolePack ?? null,
          professionalId,
          profile: trainerProfile,
        },
      },
      { status: existingTrainerProfile ? 200 : 201 },
    );
  } catch (err) {
    console.error("[organizacao/trainers][POST]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

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
export const GET = withApiEnvelope(_GET);
export const PATCH = withApiEnvelope(_PATCH);
export const POST = withApiEnvelope(_POST);
