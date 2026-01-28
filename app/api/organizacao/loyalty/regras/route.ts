import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { LoyaltyRuleTrigger, OrganizationMemberRole } from "@prisma/client";
import { validateLoyaltyRuleLimits } from "@/lib/loyalty/guardrails";
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

    const rules = program
      ? await prisma.loyaltyRule.findMany({
          where: { programId: program.id },
          orderBy: { createdAt: "desc" },
        })
      : [];

    return jsonWrap({ ok: true, items: rules });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/loyalty/regras error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar regras." }, { status: 500 });
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
      trigger?: unknown;
      points?: unknown;
      maxPointsPerDay?: unknown;
      maxPointsPerUser?: unknown;
      conditions?: unknown;
      isActive?: unknown;
    } | null;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "Regra";
    const trigger =
      typeof payload?.trigger === "string" && Object.values(LoyaltyRuleTrigger).includes(payload.trigger as LoyaltyRuleTrigger)
        ? (payload.trigger as LoyaltyRuleTrigger)
        : null;

    const rawPoints = typeof payload?.points === "number" && Number.isFinite(payload.points) ? payload.points : null;
    const points = rawPoints !== null ? Math.floor(rawPoints) : null;
    if (!trigger || points === null || points < 1) {
      return jsonWrap({ ok: false, error: "Trigger ou pontos inválidos." }, { status: 400 });
    }

    const maxPointsPerDayRaw =
      typeof payload?.maxPointsPerDay === "number" && Number.isFinite(payload.maxPointsPerDay)
        ? payload.maxPointsPerDay
        : null;
    const maxPointsPerUserRaw =
      typeof payload?.maxPointsPerUser === "number" && Number.isFinite(payload.maxPointsPerUser)
        ? payload.maxPointsPerUser
        : null;
    if ((maxPointsPerDayRaw ?? 0) < 0 || (maxPointsPerUserRaw ?? 0) < 0) {
      return jsonWrap({ ok: false, error: "Limites inválidos." }, { status: 400 });
    }
    const maxPointsPerDay =
      maxPointsPerDayRaw !== null && maxPointsPerDayRaw >= 1 ? Math.floor(maxPointsPerDayRaw) : null;
    const maxPointsPerUser =
      maxPointsPerUserRaw !== null && maxPointsPerUserRaw >= 1 ? Math.floor(maxPointsPerUserRaw) : null;
    const isActive = typeof payload?.isActive === "boolean" ? payload.isActive : true;
    const conditions = payload?.conditions && typeof payload.conditions === "object" ? payload.conditions : {};

    const guardrails = validateLoyaltyRuleLimits({ points, maxPointsPerDay, maxPointsPerUser });
    if (!guardrails.ok) {
      return jsonWrap({ ok: false, error: guardrails.error }, { status: 400 });
    }

    const rule = await prisma.loyaltyRule.create({
      data: {
        programId: program.id,
        name,
        trigger,
        points,
        maxPointsPerDay,
        maxPointsPerUser,
        conditions: conditions as any,
        isActive,
      },
    });

    return jsonWrap({ ok: true, rule });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/organizacao/loyalty/regras error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar regra." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);