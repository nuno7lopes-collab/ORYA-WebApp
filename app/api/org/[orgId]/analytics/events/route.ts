import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { EventTemplateType, OrganizationModule, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";
function parseTemplateType(raw: string | null) {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase();
  return (Object.values(EventTemplateType) as string[]).includes(normalized)
    ? (normalized as EventTemplateType)
    : null;
}

function parseLimit(raw: string | null) {
  const parsed = Number(raw ?? "100");
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(Math.floor(parsed), 300));
}

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });
    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.ANALYTICS,
      required: "VIEW",
    });
    if (!access.ok) {
      return jsonWrap({ ok: false, error: "NO_ANALYTICS_ACCESS" }, { status: 403 });
    }

    const url = new URL(req.url);
    const limit = parseLimit(url.searchParams.get("limit"));
    const templateType = parseTemplateType(url.searchParams.get("templateType"));
    const excludeTemplateType = parseTemplateType(url.searchParams.get("excludeTemplateType"));
    const eventTemplateFilter: Prisma.EventWhereInput = templateType
      ? { templateType }
      : excludeTemplateType
        ? { OR: [{ templateType: null }, { templateType: { not: excludeTemplateType } }] }
        : {};

    const items = await prisma.event.findMany({
      where: {
        organizationId: organization.id,
        isDeleted: false,
        ...eventTemplateFilter,
      },
      orderBy: [{ startsAt: "desc" }, { id: "desc" }],
      take: limit,
      select: {
        id: true,
        title: true,
        startsAt: true,
        status: true,
        templateType: true,
      },
    });

    return jsonWrap({ ok: true, items }, { status: 200 });
  } catch (err) {
    console.error("[analytics/events] erro inesperado", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export const GET = withApiEnvelope(_GET);
