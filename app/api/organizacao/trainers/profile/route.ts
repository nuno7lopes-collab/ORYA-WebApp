import { NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole, NotificationType, TrainerProfileReviewStatus } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId } from "@/lib/organizationId";
import { createNotification } from "@/lib/notifications";
import { normalizeProfileCoverUrl } from "@/lib/profileMedia";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";
import { appendOrganizationIdToHref } from "@/lib/organizationIdUtils";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.TRAINER,
];

const MAX_BIO = 900;
const MAX_TITLE = 120;
const MAX_SPECIALTIES = 8;

const parseSpecialties = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, MAX_SPECIALTIES);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, MAX_SPECIALTIES);
  }
  return [] as string[];
};

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

export async function GET(req: NextRequest) {
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
      roles: ROLE_ALLOWLIST,
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      select: {
        id: true,
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
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        organization: { select: { id: true, username: true, publicName: true } },
      },
    });

    return respondOk(
      ctx,
      {
        profile,
        organization: profile?.organization ?? organization,
        user: profile?.user ?? null,
        role: membership.role,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizacao/trainers/profile][GET]", err);
    return fail(ctx, 500, "INTERNAL_ERROR");
  }
}

export async function PATCH(req: NextRequest) {
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

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ROLE_ALLOWLIST,
    });

    if (!organization || !membership) {
      return fail(ctx, 403, "FORBIDDEN");
    }

    const emailGate = ensureOrganizationEmailVerified(organization, { reasonCode: "TRAINER_PROFILE" });
    if (!emailGate.ok) {
      return respondError(
        ctx,
        {
          errorCode: emailGate.error ?? "FORBIDDEN",
          message: emailGate.message ?? emailGate.error ?? "Sem permissões.",
          retryable: false,
          details: emailGate,
        },
        { status: 403 },
      );
    }

    if (membership.role !== OrganizationMemberRole.TRAINER) {
      return fail(ctx, 403, "ONLY_TRAINER_CAN_EDIT");
    }

    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const bio = typeof body?.bio === "string" ? body.bio.trim() : "";
    const certifications = typeof body?.certifications === "string" ? body.certifications.trim() : "";
    const experienceYearsRaw = body?.experienceYears;
    const experienceYears = Number.isFinite(Number(experienceYearsRaw))
      ? Math.max(0, Math.floor(Number(experienceYearsRaw)))
      : null;
    const rawCoverImageUrl = typeof body?.coverImageUrl === "string" ? body.coverImageUrl.trim() : null;
    const coverImageUrl = rawCoverImageUrl ? normalizeProfileCoverUrl(rawCoverImageUrl) : null;
    const requestReview = body?.requestReview === true;

    if (title.length > MAX_TITLE) {
      return fail(ctx, 400, "TITULO_DEMASIADO_LONGO");
    }
    if (bio.length > MAX_BIO) {
      return fail(ctx, 400, "BIO_DEMASIADO_LONGA");
    }

    const specialties = parseSpecialties(body?.specialties);

    const reviewStatus = requestReview ? TrainerProfileReviewStatus.PENDING : TrainerProfileReviewStatus.DRAFT;
    const now = new Date();

    const profile = await prisma.trainerProfile.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: {
        title: title || null,
        bio: bio || null,
        specialties,
        certifications: certifications || null,
        experienceYears,
        coverImageUrl: coverImageUrl || null,
        isPublished: false,
        reviewStatus,
        reviewRequestedAt: requestReview ? now : null,
        reviewNote: null,
        reviewedAt: null,
        reviewedByUserId: null,
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        title: title || null,
        bio: bio || null,
        specialties,
        certifications: certifications || null,
        experienceYears,
        coverImageUrl: coverImageUrl || null,
        isPublished: false,
        reviewStatus,
        reviewRequestedAt: requestReview ? now : null,
      },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        organization: { select: { id: true, username: true, publicName: true } },
      },
    });

    if (requestReview) {
      const trainersHref = appendOrganizationIdToHref("/organizacao/treinadores", organization.id);
      await createNotification({
        userId: user.id,
        type: NotificationType.SYSTEM_ANNOUNCE,
        title: "Perfil enviado para revisão",
        body: `O teu perfil de treinador foi enviado para revisão pela organização ${organization.publicName ?? "ORYA"}.`,
        ctaUrl: trainersHref,
        ctaLabel: "Ver perfil",
        organizationId: organization.id,
      }).catch((err) => console.warn("[trainer][review-request] notification fail", err));
    }

    return respondOk(ctx, { profile }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/trainers/profile][PATCH]", err);
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
