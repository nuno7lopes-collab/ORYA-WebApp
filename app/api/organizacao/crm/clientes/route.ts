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

function parseNumber(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoolean(value: string | null) {
  if (!value) return null;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
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
    const tags = params.get("tags")?.split(",").map((tag) => tag.trim()).filter(Boolean) ?? [];
    const limit = Math.min(Math.max(1, Number(params.get("limit") ?? 20)), MAX_LIMIT);
    const page = Math.max(1, Number(params.get("page") ?? 1));
    const minSpent = parseNumber(params.get("minSpentCents"));
    const maxSpent = parseNumber(params.get("maxSpentCents"));
    const lastActivityDays = parseNumber(params.get("lastActivityDays"));
    const marketingOptIn = parseBoolean(params.get("marketingOptIn"));

    const filters: Prisma.CrmCustomerWhereInput[] = [];

    if (query.length >= 2) {
      filters.push({
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          {
            AND: [
              { contactEmail: { contains: query, mode: "insensitive" } },
              {
                user: {
                  is: {
                    userConsents: {
                      some: {
                        organizationId: organization.id,
                        type: ConsentType.CONTACT_EMAIL,
                        status: ConsentStatus.GRANTED,
                      },
                    },
                  },
                },
              },
            ],
          },
          {
            AND: [
              { contactPhone: { contains: query, mode: "insensitive" } },
              {
                user: {
                  is: {
                    userConsents: {
                      some: {
                        organizationId: organization.id,
                        type: ConsentType.CONTACT_SMS,
                        status: ConsentStatus.GRANTED,
                      },
                    },
                  },
                },
              },
            ],
          },
          { user: { is: { fullName: { contains: query, mode: "insensitive" } } } },
          { user: { is: { username: { contains: query, mode: "insensitive" } } } },
        ],
      });
    }

    if (tags.length) {
      filters.push({ tags: { hasEvery: tags } });
    }

    if (minSpent !== null) {
      filters.push({ totalSpentCents: { gte: minSpent } });
    }

    if (maxSpent !== null) {
      filters.push({ totalSpentCents: { lte: maxSpent } });
    }

    if (lastActivityDays !== null) {
      const since = new Date(Date.now() - lastActivityDays * 24 * 60 * 60 * 1000);
      filters.push({ lastActivityAt: { gte: since } });
    }

    if (marketingOptIn === true) {
      filters.push({
        user: {
          is: {
            userConsents: {
              some: {
                organizationId: organization.id,
                type: ConsentType.MARKETING,
                status: ConsentStatus.GRANTED,
              },
            },
          },
        },
      });
    } else if (marketingOptIn === false) {
      filters.push({
        NOT: {
          user: {
            is: {
              userConsents: {
                some: {
                  organizationId: organization.id,
                  type: ConsentType.MARKETING,
                  status: ConsentStatus.GRANTED,
                },
              },
            },
          },
        },
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
          contactEmail: true,
          contactPhone: true,
          lastActivityAt: true,
          totalSpentCents: true,
          totalOrders: true,
          totalBookings: true,
          totalAttendances: true,
          totalTournaments: true,
          totalStoreOrders: true,
          tags: true,
          notesCount: true,
          user: {
            select: {
              fullName: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    const userIds = customers.map((item) => item.userId);
    const consents = userIds.length
      ? await prisma.userConsent.findMany({
          where: {
            organizationId: organization.id,
            userId: { in: userIds },
            type: { in: [ConsentType.MARKETING, ConsentType.CONTACT_EMAIL, ConsentType.CONTACT_SMS] },
          },
          select: { userId: true, type: true, status: true },
        })
      : [];

    const consentMap = new Map<string, Map<ConsentType, ConsentStatus>>();
    for (const consent of consents) {
      if (!consentMap.has(consent.userId)) {
        consentMap.set(consent.userId, new Map());
      }
      consentMap.get(consent.userId)?.set(consent.type, consent.status);
    }

    const items = customers.map((item) => {
      const consentsForUser = consentMap.get(item.userId);
      const emailConsent = consentsForUser?.get(ConsentType.CONTACT_EMAIL) ?? null;
      const smsConsent = consentsForUser?.get(ConsentType.CONTACT_SMS) ?? null;
      const marketingConsent = consentsForUser?.get(ConsentType.MARKETING) ?? null;
      const marketingOptInResolved = marketingConsent === ConsentStatus.GRANTED;

      return {
        id: item.id,
        userId: item.userId,
        displayName: item.displayName || item.user?.fullName || item.user?.username || null,
        avatarUrl: item.user?.avatarUrl ?? null,
        contactEmail: emailConsent === ConsentStatus.GRANTED ? item.contactEmail : null,
        contactPhone: smsConsent === ConsentStatus.GRANTED ? item.contactPhone : null,
        marketingOptIn: marketingOptInResolved,
        lastActivityAt: item.lastActivityAt,
        totalSpentCents: item.totalSpentCents,
        totalOrders: item.totalOrders,
        totalBookings: item.totalBookings,
        totalAttendances: item.totalAttendances,
        totalTournaments: item.totalTournaments,
        totalStoreOrders: item.totalStoreOrders,
        tags: item.tags,
        notesCount: item.notesCount,
      };
    });

    return jsonWrap({ ok: true, total, page, limit, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/organizacao/crm/clientes error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar clientes." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);