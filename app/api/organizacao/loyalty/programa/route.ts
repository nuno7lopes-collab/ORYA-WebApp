import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { LoyaltyProgramStatus, OrganizationMemberRole } from "@prisma/client";
import { LOYALTY_GUARDRAILS } from "@/lib/loyalty/guardrails";

const READ_ROLES = Object.values(OrganizationMemberRole);

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "VIEW",
    });
    if (!crmAccess.ok) {
      return NextResponse.json({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const program = await prisma.loyaltyProgram.findUnique({
      where: { organizationId: organization.id },
      include: {
        rules: true,
        rewards: true,
      },
    });

    return NextResponse.json({ ok: true, program, guardrails: LOYALTY_GUARDRAILS });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/loyalty/programa error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar programa." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...READ_ROLES],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const crmAccess = await ensureCrmModuleAccess(organization, prisma, {
      member: { userId: membership.userId, role: membership.role },
      required: "EDIT",
    });
    if (!crmAccess.ok) {
      return NextResponse.json({ ok: false, error: crmAccess.error }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as {
      status?: unknown;
      name?: unknown;
      pointsName?: unknown;
      pointsExpiryDays?: unknown;
      termsUrl?: unknown;
    } | null;

    const status =
      typeof payload?.status === "string" && Object.values(LoyaltyProgramStatus).includes(payload.status as LoyaltyProgramStatus)
        ? (payload.status as LoyaltyProgramStatus)
        : LoyaltyProgramStatus.ACTIVE;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "Pontos ORYA";
    const pointsName = typeof payload?.pointsName === "string" ? payload.pointsName.trim() : "Pontos";
    const rawExpiryDays =
      typeof payload?.pointsExpiryDays === "number" && Number.isFinite(payload.pointsExpiryDays)
        ? payload.pointsExpiryDays
        : null;
    const pointsExpiryDays = rawExpiryDays !== null && rawExpiryDays >= 1 ? Math.floor(rawExpiryDays) : null;
    const termsUrl = typeof payload?.termsUrl === "string" ? payload.termsUrl.trim() : null;

    const program = await prisma.loyaltyProgram.upsert({
      where: { organizationId: organization.id },
      update: {
        status,
        name,
        pointsName,
        pointsExpiryDays,
        termsUrl,
      },
      create: {
        organizationId: organization.id,
        status,
        name,
        pointsName,
        pointsExpiryDays,
        termsUrl,
      },
    });

    return NextResponse.json({ ok: true, program, guardrails: LOYALTY_GUARDRAILS });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("PUT /api/organizacao/loyalty/programa error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao guardar programa." }, { status: 500 });
  }
}
