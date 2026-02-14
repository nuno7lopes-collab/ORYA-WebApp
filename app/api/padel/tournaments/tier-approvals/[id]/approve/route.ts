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

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const resolved = await params;
  const approvalId = Number(resolved?.id);
  if (!Number.isFinite(approvalId)) return jsonWrap({ ok: false, error: "INVALID_APPROVAL" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const approval = await prisma.padelTournamentTierApproval.findUnique({
    where: { id: approvalId },
    select: { id: true, eventId: true, organizationId: true, requestedTier: true },
  });
  if (!approval) return jsonWrap({ ok: false, error: "APPROVAL_NOT_FOUND" }, { status: 404 });

  const { organization, membership } = await getActiveOrganizationForUser(user.id, {
    organizationId: approval.organizationId,
    roles: ROLE_ALLOWLIST,
  });
  if (!organization || !membership) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const permission = await ensureMemberModuleAccess({
    organizationId: approval.organizationId,
    userId: user.id,
    role: membership.role,
    rolePack: membership.rolePack,
    moduleKey: OrganizationModule.TORNEIOS,
    required: "EDIT",
  });
  if (!permission.ok) return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const approvedTier = normalizeTier(body.approvedTier) ?? normalizeTier(approval.requestedTier);
  if (!approvedTier || !TIER_REQUIRE_APPROVAL.has(approvedTier)) {
    return jsonWrap({ ok: false, error: "INVALID_TIER" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() || null : null;

  const updated = await prisma.$transaction(async (tx) => {
    const config = await tx.padelTournamentConfig.findUnique({
      where: { eventId: approval.eventId },
      select: { id: true, advancedSettings: true },
    });
    if (config) {
      const advanced = { ...((config.advancedSettings as Prisma.JsonObject | null) ?? {}) };
      advanced.tournamentTier = approvedTier;
      await tx.padelTournamentConfig.update({
        where: { id: config.id },
        data: { advancedSettings: advanced as Prisma.InputJsonValue },
      });
    }

    return tx.padelTournamentTierApproval.update({
      where: { id: approval.id },
      data: {
        status: "APPROVED",
        approvedTier,
        reason,
        approvedByUserId: user.id,
        approvedAt: new Date(),
      },
    });
  });

  return jsonWrap({ ok: true, approval: updated }, { status: 200 });
}

export const POST = withApiEnvelope(_POST);
