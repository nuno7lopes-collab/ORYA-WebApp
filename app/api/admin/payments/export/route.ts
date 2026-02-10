import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { requireAdminUser } from "@/lib/admin/auth";
import { auditAdminAction } from "@/lib/admin/audit";
import { prisma } from "@/lib/prisma";
import type { Prisma, PaymentMode } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { logError } from "@/lib/observability/logger";
import { getRequestContext } from "@/lib/http/requestContext";

const MAX_EXPORT = 5000;

function toCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (raw.includes(",") || raw.includes("\n") || raw.includes("\"")) {
    return `"${raw.replace(/\"/g, "\"\"")}"`;
  }
  return raw;
}

async function _GET(req: NextRequest) {
  try {
    const ctx = getRequestContext(req);
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const url = new URL(req.url);
    const statusParam = (url.searchParams.get("status") || "ALL").toUpperCase();
    const modeParam = (url.searchParams.get("mode") || "ALL").toUpperCase();
    const q = url.searchParams.get("q")?.trim() ?? "";

    const where: Prisma.PaymentEventWhereInput = {};
    if (statusParam !== "ALL") where.status = statusParam;
    if (modeParam === "LIVE" || modeParam === "TEST") {
      where.mode = modeParam as PaymentMode;
    }
    if (q) {
      const qNum = Number(q);
      const maybeNumber = Number.isFinite(qNum) ? qNum : null;
      where.OR = [
        { purchaseId: { contains: q, mode: "insensitive" } },
        { stripeEventId: { contains: q, mode: "insensitive" } },
        { errorMessage: { contains: q, mode: "insensitive" } },
        ...(maybeNumber ? [{ eventId: maybeNumber }] : []),
        { userId: q },
      ];
    }

    const items = await prisma.paymentEvent.findMany({
      where,
      orderBy: { id: "desc" },
      take: MAX_EXPORT,
    });

    const headers = [
      "id",
      "purchase_id",
      "stripe_event_id",
      "status",
      "mode",
      "event_id",
      "user_id",
      "amount_cents",
      "platform_fee_cents",
      "stripe_fee_cents",
      "error_message",
      "created_at",
      "updated_at",
    ];

    const rows = items.map((item) =>
      [
        item.id,
        item.purchaseId,
        item.stripeEventId,
        item.status,
        item.mode,
        item.eventId ?? "",
        item.userId ?? "",
        item.amountCents ?? "",
        item.platformFeeCents ?? "",
        item.stripeFeeCents ?? "",
        item.errorMessage ?? "",
        item.createdAt?.toISOString() ?? "",
        item.updatedAt?.toISOString() ?? "",
      ]
        .map(toCsvValue)
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    await auditAdminAction({
      action: "PAYMENTS_EXPORT",
      actorUserId: admin.userId,
      correlationId: ctx.correlationId,
      payload: {
        count: items.length,
        status: statusParam,
        mode: modeParam,
        q: q || null,
      },
    });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="payments_export.csv"',
      },
    });
  } catch (err) {
    logError("admin.payments.export_failed", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
