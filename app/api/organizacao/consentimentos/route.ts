import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { ConsentStatus, ConsentType, OrganizationMemberRole, Prisma } from "@prisma/client";

const ALLOWED_ROLES = Object.values(OrganizationMemberRole);

const MAX_LIMIT = 50;

const CONSENT_TYPES = [
  ConsentType.MARKETING,
  ConsentType.CONTACT_EMAIL,
  ConsentType.CONTACT_SMS,
] as const;

function parseLimit(value: string | null) {
  const parsed = Number(value ?? "20");
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(Math.max(1, parsed), MAX_LIMIT);
}

function parsePage(value: string | null) {
  const parsed = Number(value ?? "1");
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, parsed);
}

export async function GET(req: NextRequest) {
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

    const params = req.nextUrl.searchParams;
    const query = params.get("q")?.trim() ?? "";
    const limit = parseLimit(params.get("limit"));
    const page = parsePage(params.get("page"));

    const filters: Prisma.CrmCustomerWhereInput[] = [];
    if (query.length >= 2) {
      filters.push({
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          { user: { is: { fullName: { contains: query, mode: "insensitive" } } } },
          { user: { is: { username: { contains: query, mode: "insensitive" } } } },
        ],
      });
    }

    const where: Prisma.CrmCustomerWhereInput = {
      organizationId: organization.id,
      ...(filters.length ? { AND: filters } : {}),
    };

    const [total, customers] = await Promise.all([
      prisma.crmCustomer.count({ where }),
      prisma.crmCustomer.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          userId: true,
          displayName: true,
          user: { select: { fullName: true, username: true, avatarUrl: true } },
        },
      }),
    ]);

    const userIds = customers.map((item) => item.userId);
    const consents = userIds.length
      ? await prisma.userConsent.findMany({
          where: {
            organizationId: organization.id,
            userId: { in: userIds },
            type: { in: CONSENT_TYPES },
          },
          select: {
            userId: true,
            type: true,
            status: true,
            source: true,
            grantedAt: true,
            revokedAt: true,
            updatedAt: true,
          },
        })
      : [];

    const consentMap = new Map<string, Map<ConsentType, typeof consents[number]>>();
    for (const consent of consents) {
      if (!consentMap.has(consent.userId)) {
        consentMap.set(consent.userId, new Map());
      }
      consentMap.get(consent.userId)?.set(consent.type, consent);
    }

    const emptyConsent = {
      status: null as ConsentStatus | null,
      source: null as string | null,
      grantedAt: null as Date | null,
      revokedAt: null as Date | null,
      updatedAt: null as Date | null,
    };

    const items = customers.map((item) => {
      const consentsForUser = consentMap.get(item.userId);
      return {
        customerId: item.id,
        userId: item.userId,
        displayName: item.displayName || item.user?.fullName || item.user?.username || null,
        avatarUrl: item.user?.avatarUrl ?? null,
        consents: {
          MARKETING: consentsForUser?.get(ConsentType.MARKETING) ?? emptyConsent,
          CONTACT_EMAIL: consentsForUser?.get(ConsentType.CONTACT_EMAIL) ?? emptyConsent,
          CONTACT_SMS: consentsForUser?.get(ConsentType.CONTACT_SMS) ?? emptyConsent,
        },
      };
    });

    return NextResponse.json({ ok: true, total, page, limit, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/consentimentos error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar consentimentos." }, { status: 500 });
  }
}
