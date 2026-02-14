import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureCrmModuleAccess } from "@/lib/crm/access";
import { ConsentStatus, ConsentType, OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const ROLE_ALLOWLIST = Object.values(OrganizationMemberRole);

const MAX_NOTES = 50;
const MAX_INTERACTIONS = 100;

async function _GET(req: NextRequest, context: { params: Promise<{ customerId: string }> }) {
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
    const customerId = resolvedParams.customerId;
    const customer = await prisma.crmContact.findFirst({
      where: { id: customerId, organizationId: organization.id },
      select: {
        id: true,
        userId: true,
        contactType: true,
        displayName: true,
        contactEmail: true,
        contactPhone: true,
        marketingEmailOptIn: true,
        firstInteractionAt: true,
        lastActivityAt: true,
        lastPurchaseAt: true,
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
            bio: true,
          },
        },
      },
    });

    if (!customer) {
      return jsonWrap({ ok: false, error: "Cliente não encontrado." }, { status: 404 });
    }

    const consents = await prisma.crmContactConsent.findMany({
      where: {
        organizationId: organization.id,
        contactId: customer.id,
        type: { in: [ConsentType.MARKETING, ConsentType.CONTACT_EMAIL, ConsentType.CONTACT_SMS] },
      },
      select: { type: true, status: true, source: true, grantedAt: true, revokedAt: true, updatedAt: true },
    });

    const consentMap = new Map<ConsentType, typeof consents[number]>();
    for (const consent of consents) {
      consentMap.set(consent.type, consent);
    }

    const emailConsent = consentMap.get(ConsentType.CONTACT_EMAIL) ?? null;
    const smsConsent = consentMap.get(ConsentType.CONTACT_SMS) ?? null;
    const marketingConsent = consentMap.get(ConsentType.MARKETING) ?? null;
    const marketingOptInResolved = marketingConsent
      ? marketingConsent.status === ConsentStatus.GRANTED
      : customer.marketingEmailOptIn;

    const interactions = await prisma.crmInteraction.findMany({
      where: {
        organizationId: organization.id,
        contactId: customer.id,
      },
      orderBy: { occurredAt: "desc" },
      take: MAX_INTERACTIONS,
    });

    const notes = await prisma.crmContactNote.findMany({
      where: { organizationId: organization.id, contactId: customer.id },
      orderBy: { createdAt: "desc" },
      take: MAX_NOTES,
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            fullName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return jsonWrap({
      ok: true,
      customer: {
        id: customer.id,
        userId: customer.userId,
        contactType: customer.contactType,
        displayName: customer.displayName || customer.user?.fullName || customer.user?.username || null,
        avatarUrl: customer.user?.avatarUrl ?? null,
        bio: customer.user?.bio ?? null,
        contactEmail: emailConsent?.status === ConsentStatus.GRANTED ? customer.contactEmail : null,
        contactPhone: smsConsent?.status === ConsentStatus.GRANTED ? customer.contactPhone : null,
        marketingOptIn: marketingOptInResolved,
        firstInteractionAt: customer.firstInteractionAt,
        lastActivityAt: customer.lastActivityAt,
        lastPurchaseAt: customer.lastPurchaseAt,
        totalSpentCents: customer.totalSpentCents,
        totalOrders: customer.totalOrders,
        totalBookings: customer.totalBookings,
        totalAttendances: customer.totalAttendances,
        totalTournaments: customer.totalTournaments,
        totalStoreOrders: customer.totalStoreOrders,
        tags: customer.tags,
        notesCount: customer.notesCount,
        consents: {
          MARKETING: marketingConsent ?? null,
          CONTACT_EMAIL: emailConsent ?? null,
          CONTACT_SMS: smsConsent ?? null,
        },
      },
      interactions,
      notes,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    console.error("GET /api/org/[orgId]/crm/clientes/[customerId] error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar cliente." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
