import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { recordOrganizationAudit } from "@/lib/organizationAudit";
import { normalizeIntervals } from "@/lib/reservas/availability";
import { ensureReservasModuleAccess } from "@/lib/reservas/access";
import { OrganizationMemberRole } from "@prisma/client";

const ALLOWED_ROLES: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

const VALID_SCOPE_TYPES = ["ORGANIZATION", "PROFESSIONAL", "RESOURCE"] as const;
type ScopeType = (typeof VALID_SCOPE_TYPES)[number];

function parseScopeType(raw: unknown): ScopeType | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toUpperCase();
  return VALID_SCOPE_TYPES.includes(value as ScopeType) ? (value as ScopeType) : null;
}

function parseScopeId(raw: unknown) {
  const parsed = typeof raw === "string" || typeof raw === "number" ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getRequestMeta(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return { ip, userAgent };
}

async function resolveScope(params: {
  scopeTypeRaw: unknown;
  scopeIdRaw: unknown;
  organizationId: number;
  userId: string;
  role: OrganizationMemberRole;
}) {
  const scopeType = parseScopeType(params.scopeTypeRaw) ?? "ORGANIZATION";
  const scopeId = parseScopeId(params.scopeIdRaw);

  if (scopeType === "ORGANIZATION") {
    if (params.role === OrganizationMemberRole.STAFF) {
      return { ok: false as const, error: "Sem permissões." };
    }
    return { ok: true as const, scopeType, scopeId: 0 };
  }

  if (!scopeId) {
    return { ok: false as const, error: "Scope inválido." };
  }

  if (scopeType === "PROFESSIONAL") {
    const professional = await prisma.reservationProfessional.findFirst({
      where: { id: scopeId, organizationId: params.organizationId },
      select: { id: true, userId: true },
    });
    if (!professional) return { ok: false as const, error: "Profissional inválido." };
    if (params.role === OrganizationMemberRole.STAFF && professional.userId !== params.userId) {
      return { ok: false as const, error: "Sem permissões." };
    }
    return { ok: true as const, scopeType, scopeId: professional.id };
  }

  if (params.role === OrganizationMemberRole.STAFF) {
    return { ok: false as const, error: "Sem permissões." };
  }

  const resource = await prisma.reservationResource.findFirst({
    where: { id: scopeId, organizationId: params.organizationId },
    select: { id: true },
  });
  if (!resource) return { ok: false as const, error: "Recurso inválido." };

  return { ok: true as const, scopeType, scopeId: resource.id };
}

export async function GET(req: NextRequest) {
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
    const reservasAccess = await ensureReservasModuleAccess(organization);
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const scopeResolution = await resolveScope({
      scopeTypeRaw: req.nextUrl.searchParams.get("scopeType"),
      scopeIdRaw: req.nextUrl.searchParams.get("scopeId"),
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
    });

    if (!scopeResolution.ok) {
      return NextResponse.json({ ok: false, error: scopeResolution.error }, { status: 403 });
    }

    const { scopeType, scopeId } = scopeResolution;
    const [templates, overrides] = await Promise.all([
      prisma.weeklyAvailabilityTemplate.findMany({
        where: { organizationId: organization.id, scopeType, scopeId },
        orderBy: { dayOfWeek: "asc" },
        select: { id: true, dayOfWeek: true, intervals: true },
      }),
      prisma.availabilityOverride.findMany({
        where: { organizationId: organization.id, scopeType, scopeId },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: { id: true, date: true, kind: true, intervals: true },
      }),
    ]);

    const hasCustomTemplates = templates.some((template) => normalizeIntervals(template.intervals ?? []).length > 0);

    return NextResponse.json({
      ok: true,
      scope: { scopeType, scopeId },
      templates,
      overrides,
      inheritsOrganization: scopeType !== "ORGANIZATION" && !hasCustomTemplates,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/reservas/disponibilidade error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar disponibilidade." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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
    const reservasAccess = await ensureReservasModuleAccess(organization, undefined, {
      requireVerifiedEmail: true,
    });
    if (!reservasAccess.ok) {
      return NextResponse.json({ ok: false, error: reservasAccess.error }, { status: 403 });
    }

    const payload = await req.json().catch(() => ({}));
    const scopeResolution = await resolveScope({
      scopeTypeRaw: payload?.scopeType,
      scopeIdRaw: payload?.scopeId,
      organizationId: organization.id,
      userId: profile.id,
      role: membership.role,
    });

    if (!scopeResolution.ok) {
      return NextResponse.json({ ok: false, error: scopeResolution.error }, { status: 403 });
    }

    const { scopeType, scopeId } = scopeResolution;
    const mode = typeof payload?.mode === "string" ? payload.mode.trim().toUpperCase() : "";
    const { ip, userAgent } = getRequestMeta(req);

    if (mode === "TEMPLATE") {
      const dayOfWeek = Number(payload?.dayOfWeek);
      if (!Number.isFinite(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
        return NextResponse.json({ ok: false, error: "Dia inválido." }, { status: 400 });
      }
      const intervals = normalizeIntervals(payload?.intervals);
      const template = await prisma.weeklyAvailabilityTemplate.upsert({
        where: {
          organizationId_scopeType_scopeId_dayOfWeek: {
            organizationId: organization.id,
            scopeType,
            scopeId,
            dayOfWeek,
          },
        },
        update: { intervals },
        create: { organizationId: organization.id, scopeType, scopeId, dayOfWeek, intervals },
      });

      await recordOrganizationAudit(prisma, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "AVAILABILITY_TEMPLATE_UPDATED",
        metadata: { dayOfWeek, intervals, scopeType, scopeId },
        ip,
        userAgent,
      });

      return NextResponse.json({ ok: true, template });
    }

    if (mode === "OVERRIDE") {
      const dateRaw = typeof payload?.date === "string" ? payload.date.trim() : "";
      const kindRaw = typeof payload?.kind === "string" ? payload.kind.trim().toUpperCase() : "";
      const match = dateRaw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!match) {
        return NextResponse.json({ ok: false, error: "Data inválida." }, { status: 400 });
      }
      if (!["CLOSED", "OPEN", "BLOCK"].includes(kindRaw)) {
        return NextResponse.json({ ok: false, error: "Tipo de override inválido." }, { status: 400 });
      }
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      const intervals = kindRaw === "CLOSED" ? [] : normalizeIntervals(payload?.intervals);

      const override = await prisma.availabilityOverride.create({
        data: {
          organizationId: organization.id,
          scopeType,
          scopeId,
          date,
          kind: kindRaw as "CLOSED" | "OPEN" | "BLOCK",
          intervals,
        },
      });

      await recordOrganizationAudit(prisma, {
        organizationId: organization.id,
        actorUserId: profile.id,
        action: "AVAILABILITY_OVERRIDE_CREATED",
        metadata: { date: dateRaw, kind: kindRaw, intervals, scopeType, scopeId },
        ip,
        userAgent,
      });

      return NextResponse.json({ ok: true, override }, { status: 201 });
    }

    return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/reservas/disponibilidade error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao guardar disponibilidade." }, { status: 500 });
  }
}
