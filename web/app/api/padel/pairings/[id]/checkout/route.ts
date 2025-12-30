export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  Gender,
  PadelEligibilityType,
  PadelPaymentMode,
  PadelPairingPaymentStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { validateEligibility } from "@/domain/padelEligibility";
import { env } from "@/lib/env";
import { checkPadelCategoryLimit } from "@/domain/padelCategoryLimit";

// Apenas valida e delega criação de intent ao endpoint central (/api/payments/intent).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const pairingId = Number(params?.id);
  if (!Number.isFinite(pairingId)) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ticketTypeId = body && typeof body.ticketTypeId === "number" ? body.ticketTypeId : null;
  const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken : null;
  if (!ticketTypeId) return NextResponse.json({ ok: false, error: "MISSING_TICKET_TYPE" }, { status: 400 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: {
      slots: true,
      event: { select: { organizerId: true, slug: true, id: true } },
    },
  });
  if (!pairing) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (inviteToken && pairing.partnerInviteToken && pairing.partnerInviteToken !== inviteToken) {
    return NextResponse.json({ ok: false, error: "INVALID_TOKEN" }, { status: 403 });
  }
  if (pairing.pairingStatus === "CANCELLED") {
    return NextResponse.json({ ok: false, error: "PAIRING_CANCELLED" }, { status: 400 });
  }

  const pending =
    pairing.payment_mode === PadelPaymentMode.SPLIT
      ? pairing.slots.find((s) => s.slotStatus === "PENDING")
      : null;
  if (pairing.payment_mode === PadelPaymentMode.SPLIT) {
    if (!pending) {
      return NextResponse.json({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
    }
    if (pending.paymentStatus === PadelPairingPaymentStatus.PAID) {
      return NextResponse.json({ ok: false, error: "SLOT_ALREADY_PAID" }, { status: 400 });
    }
  }
  if (pairing.deadlineAt && pairing.deadlineAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "PAIRING_EXPIRED" }, { status: 410 });
  }

  // Apenas capitão pode iniciar checkout se for "assume resto"; parceiro também pode iniciar, mas validamos que não há ticket já atribuído
  const isCaptain = pairing.createdByUserId === user.id;
  const isPendingOwner = !pending?.profileId || pending.profileId === user.id;
  if (!isCaptain && !isPendingOwner) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const ticketType = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    select: {
      price: true,
      currency: true,
      eventId: true,
      event: { select: { slug: true } },
      padelEventCategoryLink: { select: { padelCategoryId: true } },
    },
  });
  if (!ticketType || ticketType.eventId !== pairing.eventId) {
    return NextResponse.json({ ok: false, error: "INVALID_TICKET_TYPE" }, { status: 400 });
  }
  if (pairing.categoryId && ticketType.padelEventCategoryLink?.padelCategoryId !== pairing.categoryId) {
    return NextResponse.json({ ok: false, error: "TICKET_CATEGORY_MISMATCH" }, { status: 409 });
  }

  // Elegibilidade: garantir que capitão + parceiro (quando definido) respeitam regras
  const tournamentConfig = await prisma.padelTournamentConfig.findUnique({
    where: { eventId: pairing.event.id },
    select: { eligibilityType: true },
  });
  const [captainProfile, partnerProfile] = await Promise.all([
    pairing.player1UserId
      ? prisma.profile.findUnique({ where: { id: pairing.player1UserId }, select: { gender: true } })
      : Promise.resolve(null),
    prisma.profile.findUnique({ where: { id: user.id }, select: { gender: true } }),
  ]);
  const eligibility = validateEligibility(
    (tournamentConfig?.eligibilityType as PadelEligibilityType) ?? PadelEligibilityType.OPEN,
    (captainProfile?.gender as Gender | null) ?? null,
    partnerProfile?.gender as Gender | null,
  );
  if (!eligibility.ok) {
    return NextResponse.json(
      { ok: false, error: eligibility.code },
      { status: eligibility.code === "GENDER_REQUIRED_FOR_TOURNAMENT" ? 403 : 409 },
    );
  }

  // Não permitir checkout se utilizador já tiver pairing ativo no torneio
  const existingActive = await prisma.padelPairing.findFirst({
    where: {
      eventId: pairing.event.id,
      lifecycleStatus: { not: "CANCELLED_INCOMPLETE" },
      categoryId: pairing.categoryId ?? undefined,
      OR: [{ player1UserId: user.id }, { player2UserId: user.id }],
      NOT: { id: pairing.id },
    },
    select: { id: true },
  });
  if (existingActive) {
    return NextResponse.json({ ok: false, error: "PAIRING_ALREADY_ACTIVE" }, { status: 409 });
  }

  const limitCheck = await prisma.$transaction((tx) =>
    checkPadelCategoryLimit({
      tx,
      eventId: pairing.event.id,
      userId: user.id,
      categoryId: pairing.categoryId ?? null,
      excludePairingId: pairing.id,
    }),
  );
  if (!limitCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: limitCheck.code === "ALREADY_IN_CATEGORY" ? "ALREADY_IN_CATEGORY" : "MAX_CATEGORIES",
      },
      { status: 409 },
    );
  }

  const currency = ticketType.currency || "EUR";
  const paymentScenario = pairing.payment_mode === PadelPaymentMode.FULL ? "GROUP_FULL" : "GROUP_SPLIT";
  const items = [
    {
      ticketId: ticketTypeId,
      quantity: pairing.payment_mode === PadelPaymentMode.FULL ? 2 : 1,
      unitPriceCents: ticketType.price,
      currency: currency.toUpperCase(),
    },
  ];

  let baseUrl = env.appBaseUrl;
  if (!baseUrl) {
    console.error("[padel/pairings][checkout] APP_BASE_URL/NEXT_PUBLIC_BASE_URL em falta");
    return NextResponse.json({ ok: false, error: "APP_BASE_URL_NOT_CONFIGURED" }, { status: 500 });
  }
  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = `https://${baseUrl}`;
  }
  const origin = new URL(baseUrl).toString().replace(/\/+$/, "");
  try {
    const res = await fetch(`${origin}/api/payments/intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        slug: pairing.event.slug ?? ticketType.event?.slug ?? null,
        items,
        paymentScenario,
        pairingId: pairing.id,
        slotId: pending?.id ?? undefined,
        inviteToken: inviteToken ?? undefined,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      console.error("[padel/pairings][checkout] intent error", { status: res.status, data });
      return NextResponse.json(
        { ok: false, error: data?.error ?? "INTENT_CREATION_FAILED", code: data?.code ?? null },
        { status: res.status },
      );
    }

    // Não existe estado PAYMENT_PENDING no enum; mantemos UNPAID
    if (pending) {
      await prisma.padelPairingSlot.update({
        where: { id: pending.id },
        data: { paymentStatus: PadelPairingPaymentStatus.UNPAID },
      });
    }

    return NextResponse.json(
      {
        ok: true,
        clientSecret: data.clientSecret,
        paymentIntentId: data.paymentIntentId,
        purchaseId: data.purchaseId,
        paymentScenario,
        breakdown: data.breakdown ?? null,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[padel/pairings][checkout][POST]", err);
    return NextResponse.json({ ok: false, error: "INTENT_ERROR" }, { status: 500 });
  }
}
