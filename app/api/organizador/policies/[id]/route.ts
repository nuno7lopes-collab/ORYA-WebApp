import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizerForUser } from "@/lib/organizerContext";
import { resolveOrganizerIdFromRequest } from "@/lib/organizerId";
import { OrganizerMemberRole, OrganizationPolicyType } from "@prisma/client";

const ALLOWED_ROLES: OrganizerMemberRole[] = [
  OrganizerMemberRole.OWNER,
  OrganizerMemberRole.CO_OWNER,
  OrganizerMemberRole.ADMIN,
  OrganizerMemberRole.STAFF,
];

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

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(profile.id, {
      organizerId: organizerId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });
    if (!organizer || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const existing = await prisma.organizationPolicy.findFirst({
      where: { id: policyId, organizerId: organizer.id },
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

    return NextResponse.json({ ok: true, policy });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("PATCH /api/organizador/policies/[id] error:", err);
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

    const organizerId = resolveOrganizerIdFromRequest(req);
    const { organizer, membership } = await getActiveOrganizerForUser(profile.id, {
      organizerId: organizerId ?? undefined,
      roles: [...ALLOWED_ROLES],
    });
    if (!organizer || !membership) {
      return NextResponse.json({ ok: false, error: "Sem permissões." }, { status: 403 });
    }

    const policy = await prisma.organizationPolicy.findFirst({
      where: { id: policyId, organizerId: organizer.id },
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("DELETE /api/organizador/policies/[id] error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao remover política." }, { status: 500 });
  }
}
