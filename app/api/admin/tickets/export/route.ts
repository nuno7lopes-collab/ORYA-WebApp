import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/admin/auth";
import type { Prisma } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

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
    const admin = await requireAdminUser();
    if (!admin.ok) {
      return jsonWrap({ ok: false, error: admin.error }, { status: admin.status });
    }

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") || "").trim();
    const status = (url.searchParams.get("status") || "ALL").toUpperCase();
    const intent = (url.searchParams.get("intent") || "").trim();
    const slug = (url.searchParams.get("slug") || "").trim();
    const userQuery = (url.searchParams.get("userQuery") || "").trim();

    const where: Prisma.TicketWhereInput = {};
    if (status !== "ALL") where.status = status;
    if (intent) where.stripePaymentIntentId = { contains: intent, mode: "insensitive" };
    if (slug) where.event = { slug: { contains: slug, mode: "insensitive" } };
    if (userQuery) {
      where.user = {
        OR: [
          { username: { contains: userQuery, mode: "insensitive" } },
          { fullName: { contains: userQuery, mode: "insensitive" } },
          { users: { email: { contains: userQuery, mode: "insensitive" } } },
        ],
      };
    }
    if (q) {
      where.OR = [
        { id: { contains: q, mode: "insensitive" } },
        { purchaseId: { contains: q, mode: "insensitive" } },
        { stripePaymentIntentId: { contains: q, mode: "insensitive" } },
        { event: { title: { contains: q, mode: "insensitive" } } },
        { event: { slug: { contains: q, mode: "insensitive" } } },
      ];
    }

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { purchasedAt: "desc" },
      take: MAX_EXPORT,
      select: {
        id: true,
        status: true,
        purchasedAt: true,
        currency: true,
        pricePaid: true,
        totalPaidCents: true,
        platformFeeCents: true,
        stripePaymentIntentId: true,
        event: { select: { id: true, title: true, slug: true } },
        ticketType: { select: { name: true } },
        user: {
          select: {
            username: true,
            fullName: true,
            users: { select: { email: true } },
          },
        },
      },
    });

    const headers = [
      "ticket_id",
      "status",
      "purchased_at",
      "currency",
      "price_paid_cents",
      "platform_fee_cents",
      "total_paid_cents",
      "payment_intent_id",
      "event_id",
      "event_title",
      "event_slug",
      "ticket_type",
      "user_username",
      "user_full_name",
      "user_email",
    ];

    const rows = tickets.map((t) =>
      [
        t.id,
        t.status,
        t.purchasedAt.toISOString(),
        t.currency,
        t.pricePaid,
        t.platformFeeCents,
        t.totalPaidCents,
        t.stripePaymentIntentId ?? "",
        t.event?.id ?? "",
        t.event?.title ?? "",
        t.event?.slug ?? "",
        t.ticketType?.name ?? "",
        t.user?.username ?? "",
        t.user?.fullName ?? "",
        t.user?.users?.email ?? "",
      ]
        .map(toCsvValue)
        .join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="tickets_export.csv"',
      },
    });
  } catch (err) {
    console.error("[admin/tickets/export]", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);