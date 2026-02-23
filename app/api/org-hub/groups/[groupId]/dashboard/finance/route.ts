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
            grossCents: 0,
            netCents: 0,
            invoiceCount: 0,
            paidInvoiceCount: 0,
            releasedPayoutCents: 0,
            currency: "EUR",
          },
          items: [],
        },
        { status: 200 },
      );
    }

    const [paymentSnapshots, invoices, payouts] = await Promise.all([
      prisma.paymentSnapshot.findMany({
        where: { organizationId: { in: scope.scopedOrgIds } },
        select: {
          organizationId: true,
          grossCents: true,
          netToOrgCents: true,
        },
      }),
      prisma.invoice.findMany({
        where: { organizationId: { in: scope.scopedOrgIds } },
        select: {
          organizationId: true,
          status: true,
        },
      }),
      prisma.payout.findMany({
        where: { organizationId: { in: scope.scopedOrgIds } },
        select: {
          organizationId: true,
          status: true,
          amountCents: true,
        },
      }),
    ]);

    type OrgFinanceRow = {
      organizationId: number;
      organizationName: string;
      grossCents: number;
      netCents: number;
      invoiceCount: number;
      paidInvoiceCount: number;
      releasedPayoutCents: number;
    };

    const rows = new Map<number, OrgFinanceRow>();
    scope.organizations.forEach((org) => {
      rows.set(org.id, {
        organizationId: org.id,
        organizationName: org.name,
        grossCents: 0,
        netCents: 0,
        invoiceCount: 0,
        paidInvoiceCount: 0,
        releasedPayoutCents: 0,
      });
    });

    let grossCents = 0;
    let netCents = 0;
    let invoiceCount = 0;
    let paidInvoiceCount = 0;
    let releasedPayoutCents = 0;

    for (const snapshot of paymentSnapshots) {
      const row = rows.get(snapshot.organizationId);
      if (!row) continue;
      const gross = snapshot.grossCents ?? 0;
      const net = snapshot.netToOrgCents ?? 0;
      row.grossCents += gross;
      row.netCents += net;
      grossCents += gross;
      netCents += net;
    }

    for (const invoice of invoices) {
      const row = rows.get(invoice.organizationId);
      if (!row) continue;
      row.invoiceCount += 1;
      invoiceCount += 1;
      if (invoice.status === "PAID") {
        row.paidInvoiceCount += 1;
        paidInvoiceCount += 1;
      }
    }

    for (const payout of payouts) {
      if (payout.status !== "RELEASED") continue;
      const row = rows.get(payout.organizationId);
      if (!row) continue;
      const amount = payout.amountCents ?? 0;
      row.releasedPayoutCents += amount;
      releasedPayoutCents += amount;
    }

    const items = Array.from(rows.values()).sort((a, b) => b.netCents - a.netCents);

    return respondOk(
      ctx,
      {
        summary: {
          organizations: scope.scopedOrgIds.length,
          grossCents,
          netCents,
          invoiceCount,
          paidInvoiceCount,
          releasedPayoutCents,
          currency: "EUR",
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
    console.error("[org-hub/groups/dashboard/finance][GET]", err);
    return respondError(
      ctx,
      { errorCode: "INTERNAL_ERROR", message: "Erro inesperado.", retryable: true },
      { status: 500 },
    );
  }
}

export const GET = withApiEnvelope(_GET);
