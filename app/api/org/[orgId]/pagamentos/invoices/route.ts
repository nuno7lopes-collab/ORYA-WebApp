import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { OrganizationMemberRole, SaleSummaryStatus } from "@prisma/client";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }

    const url = new URL(req.url);
    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
      roles: ["OWNER", "CO_OWNER", "ADMIN"],
    });
    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "INVALID_ORGANIZATION" }, { status: 400 });
    }
    const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
      OrganizationMemberRole.OWNER,
      OrganizationMemberRole.CO_OWNER,
      OrganizationMemberRole.ADMIN,
    ];
    if (!ROLE_ALLOWLIST.includes(membership.role)) {
      return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
    }

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const sales = await prisma.saleSummary.findMany({
      where: {
        event: { organizationId: organization.id },
        status: SaleSummaryStatus.PAID,
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        event: { select: { id: true, title: true, slug: true, payoutMode: true } },
        lines: true,
      },
      take: 200,
    });

    const summary = sales.reduce(
      (acc, sale) => {
        acc.grossCents += sale.subtotalCents ?? 0;
        acc.discountCents += sale.discountCents ?? 0;
        acc.platformFeeCents += sale.platformFeeCents ?? 0;
        acc.netCents += sale.netCents ?? 0;
        acc.tickets += sale.lines.reduce((s, l) => s + l.quantity, 0);
        return acc;
      },
      { grossCents: 0, discountCents: 0, platformFeeCents: 0, netCents: 0, tickets: 0 },
    );

    return jsonWrap({ ok: true, items: sales, summary }, { status: 200 });
  } catch (err) {
    console.error("[api/org/[orgId]/pagamentos/invoices]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
