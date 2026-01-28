import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { LoyaltyRewardType, OrganizationMemberRole } from "@prisma/client";
import { validateLoyaltyRewardLimits } from "@/lib/loyalty/guardrails";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const READ_ROLES = Object.values(OrganizationMemberRole);

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "VIEW",
    });
    if (!crmAccess.ok) {
      return jsonWrap({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const program = await prisma.loyaltyProgram.findUnique({
      where: { organizationId: organization.id },
      select: { id: true },
    });

    const rewards = program
      ? await prisma.loyaltyReward.findMany({
          where: { programId: program.id },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return jsonWrap({ ok: true, items: rewards });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/loyalty/recompensas error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar recompensas." }, { status: 500 });
  }
}

async function _POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return jsonWrap({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const program = await prisma.loyaltyProgram.findUnique({
      where: { organizationId: organization.id },
      select: { id: true },
    });

    if (!program) {
      return jsonWrap({ ok: false, error: "Programa não configurado." }, { status: 400 });
    }

    const payload = (await req.json().catch(() => null)) as {
      name?: unknown;
      type?: unknown;
      pointsCost?: unknown;
      stock?: unknown;
      payload?: unknown;
      isActive?: unknown;
    } | null;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "Recompensa";
    const type =
      typeof payload?.type === "string" && Object.values(LoyaltyRewardType).includes(payload.type as LoyaltyRewardType)
        ? (payload.type as LoyaltyRewardType)
        : null;
    const rawPointsCost =
      typeof payload?.pointsCost === "number" && Number.isFinite(payload.pointsCost) ? payload.pointsCost : null;
    const pointsCost = rawPointsCost !== null ? Math.floor(rawPointsCost) : null;

    if (!type || pointsCost === null || pointsCost < 1) {
      return jsonWrap({ ok: false, error: "Tipo ou custo inválido." }, { status: 400 });
    }
    const guardrails = validateLoyaltyRewardLimits({ pointsCost });
    if (!guardrails.ok) {
      return jsonWrap({ ok: false, error: guardrails.error }, { status: 400 });
    }

    const stockRaw = typeof payload?.stock === "number" && Number.isFinite(payload.stock) ? payload.stock : null;
    if (stockRaw !== null && stockRaw < 0) {
      return jsonWrap({ ok: false, error: "Stock inválido." }, { status: 400 });
    }
    const stock = stockRaw !== null ? Math.floor(stockRaw) : null;
    const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : true;
    const rewardPayload = payload?.payload && typeof payload.payload === "object" ? payload.payload : {};

    const reward = await prisma.loyaltyReward.create({
      data: {
        programId: program.id,
        name,
        type,
        pointsCost,
        stock,
        payload: rewardPayload as any,
        isActive,
      },
    });

    return jsonWrap({ ok: true, reward });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/organizacao/loyalty/recompensas error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar recompensa." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);