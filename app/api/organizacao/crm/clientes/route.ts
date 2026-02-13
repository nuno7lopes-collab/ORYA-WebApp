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

function parseInteger(
  value: string | null,
  options: { fallback: number; min: number; max: number },
) {
  if (!value) return options.fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return options.fallback;
  return Math.min(options.max, Math.max(options.min, Math.floor(parsed)));
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
    const limit = parseInteger(params.get("limit"), {
      fallback: 20,
      min: 1,
      max: MAX_LIMIT,
    });
    const page = parseInteger(params.get("page"), {
      fallback: 1,
      min: 1,
      max: 10_000,
    });
    const minSpent = parseNumber(params.get("minSpentCents"));
    const maxSpent = parseNumber(params.get("maxSpentCents"));
    const lastActivityDays = parseNumber(params.get("lastActivityDays"));
    const marketingOptIn = parseBoolean(params.get("marketingOptIn"));

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

    if (tags.length) {
      filters.push({ tags: { hasEvery: tags } });
    }

    if (minSpent !== null) {
      filters.push({ totalSpentCents: { gte: minSpent } });
    }

    if (maxSpent !== null) {
      filters.push({ totalSpentCents: { lte: maxSpent } });
    }

    if (lastActivityDays !== null && lastActivityDays > 0) {
      const since = new Date(Date.now() - lastActivityDays * 24 * 60 * 60 * 1000);
      filters.push({ lastActivityAt: { gte: since } });
    }

    if (marketingOptIn === true) {
      filters.push({ marketingEmailOptIn: true });
    } else if (marketingOptIn === false) {
      filters.push({ marketingEmailOptIn: false });
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
          contactType: true,
          displayName: true,
          contactEmail: true,
          contactPhone: true,
          marketingEmailOptIn: true,
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

    const contactIds = contacts.map((item) => item.id);
    const consents = contactIds.length
      ? await prisma.crmContactConsent.findMany({
          where: {
            organizationId: organization.id,
            contactId: { in: contactIds },
            type: { in: [ConsentType.CONTACT_EMAIL, ConsentType.CONTACT_SMS] },
          },
          select: { contactId: true, type: true, status: true },
        })
      : [];

    const consentMap = new Map<string, Map<ConsentType, ConsentStatus>>();
    for (const consent of consents) {
      if (!consentMap.has(consent.contactId)) {
        consentMap.set(consent.contactId, new Map());
      }
      consentMap.get(consent.contactId)?.set(consent.type, consent.status);
    }

    const items = contacts.map((item) => {
      const consentsForContact = consentMap.get(item.id);
      const emailConsent = consentsForContact?.get(ConsentType.CONTACT_EMAIL) ?? null;
      const smsConsent = consentsForContact?.get(ConsentType.CONTACT_SMS) ?? null;

      return {
        id: item.id,
        userId: item.userId ?? null,
        contactType: item.contactType,
        displayName: item.displayName || item.user?.fullName || item.user?.username || null,
        avatarUrl: item.user?.avatarUrl ?? null,
        contactEmail: emailConsent === ConsentStatus.GRANTED ? item.contactEmail : null,
        contactPhone: smsConsent === ConsentStatus.GRANTED ? item.contactPhone : null,
        marketingOptIn: Boolean(item.marketingEmailOptIn),
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
