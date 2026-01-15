import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { readNumericParam } from "@/lib/routeParams";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const resolved = await params;
  const entryId = readNumericParam(resolved?.id, req, "inscricoes");
  if (entryId === null) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const entry = await prisma.tournamentEntry.findFirst({
    where: { id: entryId, OR: [{ userId: user.id }, { ownerUserId: user.id }] },
    include: {
      event: { select: { id: true, slug: true, title: true, startsAt: true } },
      pairing: {
        select: {
          id: true,
          payment_mode: true,
          lifecycleStatus: true,
          guaranteeStatus: true,
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

  if (!entry) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const pairing = entry.pairing;
  const partnerSlot =
    pairing?.slots?.find((s) => s.slot_role === "PARTNER" && s.profileId !== entry.userId) ||
    pairing?.slots?.find((s) => s.slot_role === "CAPTAIN" && s.profileId !== entry.userId);

  return NextResponse.json(
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
          pairing?.lifecycleStatus === "PENDING_PARTNER_PAYMENT"
            ? "À espera do parceiro"
            : pairing?.lifecycleStatus?.startsWith("CONFIRMED")
              ? "Confirmado"
              : "Pendente",
        nextAction:
          pairing?.guaranteeStatus === "REQUIRES_ACTION"
            ? "CONFIRM_GUARANTEE"
            : pairing?.lifecycleStatus === "PENDING_PARTNER_PAYMENT"
              ? "PAY_PARTNER"
              : "NONE",
      },
    },
    { status: 200 },
  );
}
