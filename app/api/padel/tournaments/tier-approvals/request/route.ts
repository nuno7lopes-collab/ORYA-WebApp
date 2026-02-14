export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationMemberRole, OrganizationModule, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = ["OWNER", "CO_OWNER", "ADMIN"];
const TIER_REQUIRE_APPROVAL = new Set(["OURO", "MAJOR"]);

function normalizeTier(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "GOLD") return "OURO";
  return normalized;
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const eventId = typeof body.eventId === "number" ? body.eventId : Number(body.eventId);
  if (!Number.isFinite(eventId)) return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });

  const requestedTier = normalizeTier(body.tier);
  if (!requestedTier) return jsonWrap({ ok: false, error: "INVALID_TIER" }, { status: 400 });
  if (!TIER_REQUIRE_APPROVAL.has(requestedTier)) {
    return jsonWrap({ ok: false, error: "TIER_APPROVAL_NOT_REQUIRED" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId, isDeleted: false },
    select: { id: true, organizationId: true, templateType: true },
  });
  const organizationId = event?.organizationId;
  if (!event || organizationId == null || event.templateType !== "PADEL") {
    return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
  }

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const permission = await ensureMemberModuleAccess({
    organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;

  const approval = await prisma.$transaction(async (tx) => {
    const existingConfig = await tx.padelTournamentConfig.findUnique({
      where: { eventId: event.id },
      select: { id: true, advancedSettings: true },
    });
    if (!existingConfig) {
      throw new Error("TOURNAMENT_CONFIG_NOT_FOUND");
    }

    const advanced = { ...((existingConfig.advancedSettings as Prisma.JsonObject | null) ?? {}) };
    advanced.tournamentTier = requestedTier;

    await tx.padelTournamentConfig.update({
      where: { id: existingConfig.id },
      data: { advancedSettings: advanced as Prisma.InputJsonValue },
    });

    return tx.padelTournamentTierApproval.upsert({
      where: { eventId: event.id },
      create: {
        organizationId,
        eventId: event.id,
        requestedTier,
        status: "PENDING",
        reason,
        requestedByUserId: user.id,
        metadata: {
          requestedVia: "api",
        },
      },
      update: {
        requestedTier,
        approvedTier: null,
        status: "PENDING",
        reason,
        requestedByUserId: user.id,
        approvedByUserId: null,
        approvedAt: null,
      },
    });
  });

  return jsonWrap({ ok: true, approval }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
