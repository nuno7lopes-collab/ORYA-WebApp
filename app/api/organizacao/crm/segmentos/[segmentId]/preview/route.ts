import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { OrganizationMemberRole } from "@prisma/client";
import { resolveSegmentContactIds } from "@/lib/crm/segmentQuery";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST = Object.values(OrganizationMemberRole);

const MAX_SAMPLE = 50;

async function _GET(req: NextRequest, context: { params: Promise<{ segmentId: string }> }) {
  try {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: [...ROLE_ALLOWLIST],
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

    const resolvedParams = await context.params;
    const segmentId = resolvedParams.segmentId;
    const segment = await prisma.crmSegment.findFirst({
      where: { id: segmentId, organizationId: organization.id },
      select: { id: true, name: true, rules: true },
    });

    if (!segment) {
      return jsonWrap({ ok: false, error: "Segmento não encontrado." }, { status: 404 });
    }

    const resolved = await resolveSegmentContactIds({
      organizationId: organization.id,
      rules: segment.rules,
      maxContacts: MAX_SAMPLE,
    });

    try {
      await prisma.crmSegment.update({
        where: { id: segment.id },
        data: { sizeCache: resolved.total, lastComputedAt: new Date() },
      });
    } catch (err) {
      console.warn("[crm][segment-preview] falha ao atualizar cache do segmento", err);
    }

    const items = resolved.contactIds.length
      ? await prisma.crmContact.findMany({
          where: {
            organizationId: organization.id,
            id: { in: resolved.contactIds },
          },
          select: {
            id: true,
            userId: true,
            contactType: true,
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
      userId: item.userId ?? null,
      contactType: item.contactType,
      displayName: item.displayName || item.user?.fullName || item.user?.username || null,
      avatarUrl: item.user?.avatarUrl ?? null,
      lastActivityAt: item.lastActivityAt,
      totalSpentCents: item.totalSpentCents,
      tags: item.tags,
    }));

    return jsonWrap({ ok: true, segment: { id: segment.id, name: segment.name }, total: resolved.total, items: mapped });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/crm/segmentos/[segmentId]/preview error:", err);
    return jsonWrap({ ok: false, error: "Erro ao pré-visualizar segmento." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
