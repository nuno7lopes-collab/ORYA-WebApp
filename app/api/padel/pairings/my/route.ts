export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { prisma } from "@/lib/prisma";
import { PadelPairingSlotStatus } from "@prisma/client";
import { getUserWithPolicy } from "@/lib/auth/getUserWithPolicy";

const INACTIVE_REGISTRATION_STATUSES = new Set([
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
]);

function parseOptionalPositiveInt(value: string | null) {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

async function _GET(req: NextRequest) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await getUserWithPolicy("required_verified", { supabaseOverride: supabase });

  if (error || !user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const rawEventId = req.nextUrl.searchParams.get("eventId");
  const eventId = parseOptionalPositiveInt(rawEventId);
  if (rawEventId && !eventId) {
    return jsonWrap({ ok: false, error: "INVALID_EVENT" }, { status: 400 });
  }

  const pairings = await prisma.padelPairing.findMany({
    where: {
      ...(eventId ? { eventId } : {}),
      OR: [
        { createdByUserId: user.id },
        { player1UserId: user.id },
        { player2UserId: user.id },
        { slots: { some: { profileId: user.id } } },
        {
          slots: {
            some: {
              invitedUserId: user.id,
              slotStatus: PadelPairingSlotStatus.PENDING,
              profileId: null,
            },
          },
        },
      ],
    },
    select: {
      id: true,
      eventId: true,
      categoryId: true,
      payment_mode: true,
      pairingStatus: true,
      pairingJoinMode: true,
      partnerInviteToken: true,
      createdByUserId: true,
      registration: { select: { status: true } },
      slots: {
        select: {
          id: true,
          slot_role: true,
          slotStatus: true,
          paymentStatus: true,
          profileId: true,
          invitedUserId: true,
          invitedContact: true,
          registrationLines: {
            select: {
              saleLines: {
                select: {
                  entitlements: {
                    select: {
                      ticket: {
                        select: {
                          id: true,
                          status: true,
                          stripePaymentIntentId: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      event: {
        select: {
          id: true,
          slug: true,
          title: true,
          organizationId: true,
          templateType: true,
        },
      },
      category: {
        select: {
          label: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 40,
  });

  const items = pairings
    .filter((pairing) => {
      const status = pairing.registration?.status ?? null;
      if (!status) return true;
      return !INACTIVE_REGISTRATION_STATUSES.has(status);
    })
    .map((pairing) => ({
      id: pairing.id,
      eventId: pairing.eventId,
      categoryId: pairing.categoryId ?? null,
      paymentMode: pairing.payment_mode,
      pairingStatus: pairing.pairingStatus,
      pairingJoinMode: pairing.pairingJoinMode,
      inviteToken: pairing.partnerInviteToken ?? null,
      createdByUserId: pairing.createdByUserId ?? null,
      slots: pairing.slots.map((slot) => {
        const registrationLines = slot.registrationLines ?? [];
        const nestedTicket =
          registrationLines
            .flatMap((line) => line.saleLines)
            .flatMap((line) => line.entitlements)
            .map((entitlement) => entitlement.ticket)
            .find((ticket) => Boolean(ticket)) ?? null;
        const ticket = nestedTicket;

        return {
          id: slot.id,
          slotRole: slot.slot_role,
          slotStatus: slot.slotStatus,
          paymentStatus: slot.paymentStatus,
          profileId: slot.profileId ?? null,
          invitedUserId: slot.invitedUserId ?? null,
          invitedContact: slot.invitedContact ?? null,
          ticket: ticket
            ? {
                id: ticket.id,
                status: ticket.status ?? null,
                stripePaymentIntentId: ticket.stripePaymentIntentId ?? null,
              }
            : null,
        };
      }),
      event: pairing.event
        ? {
            id: pairing.event.id,
            slug: pairing.event.slug,
            title: pairing.event.title,
            organizationId: pairing.event.organizationId ?? null,
            templateType: pairing.event.templateType ?? null,
          }
        : null,
      category: pairing.category
        ? {
            label: pairing.category.label ?? null,
          }
        : null,
    }));

  return jsonWrap({ ok: true, pairings: items }, { status: 200 });
}

export const GET = withApiEnvelope(_GET);
