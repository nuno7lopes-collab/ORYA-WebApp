import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { OrganizationMemberRole, OrganizationPolicyType } from "@prisma/client";

const ALLOWED_ROLES: OrganizationMemberRole[] = [
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

function parsePolicyId(raw: string) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const policyId = parsePolicyId(params.id);
  if (!policyId) {
    return NextResponse.json({ ok: false, error: "Política inválida." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });
    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const existing = await prisma.organizationPolicy.findFirst({
      where: { id: policyId, organizationId: organization.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Política não encontrada." }, { status: 404 });
    }

    const payload = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof payload?.name === "string") updates.name = payload.name.trim();
    if (payload?.cancellationWindowMinutes === null) {
      updates.cancellationWindowMinutes = null;
    } else if (Number.isFinite(Number(payload?.cancellationWindowMinutes))) {
      updates.cancellationWindowMinutes = Math.max(0, Math.round(Number(payload.cancellationWindowMinutes)));
    }
    if (typeof payload?.policyType === "string") {
      const raw = payload.policyType.trim().toUpperCase();
      if (Object.values(OrganizationPolicyType).includes(raw as OrganizationPolicyType)) {
        updates.policyType = raw as OrganizationPolicyType;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: false, error: "Sem alterações." }, { status: 400 });
    }

    const policy = await prisma.organizationPolicy.update({
      where: { id: policyId },
      data: updates,
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
      action: "POLICY_UPDATED",
      metadata: {
        policyId: policy.id,
        updates,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizacao/policies/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao atualizar política." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const policyId = parsePolicyId(params.id);
  if (!policyId) {
    return NextResponse.json({ ok: false, error: "Política inválida." }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({ where: { id: user.id } });
    if (!profile) {
      return NextResponse.json({ ok: false, error: "Perfil não encontrado." }, { status: 403 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });
    if (!organization || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const policy = await prisma.organizationPolicy.findFirst({
      where: { id: policyId, organizationId: organization.id },
      select: {
        id: true,
        policyType: true,
        _count: { select: { bookingPolicyRefs: true, services: true } },
      },
    });
    if (!policy) {
      return NextResponse.json({ ok: false, error: "Política não encontrada." }, { status: 404 });
    }

    if (policy.policyType !== OrganizationPolicyType.CUSTOM) {
      return NextResponse.json({ ok: false, error: "Só podes apagar políticas personalizadas." }, { status: 400 });
    }

    if (policy._count.bookingPolicyRefs > 0 || policy._count.services > 0) {
      return NextResponse.json({ ok: false, error: "Política em uso." }, { status: 409 });
    }

    await prisma.organizationPolicy.delete({ where: { id: policy.id } });

    const { ip, userAgent } = getRequestMeta(req);
    await recordOrganizationAudit(prisma, {
      organizationId: organization.id,
      actorUserId: profile.id,
      action: "POLICY_DELETED",
      metadata: {
        policyId: policy.id,
        policyType: policy.policyType,
      },
      ip,
      userAgent,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizacao/policies/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover política." }, { status: 500 });
  }
}
