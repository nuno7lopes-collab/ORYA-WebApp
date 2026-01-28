import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { readNumericParam } from "@/lib/routeParams";
import { mapRegistrationToPairingLifecycle } from "@/domain/padelRegistration";
import { PadelRegistrationStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const resolved = await params;
  const entryId = readNumericParam(resolved?.id, req, "inscricoes");
  if (entryId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, OR: [{ userId: user.id }, { ownerUserId: user.id }] },
    include: {
      event: { select: { id: true, slug: true, title: true, startsAt: true } },
      pairing: {
        select: {
          id: true,
          payment_mode: true,
          guaranteeStatus: true,
          registration: { select: { status: true } },
          slots: {
            select: {
              slot_role: true,
              profileId: true,
              playerProfile: { select: { fullName: true } },
            },
          },
        },
      },
    },
  });

  if (!entry) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const pairing = entry.pairing;
  const lifecycleStatus = pairing
    ? mapRegistrationToPairingLifecycle(
        pairing.registration?.status ?? PadelRegistrationStatus.PENDING_PARTNER,
        pairing.payment_mode,
      )
    : null;
  const partnerSlot =
    pairing?.slots?.find((s) => s.slot_role === "PARTNER" && s.profileId !== entry.userId) ||
    pairing?.slots?.find((s) => s.slot_role === "CAPTAIN" && s.profileId !== entry.userId);

  return jsonWrap(
    {
      ok: true,
      entry: {
        id: entry.id,
        event: entry.event,
        isCaptain: entry.role === "CAPTAIN",
        partnerUserId: partnerSlot?.profileId ?? null,
        partnerGuestName: partnerSlot?.playerProfile?.fullName ?? null,
        badge: pairing?.payment_mode === "SPLIT" ? "SPLIT" : pairing?.payment_mode === "FULL" ? "FULL" : "SINGLE",
        paymentStatusLabel:
          lifecycleStatus === "PENDING_PARTNER_PAYMENT"
            ? "À espera do parceiro"
            : lifecycleStatus?.startsWith("CONFIRMED")
              ? "Confirmado"
              : "Pendente",
        nextAction:
          pairing?.guaranteeStatus === "REQUIRES_ACTION"
            ? "CONFIRM_GUARANTEE"
            : lifecycleStatus === "PENDING_PARTNER_PAYMENT"
              ? "PAY_PARTNER"
              : "NONE",
      },
    },
    { status: 200 },
  );
}
export const GET = withApiEnvelope(_GET);