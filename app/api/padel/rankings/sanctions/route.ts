export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { OrganizationModule, PadelRatingSanctionType } from "@prisma/client";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { resolveOrganizationIdStrict } from "@/lib/organizationId";
import { recordOrganizationAuditSafe } from "@/lib/organizationAudit";
import { applyPadelRatingSanction } from "@/domain/padel/ratingEngine";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function parseSanctionType(value: unknown): PadelRatingSanctionType | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return Object.values(PadelRatingSanctionType).includes(normalized as PadelRatingSanctionType)
    ? (normalized as PadelRatingSanctionType)
    : null;
}

async function _POST(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return jsonWrap({ ok: false, error: "INVALID_BODY" }, { status: 400 });

  const orgResolution = resolveOrganizationIdStrict({
    req,
    body,
    allowFallback: false,
  });
  if (!orgResolution.ok && orgResolution.reason === "MISSING") {
    return jsonWrap({ ok: false, error: "ORGANIZATION_ID_REQUIRED" }, { status: 400 });
  }
  if (!orgResolution.ok && orgResolution.reason === "CONFLICT") {
    return jsonWrap({ ok: false, error: "ORGANIZATION_ID_CONFLICT" }, { status: 400 });
  }
  if (!orgResolution.ok && orgResolution.reason === "INVALID") {
    return jsonWrap({ ok: false, error: "INVALID_ORGANIZATION_ID" }, { status: 400 });
  }
  if (!orgResolution.ok) {
    return jsonWrap({ ok: false, error: "ORGANIZATION_ID_REQUIRED" }, { status: 400 });
  }

  const organizationId = orgResolution.organizationId;
  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId,
    roles: ["OWNER", "CO_OWNER", "ADMIN"],
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

  const playerId = parsePositiveInt(body.playerId);
  if (!playerId) return jsonWrap({ ok: false, error: "PLAYER_ID_REQUIRED" }, { status: 400 });

  const player = await prisma.padelPlayerProfile.findFirst({
    where: {
      id: playerId,
      organizationId,
    },
    select: {
      id: true,
      fullName: true,
    },
  });
  if (!player) return jsonWrap({ ok: false, error: "PLAYER_NOT_FOUND" }, { status: 404 });

  const type = parseSanctionType(body.type);
  if (!type) return jsonWrap({ ok: false, error: "INVALID_SANCTION_TYPE" }, { status: 400 });

  const reasonCodeRaw = typeof body.reasonCode === "string" ? body.reasonCode.trim().toUpperCase() : "";
  const reasonCode = reasonCodeRaw.length > 0 ? reasonCodeRaw : null;
  if (reasonCode && !/^[A-Z0-9_]{3,64}$/.test(reasonCode)) {
    return jsonWrap({ ok: false, error: "INVALID_REASON_CODE" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" && body.reason.trim().length > 0 ? body.reason.trim() : null;
  const durationDaysRaw = parsePositiveInt(body.durationDays);
  const durationDays = durationDaysRaw ? Math.min(durationDaysRaw, 365) : null;

  const sanction = await prisma.$transaction((tx) =>
    applyPadelRatingSanction({
      tx,
      organizationId,
      playerId: player.id,
      type,
      reasonCode,
      reason,
      actorUserId: user.id,
      durationDays,
    }),
  );

  await recordOrganizationAuditSafe({
    organizationId,
    actorUserId: user.id,
    action: "PADEL_RATING_SANCTION_APPLIED",
    entityType: "padel_rating_sanction",
    entityId: String(sanction.id),
    metadata: {
      playerId: player.id,
      playerName: player.fullName,
      sanctionType: sanction.type,
      sanctionStatus: sanction.status,
      reasonCode: sanction.reasonCode ?? null,
      durationDays,
      startsAt: sanction.startsAt,
      endsAt: sanction.endsAt,
    },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: req.headers.get("user-agent") || null,
  });

  return jsonWrap({ ok: true, sanction }, { status: 201 });
}

export const POST = withApiEnvelope(_POST);
