import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { ConsentStatus, ConsentType, OrganizationMemberRole, Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST = Object.values(OrganizationMemberRole);

const MAX_LIMIT = 50;

const CONSENT_TYPES: ConsentType[] = [
  ConsentType.MARKETING,
  ConsentType.CONTACT_EMAIL,
  ConsentType.CONTACT_SMS,
];

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

async function _GET(req: NextRequest) {
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

    const params = req.nextUrl.searchParams;
    const query = params.get("q")?.trim() ?? "";
    const limit = parseLimit(params.get("limit"));
    const page = parsePage(params.get("page"));

    const filters: Prisma.CrmContactWhereInput[] = [];
    if (query.length >= 2) {
      filters.push({
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          { contactEmail: { contains: query, mode: "insensitive" } },
          { contactPhone: { contains: query, mode: "insensitive" } },
          { user: { is: { fullName: { contains: query, mode: "insensitive" } } } },
          { user: { is: { username: { contains: query, mode: "insensitive" } } } },
        ],
      });
    }

    const where: Prisma.CrmContactWhereInput = {
      organizationId: organization.id,
      ...(filters.length ? { AND: filters } : {}),
    };

    const [total, contacts] = await Promise.all([
      prisma.crmContact.count({ where }),
      prisma.crmContact.findMany({
        where,
        take: limit,
        skip: (page - 1) * limit,
        orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          userId: true,
          displayName: true,
          contactType: true,
          user: { select: { fullName: true, username: true, avatarUrl: true } },
        },
      }),
    ]);

    const contactIds = contacts.map((item) => item.id);
    const consents = contactIds.length
      ? await prisma.crmContactConsent.findMany({
          where: {
            organizationId: organization.id,
            contactId: { in: contactIds },
            type: { in: CONSENT_TYPES },
          },
          select: {
            contactId: true,
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
      if (!consentMap.has(consent.contactId)) {
        consentMap.set(consent.contactId, new Map());
      }
      consentMap.get(consent.contactId)?.set(consent.type, consent);
    }

    const emptyConsent = {
      status: null as ConsentStatus | null,
      source: null as string | null,
      grantedAt: null as Date | null,
      revokedAt: null as Date | null,
      updatedAt: null as Date | null,
    };

    const items = contacts.map((item) => {
      const consentsForContact = consentMap.get(item.id);
      return {
        contactId: item.id,
        userId: item.userId ?? null,
        contactType: item.contactType,
        displayName: item.displayName || item.user?.fullName || item.user?.username || null,
        avatarUrl: item.user?.avatarUrl ?? null,
        consents: {
          MARKETING: consentsForContact?.get(ConsentType.MARKETING) ?? emptyConsent,
          CONTACT_EMAIL: consentsForContact?.get(ConsentType.CONTACT_EMAIL) ?? emptyConsent,
          CONTACT_SMS: consentsForContact?.get(ConsentType.CONTACT_SMS) ?? emptyConsent,
        },
      };
    });

    return jsonWrap({ ok: true, total, page, limit, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/consentimentos error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar consentimentos." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
