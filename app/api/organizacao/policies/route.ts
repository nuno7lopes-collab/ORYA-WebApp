import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureDefaultPolicies } from "@/lib/organizationPolicies";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { ensureOrganizationEmailVerified } from "@/lib/organizationWriteAccess";
import { OrganizationMemberRole, OrganizationPolicyType } from "@prisma/client";

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }
    const emailGate = ensureOrganizationEmailVerified(organization);
    if (!emailGate.ok) {
      return NextResponse.json({ ok: false, error: emailGate.error }, { status: 403 });
    }

    await ensureDefaultPolicies(prisma, organization.id);

    const items = await prisma.organizationPolicy.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        policyType: true,
        cancellationWindowMinutes: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/policies error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar políticas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
    });

    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
    });

    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const name = String(payload?.name ?? "").trim();
    const policyTypeRaw = String(payload?.policyType ?? "CUSTOM").trim().toUpperCase();
    const policyType = Object.values(OrganizationPolicyType).includes(policyTypeRaw as OrganizationPolicyType)
      ? (policyTypeRaw as OrganizationPolicyType)
      : OrganizationPolicyType.CUSTOM;
    const cancellationWindowMinutes =
      payload?.cancellationWindowMinutes === null
        ? null
        : Number.isFinite(Number(payload?.cancellationWindowMinutes))
          ? Math.max(0, Math.round(Number(payload.cancellationWindowMinutes)))
          : null;

    if (!name) {
      return NextResponse.json({ ok: false, error: "Nome é obrigatório." }, { status: 400 });
    }

    const policy = await prisma.organizationPolicy.create({
      data: {
        organizationId: organization.id,
        name,
        policyType,
        cancellationWindowMinutes,
      },
      select: {
        id: true,
        name: true,
        policyType: true,
        cancellationWindowMinutes: true,
      },
    });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "POLICY_CREATED",
      metadata: {
        policyId: policy.id,
        name: policy.name,
        policyType: policy.policyType,
        cancellationWindowMinutes: policy.cancellationWindowMinutes,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true, policy }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/policies error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar política." }, { status: 500 });
  }
}
