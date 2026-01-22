import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { OrganizationMemberRole } from "@prisma/client";
import { resolveSegmentUserIds } from "@/lib/crm/segmentQuery";

const ALLOWED_ROLES = Object.values(OrganizationMemberRole);

const MAX_SAMPLE = 50;

export async function GET(req: NextRequest, context: { params: Promise<{ segmentId: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ALLOWED_ROLES],
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

    const resolvedParams = await context.params;
    const segmentId = resolvedParams.segmentId;
    const segment = await prisma.crmSegment.findFirst({
      where: { id: segmentId, organizationId: organization.id },
      select: { id: true, name: true, rules: true },
    });

    if (!segment) {
      return NextResponse.json({ ok: false, error: "Segmento não encontrado." }, { status: 404 });
    }

    const resolved = await resolveSegmentUserIds({
      organizationId: organization.id,
      rules: segment.rules,
      maxUsers: MAX_SAMPLE,
    });

    try {
      await prisma.crmSegment.update({
        where: { id: segment.id },
        data: { sizeCache: resolved.total, lastComputedAt: new Date() },
      });
    } catch (err) {
      console.warn("[crm][segment-preview] falha ao atualizar cache do segmento", err);
    }

    const items = resolved.userIds.length
      ? await prisma.crmCustomer.findMany({
          where: {
            organizationId: organization.id,
            userId: { in: resolved.userIds },
          },
          select: {
            id: true,
            userId: true,
            displayName: true,
            lastActivityAt: true,
            totalSpentCents: true,
            tags: true,
            user: { select: { fullName: true, username: true, avatarUrl: true } },
          },
          orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
          take: MAX_SAMPLE,
        })
      : [];

    const mapped = items.map((item) => ({
      id: item.id,
      userId: item.userId,
      displayName: item.displayName || item.user?.fullName || item.user?.username || null,
      avatarUrl: item.user?.avatarUrl ?? null,
      lastActivityAt: item.lastActivityAt,
      totalSpentCents: item.totalSpentCents,
      tags: item.tags,
    }));

    return NextResponse.json({ ok: true, segment: { id: segment.id, name: segment.name }, total: resolved.total, items: mapped });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/crm/segmentos/[segmentId]/preview error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao pré-visualizar segmento." }, { status: 500 });
  }
}
