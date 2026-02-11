import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { NotificationType, OrganizationMemberRole, OrganizationModule, TrainerProfileReviewStatus } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { createNotification } from "@/lib/notifications";
import { setGroupMemberRoleForOrg } from "@/lib/organizationGroupAccess";
import { getEffectiveOrganizationMember, listEffectiveOrganizationMembers } from "@/lib/organizationMembers";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }

    const url = new URL(req.url);
    const organizationId = parseOrganizationId(url.searchParams.get("organizationId"));

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
      roles: [OrganizationMemberRole.TRAINER],
    });
    const trainerUserIds = trainerMembers.map((m) => m.userId);
    const users = trainerUserIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: trainerUserIds }, isDeleted: false },
          select: { id: true, fullName: true, username: true, avatarUrl: true },
        })
      : [];
    const userById = new Map(users.map((entry) => [entry.id, entry]));
    const trainerProfiles = trainerUserIds.length
      ? await prisma.trainerProfile.findMany({
          where: { organizationId: organization.id, userId: { in: trainerUserIds } },
        })
      : [];

    const profileByUser = new Map(trainerProfiles.map((profile) => [profile.userId, profile]));

    const items = trainerMembers.map((member) => {
      const profile = profileByUser.get(member.userId) ?? null;
      const userProfile = userById.get(member.userId);
      return {
        userId: member.userId,
        fullName: userProfile?.fullName ?? null,
        username: userProfile?.username ?? null,
        avatarUrl: userProfile?.avatarUrl ?? null,
        isPublished: profile?.isPublished ?? false,
        reviewStatus: profile?.reviewStatus ?? TrainerProfileReviewStatus.DRAFT,
        reviewNote: profile?.reviewNote ?? null,
        reviewRequestedAt: profile?.reviewRequestedAt?.toISOString() ?? null,
        profile,
      };
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
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId);
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

    if (!trainerMembership || trainerMembership.role !== OrganizationMemberRole.TRAINER) {
      return fail(ctx, 404, "NOT_TRAINER");
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

    const profile = await prisma.trainerProfile.upsert({
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

    if (action === "APPROVE" || action === "REJECT") {
      const trainersHref = appendOrganizationIdToHref("/organizacao/treinadores", organization.id);
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
    } = await supabase.auth.getUser();

    if (error || !user) {
      return fail(ctx, 401, "UNAUTHENTICATED");
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId);
    const rawUsername = typeof body?.username === "string" ? body.username.trim() : "";
    const username = rawUsername.startsWith("@") ? rawUsername.slice(1) : rawUsername;

    if (!username) {
      return fail(ctx, 400, "MISSING_USERNAME");
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

    const targetProfile = await prisma.profile.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
      select: { id: true, username: true },
    });

    if (!targetProfile) {
      return fail(ctx, 404, "USERNAME_NOT_FOUND");
    }

    const existingMember = await getEffectiveOrganizationMember({
      organizationId: organization.id,
      userId: targetProfile.id,
    });

    let assignedTrainerRole = false;
    const protectedRoles: OrganizationMemberRole[] = [
      OrganizationMemberRole.OWNER,
      OrganizationMemberRole.CO_OWNER,
      OrganizationMemberRole.ADMIN,
    ];
    if (!existingMember) {
      await setGroupMemberRoleForOrg({
        organizationId: organization.id,
        userId: targetProfile.id,
        role: OrganizationMemberRole.TRAINER,
      });
      assignedTrainerRole = true;
    } else if (
      existingMember.role !== OrganizationMemberRole.TRAINER &&
      !protectedRoles.includes(existingMember.role)
    ) {
      await setGroupMemberRoleForOrg({
        organizationId: organization.id,
        userId: targetProfile.id,
        role: OrganizationMemberRole.TRAINER,
      });
      assignedTrainerRole = true;
    }

    const profile = await prisma.trainerProfile.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: targetProfile.id } },
      update: {},
      create: {
        organizationId: organization.id,
        userId: targetProfile.id,
        isPublished: false,
        reviewStatus: TrainerProfileReviewStatus.DRAFT,
      },
    });

    return respondOk(ctx, { profile }, { status: 200 });
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
