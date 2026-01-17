export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { OrganizationMemberRole, padel_format } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { autoGeneratePadelMatches } from "@/domain/padel/autoGenerateMatches";

const allowedRoles: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  const categoryId = typeof body.categoryId === "number" ? body.categoryId : Number(body.categoryId);
  const phase = typeof body.phase === "string" ? body.phase.toUpperCase() : "GROUPS";
  const format: padel_format =
    typeof body.format === "string" && Object.values(padel_format).includes(body.format as padel_format)
      ? (body.format as padel_format)
      : padel_format.TODOS_CONTRA_TODOS;
  const allowIncomplete = body.allowIncomplete === true;

  if (!Number.isFinite(eventId)) return NextResponse.json({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true },
  });
  if (!event || !event.organizationId) return NextResponse.json({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });

  const resolvedCategoryId = Number.isFinite(categoryId) ? categoryId : null;
  if (resolvedCategoryId) {
    const link = await prisma.padelEventCategoryLink.findFirst({
      where: { eventId, padelCategoryId: resolvedCategoryId, isEnabled: true },
      select: { id: true },
    });
    if (!link) {
      return NextResponse.json({ ok: false, error: "CATEGORY_NOT_AVAILABLE" }, { status: 400 });
    }
  }
  const matchCategoryFilter = resolvedCategoryId ? { categoryId: resolvedCategoryId } : {};

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: event.organizationId,
    roles: allowedRoles,
  });
  if (!organization) return NextResponse.json({ ok: false, error: "NO_ORGANIZATION" }, { status: 403 });
  const phaseNormalized = phase === "KNOCKOUT" ? "KNOCKOUT" : "GROUPS";
  const isGroupsFormat = format === "GRUPOS_ELIMINATORIAS";
  const existingPolicy = isGroupsFormat ? "error" : "replace";
  const notifyUsers = !isGroupsFormat || phaseNormalized === "KNOCKOUT";

  if (isGroupsFormat && phaseNormalized === "KNOCKOUT" && allowIncomplete) {
    if (membership?.role && !["OWNER", "CO_OWNER"].includes(membership.role)) {
      return NextResponse.json({ ok: false, error: "OVERRIDE_NOT_ALLOWED" }, { status: 403 });
    }
  }

  const result = await autoGeneratePadelMatches({
    eventId,
    categoryId: resolvedCategoryId ?? null,
    format,
    phase: isGroupsFormat ? phaseNormalized : undefined,
    allowIncomplete,
    existingPolicy,
    notifyUsers,
    actorUserId: user.id,
    auditAction: "PADEL_MATCHES_GENERATED",
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error ?? "GENERATION_FAILED" }, { status: 400 });
  }

  if (isGroupsFormat && phaseNormalized !== "KNOCKOUT") {
    return NextResponse.json(
      {
        ok: true,
        stage: "GROUPS",
        groups: result.groups ?? [],
        qualifyPerGroup: result.qualifyPerGroup ?? 2,
        extraQualifiers: result.extraQualifiers ?? 0,
        matches: result.matches ?? 0,
        formatEffective: result.formatEffective ?? format,
        generationVersion: result.generationVersion ?? "v1-groups-ko",
      },
      { status: 200 },
    );
  }

  if (isGroupsFormat && phaseNormalized === "KNOCKOUT") {
    return NextResponse.json(
      {
        ok: true,
        stage: "KNOCKOUT",
        qualifiers: result.qualifiers ?? 0,
        matches: result.matches ?? 0,
        formatEffective: result.formatEffective ?? format,
        generationVersion: result.generationVersion ?? "v1-groups-ko",
        koGeneratedAt: result.koGeneratedAt ?? null,
        koSeedSnapshot: result.koSeedSnapshot ?? [],
      },
      { status: 200 },
    );
  }

  const matches = await prisma.padelMatch.findMany({
    where: { eventId, ...matchCategoryFilter },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({ ok: true, matches }, { status: 200 });
}
