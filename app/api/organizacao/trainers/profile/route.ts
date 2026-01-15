import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { OrganizationMemberRole, NotificationType, TrainerProfileReviewStatus } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId } from "@/lib/organizationId";
import { createNotification } from "@/lib/notifications";
import { normalizeProfileCoverUrl } from "@/lib/profileMedia";

const ALLOWED_ROLES: OrganizationMemberRole[] = [
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

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const organizationId = parseOrganizationId(url.searchParams.get("organizationId"));

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ALLOWED_ROLES,
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const profile = await prisma.trainerProfile.findUnique({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      include: {
        user: { select: { id: true, fullName: true, username: true, avatarUrl: true } },
        organization: { select: { id: true, username: true, publicName: true } },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        profile,
        organization: profile?.organization ?? organization,
        user: profile?.user ?? null,
        role: membership.role,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[organizacao/trainers/profile][GET]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const organizationId = parseOrganizationId(body?.organizationId);

    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ALLOWED_ROLES,
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    if (membership.role !== OrganizationMemberRole.TRAINER) {
      return NextResponse.json({ ok: false, error: "ONLY_TRAINER_CAN_EDIT" }, { status: 403 });
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
      return NextResponse.json({ ok: false, error: "TITULO_DEMASIADO_LONGO" }, { status: 400 });
    }
    if (bio.length > MAX_BIO) {
      return NextResponse.json({ ok: false, error: "BIO_DEMASIADO_LONGA" }, { status: 400 });
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
      await createNotification({
        userId: user.id,
        type: NotificationType.SYSTEM_ANNOUNCE,
        title: "Perfil enviado para revisão",
        body: `O teu perfil de treinador foi enviado para revisão pela organização ${organization.publicName ?? "ORYA"}.`,
        ctaUrl: "/organizacao/treinadores",
        ctaLabel: "Ver perfil",
        organizationId: organization.id,
      }).catch((err) => console.warn("[trainer][review-request] notification fail", err));
    }

    return NextResponse.json({ ok: true, profile }, { status: 200 });
  } catch (err) {
    console.error("[organizacao/trainers/profile][PATCH]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
