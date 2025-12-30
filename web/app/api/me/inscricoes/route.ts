import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const entries = await prisma.tournamentEntry.findMany({
    where: { userId: user.id },
    include: {
      event: { select: { id: true, title: true, slug: true, startsAt: true } },
      pairing: {
        select: {
          id: true,
          payment_mode: true,
          lifecycleStatus: true,
          guaranteeStatus: true,
          partnerInvitedAt: true,
          partnerAcceptedAt: true,
          slots: {
            select: {
              id: true,
              profileId: true,
              slot_role: true,
              ticket: { select: { id: true, status: true } },
            },
          },
        },
      },
    },
  });

  const items = entries.map((entry) => {
    const pairing = entry.pairing;
    const badge =
      pairing?.payment_mode === "SPLIT"
        ? "SPLIT"
        : pairing?.payment_mode === "FULL"
          ? "FULL"
          : "SINGLE";

    let nextAction: "NONE" | "PAY_PARTNER" | "CONFIRM_GUARANTEE" | "VIEW_LIVE" = "NONE";
    if (pairing?.lifecycleStatus === "PENDING_PARTNER_PAYMENT") nextAction = "PAY_PARTNER";
    if (pairing?.guaranteeStatus === "REQUIRES_ACTION") nextAction = "CONFIRM_GUARANTEE";
    if (!pairing && entry.event?.slug) nextAction = "VIEW_LIVE";
    if (nextAction === "NONE" && entry.event?.slug) nextAction = "VIEW_LIVE";

    const paymentStatusLabel =
      pairing?.lifecycleStatus === "PENDING_PARTNER_PAYMENT"
        ? "À espera do parceiro"
        : pairing?.lifecycleStatus?.startsWith("CONFIRMED")
          ? "Confirmado"
          : "Pendente";

    const partnerSlot = pairing?.slots?.find((s) => s.profileId && s.profileId !== entry.userId);
    const liveUrl = entry.event?.slug
      ? `/eventos/${entry.event.slug}/live${pairing?.id ? `?pairingId=${pairing.id}` : ""}`
      : null;
    const ctaUrl =
      nextAction === "PAY_PARTNER"
        ? `/pairings/${pairing?.id ?? ""}/checkout`
        : nextAction === "CONFIRM_GUARANTEE"
          ? `/pairings/${pairing?.id ?? ""}/guarantee`
          : nextAction === "VIEW_LIVE" && liveUrl
            ? liveUrl
            : null;

    return {
      id: entry.id,
      event: entry.event
        ? {
            id: entry.event.id,
            title: entry.event.title,
            slug: entry.event.slug,
            startsAt: entry.event.startsAt,
          }
        : null,
      isCaptain: entry.role === "CAPTAIN",
      partnerUserId: partnerSlot?.profileId ?? null,
      partnerGuestName: null,
      badge,
      paymentStatusLabel,
      nextAction,
      liveLink: liveUrl,
      pairingId: pairing?.id ?? null,
      ctaUrl,
    };
  });

  return NextResponse.json({ ok: true, items }, { status: 200 });
}
