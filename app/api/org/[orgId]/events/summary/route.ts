// app/api/org/[orgId]/events/summary/route.ts
import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated } from "@/lib/security";
import { EventTemplateType, OrganizationModule, Prisma } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const templateTypeParam = url.searchParams.get("templateType");
    const excludeTemplateTypeParam = url.searchParams.get("excludeTemplateType");
    const parseTemplateType = (raw: string | null) => {
      if (!raw) return null;
      const normalized = raw.trim().toUpperCase();
      return (Object.values(EventTemplateType) as string[]).includes(normalized)
        ? (normalized as EventTemplateType)
        : null;
    };
    const templateType = parseTemplateType(templateTypeParam);
    const excludeTemplateType = parseTemplateType(excludeTemplateTypeParam);

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true, onboardingDone: true, fullName: true, username: true },
    });
    if (!profile) {
      return jsonWrap(
        {
          ok: false,
          error:
            "Perfil não encontrado. Completa o onboarding de utilizador antes de gerires eventos como organização.",
        },
        { status: 403 },
      );
    }
    const hasUserOnboarding =
      profile.onboardingDone ||
      (Boolean(profile.fullName?.trim()) && Boolean(profile.username?.trim()));
    if (!hasUserOnboarding) {
      return jsonWrap(
        {
          ok: false,
          error:
            "Completa o onboarding de utilizador (nome e username) antes de gerires eventos de organização.",
        },
        { status: 403 },
      );
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(profile.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN", "STAFF"],
    });
    if (!organization || !membership) {
      return jsonWrap(
        {
          ok: false,
          error:
            "Ainda não és organização. Usa o botão 'Quero ser organização' para começar.",
        },
        { status: 403 },
      );
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.EVENTOS,
      required: "VIEW",
    });
    if (!access.ok) {
      return jsonWrap(
        {
          ok: false,
          error:
            "Ainda não és organização. Usa o botão 'Quero ser organização' para começar.",
        },
        { status: 403 },
      );
    }

    const baseWhere: Prisma.EventWhereInput = {
      isDeleted: false,
      organizationId: organization.id,
      ...(templateType
        ? { templateType }
        : excludeTemplateType
          ? { NOT: { templateType: excludeTemplateType } }
          : {}),
    };

    const now = new Date();
    const activeFilter: Prisma.EventWhereInput = {
      ...baseWhere,
      status: { not: "CANCELLED" },
    };

    const [total, upcoming, ongoing, finished, nextEvent] = await prisma.$transaction([
      prisma.event.count({ where: activeFilter }),
      prisma.event.count({
        where: {
          ...activeFilter,
          startsAt: { gt: now },
        },
      }),
      prisma.event.count({
        where: {
          ...activeFilter,
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
      }),
      prisma.event.count({
        where: {
          ...activeFilter,
          OR: [{ status: "FINISHED" }, { endsAt: { lt: now } }],
        },
      }),
      prisma.event.findFirst({
        where: activeFilter,
        orderBy: { startsAt: "asc" },
        select: {
          id: true,
          slug: true,
          title: true,
          startsAt: true,
          endsAt: true,
          status: true,
          templateType: true,
        },
      }),
    ]);

    return jsonWrap({
      ok: true,
      counts: { total, upcoming, ongoing, finished },
      nextEvent: nextEvent ?? null,
    });
  } catch (error) {
    return jsonWrap(
      { ok: false, error: "Erro ao carregar resumo de eventos." },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
