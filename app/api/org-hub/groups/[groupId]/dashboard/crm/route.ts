import { NextRequest } from "next/server";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { respondError, respondOk } from "@/lib/http/envelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { prisma } from "@/lib/prisma";
import { parseOrgIds, parsePositiveInt, resolveGroupDashboardScope } from "../_helpers";

async function _GET(req: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const ctx = getRequestContext(req);
  try {
    const user = await requireUser();
    const { groupId: groupIdRaw } = await context.params;
    const groupId = parsePositiveInt(groupIdRaw);
    if (!groupId) {
      return respondError(
        ctx,
        { errorCode: "INVALID_GROUP_ID", message: "Grupo inválido.", retryable: false },
        { status: 400 },
      );
    }

    const url = new URL(req.url);
    const requestedOrgIds = parseOrgIds(url.searchParams.get("orgIds"));
    const scope = await resolveGroupDashboardScope({
      groupId,
      userId: user.id,
      requestedOrgIds,
    });
    if (!scope.ok) {
      return respondError(
        ctx,
        { errorCode: scope.errorCode, message: scope.message, retryable: false },
        { status: scope.status },
      );
    }

    if (scope.scopedOrgIds.length === 0) {
      return respondOk(
        ctx,
        {
          summary: {
            organizations: 0,
            contacts: 0,
            activeContacts: 0,
            marketingOptInContacts: 0,
            campaigns: 0,
            campaignsSent: 0,
            deliveries: 0,
            deliveriesFailed: 0,
            totalSpentCents: 0,
          },
          items: [],
        },
        { status: 200 },
      );
    }

    const [contacts, campaigns, deliveries] = await Promise.all([
      prisma.crmContact.findMany({
        where: { organizationId: { in: scope.scopedOrgIds } },
        select: {
          organizationId: true,
          status: true,
          marketingEmailOptIn: true,
          totalSpentCents: true,
        },
      }),
      prisma.crmCampaign.findMany({
        where: { organizationId: { in: scope.scopedOrgIds } },
        select: {
          organizationId: true,
          status: true,
          sentCount: true,
        },
      }),
      prisma.crmCampaignDelivery.findMany({
        where: { organizationId: { in: scope.scopedOrgIds } },
        select: {
          organizationId: true,
          status: true,
        },
      }),
    ]);

    type OrgCrmRow = {
      organizationId: number;
      organizationName: string;
      contacts: number;
      activeContacts: number;
      marketingOptInContacts: number;
      campaigns: number;
      campaignsSent: number;
      deliveries: number;
      deliveriesFailed: number;
      totalSpentCents: number;
    };

    const rows = new Map<number, OrgCrmRow>();
    scope.organizations.forEach((org) => {
      rows.set(org.id, {
        organizationId: org.id,
        organizationName: org.name,
        contacts: 0,
        activeContacts: 0,
        marketingOptInContacts: 0,
        campaigns: 0,
        campaignsSent: 0,
        deliveries: 0,
        deliveriesFailed: 0,
        totalSpentCents: 0,
      });
    });

    let contactsCount = 0;
    let activeContacts = 0;
    let marketingOptInContacts = 0;
    let campaignsCount = 0;
    let campaignsSent = 0;
    let deliveriesCount = 0;
    let deliveriesFailed = 0;
    let totalSpentCents = 0;

    for (const contact of contacts) {
      const row = rows.get(contact.organizationId);
      if (!row) continue;
      row.contacts += 1;
      contactsCount += 1;
      if (contact.status === "ACTIVE") {
        row.activeContacts += 1;
        activeContacts += 1;
      }
      if (contact.marketingEmailOptIn) {
        row.marketingOptInContacts += 1;
        marketingOptInContacts += 1;
      }
      const spent = contact.totalSpentCents ?? 0;
      row.totalSpentCents += spent;
      totalSpentCents += spent;
    }

    for (const campaign of campaigns) {
      const row = rows.get(campaign.organizationId);
      if (!row) continue;
      row.campaigns += 1;
      campaignsCount += 1;
      const sent = campaign.sentCount ?? 0;
      row.campaignsSent += sent;
      campaignsSent += sent;
    }

    for (const delivery of deliveries) {
      const row = rows.get(delivery.organizationId);
      if (!row) continue;
      row.deliveries += 1;
      deliveriesCount += 1;
      if (delivery.status === "FAILED") {
        row.deliveriesFailed += 1;
        deliveriesFailed += 1;
      }
    }

    const items = Array.from(rows.values()).sort((a, b) => b.contacts - a.contacts);

    return respondOk(
      ctx,
      {
        summary: {
          organizations: scope.scopedOrgIds.length,
          contacts: contactsCount,
          activeContacts,
          marketingOptInContacts,
          campaigns: campaignsCount,
          campaignsSent,
          deliveries: deliveriesCount,
          deliveriesFailed,
          totalSpentCents,
        },
        items,
      },
      { status: 200 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return respondError(
        ctx,
        { errorCode: err.code, message: err.code, retryable: false },
        { status: err.status ?? 401 },
      );
    }
    console.error("[org-hub/groups/dashboard/crm][GET]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro inesperado.", retryable: true },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
