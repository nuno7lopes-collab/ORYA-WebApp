import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { OrganizationMemberRole } from "@prisma/client";
import { normalizeSegmentDefinition } from "@/lib/crm/segments";

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

    const segments = await prisma.crmSegment.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        sizeCache: true,
        lastComputedAt: true,
        createdAt: true,
        updatedAt: true,
        createdByUserId: true,
      },
    });

    return NextResponse.json({ ok: true, items: segments });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/crm/segmentos error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar segmentos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
      name?: unknown;
      description?: unknown;
      rules?: unknown;
    } | null;

    const name = typeof payload?.name === "string" ? payload.name.trim() : "";
    if (name.length < 2) {
      return NextResponse.json({ ok: false, error: "Nome inválido." }, { status: 400 });
    }

    const description = typeof payload?.description === "string" ? payload.description.trim() : null;
    const rules = normalizeSegmentDefinition(payload?.rules ?? null);

    const segment = await prisma.crmSegment.create({
      data: {
        organizationId: organization.id,
        name,
        description,
        rules: rules as any,
        createdByUserId: user.id,
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        sizeCache: true,
        lastComputedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ ok: true, segment });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("POST /api/organizacao/crm/segmentos error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar segmento." }, { status: 500 });
  }
}
