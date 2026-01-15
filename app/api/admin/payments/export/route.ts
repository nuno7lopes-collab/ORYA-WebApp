import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma, PaymentMode } from "@prisma/client";

const MAX_EXPORT = 5000;

function toCsvValue(value: unknown) {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (raw.includes(",") || raw.includes("\n") || raw.includes("\"")) {
    return `"${raw.replace(/\"/g, "\"\"")}"`;
  }
  return raw;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return NextResponse.json({ ok: false, error: admin.error }, { status: admin.status });
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
        { stripePaymentIntentId: { contains: q, mode: "insensitive" } },
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
      "payment_intent_id",
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
        item.stripePaymentIntentId,
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
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="payments_export.csv"',
      },
    });
  } catch (err) {
    console.error("[admin/payments/export]", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
