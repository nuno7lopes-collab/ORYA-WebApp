export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { canManageEvents } from "@/lib/organizationPermissions";
import { padel_format, EventTemplateType, EventPublicAccessMode, EventParticipantAccessMode } from "@prisma/client";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);

const generateUniqueSlug = async (base: string) => {
  const existing = await prisma.event.findMany({
    where: { slug: { startsWith: base } },
    select: { slug: true },
  });
  const slugs = new Set(existing.map((row) => row.slug));
  if (!slugs.has(base)) return base;
  let suffix = 2;
  while (slugs.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

type MixPayload = {
  title?: string;
  startsAt?: string;
  durationMinutes?: number;
  teamsCount?: number;
  format?: "NON_STOP" | "FASE_FINALS";
  locationName?: string;
  locationCity?: string;
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    const body = (await req.json().catch(() => null)) as MixPayload | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: "BODY_INVALID" }, { status: 400 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });
    if (!organization || !membership || !canManageEvents(membership.role)) {
      return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const title = body.title?.trim() || "Mix rápido";
    const startsAtRaw = body.startsAt ? new Date(body.startsAt) : null;
    if (!startsAtRaw || Number.isNaN(startsAtRaw.getTime())) {
      return NextResponse.json({ ok: false, error: "START_REQUIRED" }, { status: 400 });
    }

    const durationMinutes = Math.min(300, Math.max(60, Math.round(Number(body.durationMinutes ?? 180))));
    const teamsCount = Math.min(8, Math.max(2, Math.round(Number(body.teamsCount ?? 8))));
    const endsAt = new Date(startsAtRaw.getTime() + durationMinutes * 60 * 1000);
    const locationName = body.locationName?.trim() || organization.publicName || "Mix rápido";
    const locationCity = body.locationCity?.trim() || organization.city || "Lisboa";

    const format =
      body.format === "FASE_FINALS" ? padel_format.GRUPOS_ELIMINATORIAS : padel_format.NON_STOP;

    const categoryLabel = "Mix rápido";
    let category = await prisma.padelCategory.findFirst({
      where: { organizationId: organization.id, label: categoryLabel },
    });
    if (!category) {
      category = await prisma.padelCategory.create({
        data: {
          organizationId: organization.id,
          label: categoryLabel,
          genderRestriction: "MIXED",
          isActive: true,
        },
      });
    }

    const groupsConfig =
      body.format === "FASE_FINALS"
        ? {
            mode: "AUTO",
            groupCount: 2,
            groupSize: Math.ceil(teamsCount / 2),
            qualifyPerGroup: 2,
            extraQualifiers: 0,
            seeding: "SNAKE",
          }
        : null;

    const baseSlug = slugify(title) || "mix";
    const slug = await generateUniqueSlug(baseSlug);

    const event = await prisma.event.create({
      data: {
        title,
        slug,
        description: "Mix rápido de padel (community games).",
        templateType: EventTemplateType.PADEL,
        status: "PUBLISHED",
        publicAccessMode: EventPublicAccessMode.OPEN,
        participantAccessMode: EventParticipantAccessMode.NONE,
        isFree: true,
        inviteOnly: false,
        locationName,
        locationCity,
        startsAt: startsAtRaw,
        endsAt,
        timezone: organization.language === "en" ? "Europe/Lisbon" : "Europe/Lisbon",
        ownerUserId: user.id,
        organizationId: organization.id,
      },
      select: { id: true, slug: true },
    });

    await prisma.$transaction([
      prisma.padelTournamentConfig.create({
        data: {
          eventId: event.id,
          organizationId: organization.id,
          format,
          numberOfCourts: 1,
          defaultCategoryId: category.id,
          advancedSettings: {
            mixMode: true,
            mixTeamsCount: teamsCount,
            competitionState: "PUBLIC",
            ...(groupsConfig ? { groupsConfig } : {}),
          },
        },
      }),
      prisma.padelEventCategoryLink.create({
        data: {
          eventId: event.id,
          padelCategoryId: category.id,
          capacityTeams: teamsCount,
          format,
          isEnabled: true,
        },
      }),
    ]);

    return NextResponse.json({ ok: true, eventId: event.id, slug: event.slug }, { status: 200 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("[padel/mix/create]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
