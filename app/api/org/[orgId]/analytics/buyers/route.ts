import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureMemberModuleAccess } from "@/lib/organizationMemberAccess";
import { OrganizationModule, TicketStatus } from "@prisma/client";
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
    const eventIdParam = url.searchParams.get("eventId");

    if (!eventIdParam) {
      return jsonWrap({ ok: false, error: "MISSING_EVENT_ID" }, { status: 400 });
    }

    const eventId = Number(eventIdParam);
    if (!Number.isFinite(eventId)) {
      return jsonWrap({ ok: false, error: "INVALID_EVENT_ID" }, { status: 400 });
    }

    const organizationId = resolveOrganizationIdFromRequest(req);
    const { organization, membership } = await getActiveOrganizationForUser(user.id, {
      organizationId: organizationId ?? undefined,
    });

    if (!organization || !membership) {
      return jsonWrap({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
    }

    const access = await ensureMemberModuleAccess({
      organizationId: organization.id,
      userId: user.id,
      role: membership.role,
      rolePack: membership.rolePack,
      moduleKey: OrganizationModule.ANALYTICS,
      required: "VIEW",
    });
    if (!access.ok) {
      return jsonWrap({ ok: false, error: "NOT_ORGANIZATION" }, { status: 403 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId: organization.id },
      select: { id: true },
    });

    if (!event) {
      return jsonWrap({ ok: false, error: "EVENT_NOT_FOUND" }, { status: 404 });
    }

    const tickets = await prisma.ticket.findMany({
      where: {
        eventId: event.id,
        status: {
          in: [
            TicketStatus.ACTIVE,
            TicketStatus.REFUNDED,
            TicketStatus.TRANSFERRED,
            TicketStatus.RESALE_LISTED,
          ],
        },
      },
      orderBy: { purchasedAt: "desc" },
      select: {
        id: true,
        pricePaid: true,
        totalPaidCents: true,
        status: true,
        purchasedAt: true,
        userId: true,
        stripePaymentIntentId: true,
        ticketType: { select: { name: true } },
        guestLink: { select: { guestEmail: true, guestName: true } },
      },
    });

    const userIds = tickets.map((t) => t.userId).filter(Boolean) as string[];
    const profiles = userIds.length
      ? await prisma.profile.findMany({
          where: { id: { in: userIds } },
          select: { id: true, fullName: true, username: true },
        })
      : [];
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    const items = tickets.map((t) => {
      const profile = t.userId ? profileMap.get(t.userId) : null;
      const buyerName = t.guestLink?.guestName || profile?.fullName || profile?.username || (t.userId ? "Conta ORYA" : "Convidado");
      const buyerEmail = t.guestLink?.guestEmail || "—";

      return {
        id: t.id,
        ticketType: t.ticketType?.name ?? "Bilhete",
        priceCents: t.pricePaid ?? 0,
        totalPaidCents: t.totalPaidCents ?? t.pricePaid ?? 0,
        status: t.status,
        purchasedAt: t.purchasedAt,
        buyerName,
        buyerEmail,
        paymentIntentId: t.stripePaymentIntentId,
      };
    });

    return jsonWrap({ ok: true, eventId: event.id, items }, { status: 200 });
  } catch (err) {
    console.error("[organização/buyers] erro inesperado", err);
    return jsonWrap({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
