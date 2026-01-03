export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, padel_format } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { parseOrganizationId } from "@/lib/organizationId";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const eventId = Number(req.nextUrl.searchParams.get("eventId"));
  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  // Garantir que o requester tem permissão no organization deste evento
  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { organizationId: true },
  });
  if (!event?.organizationId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: allowedRoles,
  });
  if (!organization || !membership) return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const config = await prisma.padelTournamentConfig.findUnique({
    where: { eventId },
    include: {
      ruleSet: true,
      category: true,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      config: config
        ? {
            ...config,
            organizationId: config.organizationId,
          }
        : null,
    },
    { status: 200 },
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const organizationIdBody = parseOrganizationId(body.organizationId);
  const format =
    typeof body.format === "string" && Object.values(padel_format).includes(body.format as padel_format)
      ? (body.format as padel_format)
      : null;
  const numberOfCourts = typeof body.numberOfCourts === "number" ? body.numberOfCourts : 1;
  const ruleSetId = typeof body.ruleSetId === "number" ? body.ruleSetId : null;
  const defaultCategoryId = typeof body.defaultCategoryId === "number" ? body.defaultCategoryId : null;
  const enabledFormats = Array.isArray(body.enabledFormats)
    ? (body.enabledFormats as unknown[]).map((f) => String(f))
    : null;
  const groupsConfig =
    body.groups && typeof body.groups === "object"
      ? {
          mode: (body.groups as any).mode === "MANUAL" ? "MANUAL" : "AUTO",
          groupCount: Number((body.groups as any).groupCount),
          groupSize: Number((body.groups as any).groupSize),
          qualifyPerGroup: Number((body.groups as any).qualifyPerGroup),
          seeding: (body.groups as any).seeding === "NONE" ? "NONE" : "SNAKE",
        }
      : null;

  if (!Number.isFinite(eventId) || !organizationIdBody || !format) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
  }

  const { organization } = await getActiveOrganizationForUser(user.id, {
    organizationId: organizationIdBody,
    roles: allowedRoles,
  });
  if (!organization || organization.id !== organizationIdBody) {
    return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  }

  // Formatos suportados (alinhados com geração de jogos)
  const allowedFormats = new Set<padel_format>([
    padel_format.TODOS_CONTRA_TODOS,
    padel_format.QUADRO_ELIMINATORIO,
    padel_format.GRUPOS_ELIMINATORIAS,
  ]);
  if (!allowedFormats.has(format)) {
    return NextResponse.json({ ok: false, error: "FORMAT_NOT_SUPPORTED" }, { status: 400 });
  }

  const formatEffective = format;

  try {
    const existing = await prisma.padelTournamentConfig.findUnique({
      where: { eventId },
      select: { advancedSettings: true },
    });
    const mergedAdvanced = {
      ...((existing?.advancedSettings as Record<string, unknown>) ?? {}),
      ...(groupsConfig ? { groupsConfig } : {}),
      formatRequested: format,
      formatEffective,
      generationVersion: "v1-groups-ko",
    };

    const config = await prisma.padelTournamentConfig.upsert({
      where: { eventId },
      create: {
        eventId,
        organizationId: organizationIdBody,
        numberOfCourts: Math.max(1, numberOfCourts || 1),
        ruleSetId: ruleSetId || undefined,
        defaultCategoryId: defaultCategoryId || undefined,
        enabledFormats: enabledFormats?.filter((f) => allowedFormats.has(f as padel_format)) ?? undefined,
        advancedSettings: mergedAdvanced,
        format: formatEffective,
      },
      update: {
        format: formatEffective,
        numberOfCourts: Math.max(1, numberOfCourts || 1),
        ruleSetId: ruleSetId || undefined,
        defaultCategoryId: defaultCategoryId || undefined,
        enabledFormats: enabledFormats?.filter((f) => allowedFormats.has(f as padel_format)) ?? undefined,
        advancedSettings: mergedAdvanced,
      },
    });

    return NextResponse.json({ ok: true, config }, { status: 200 });
  } catch (err) {
    console.error("[padel/tournaments/config][POST]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
