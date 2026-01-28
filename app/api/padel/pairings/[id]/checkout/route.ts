export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
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
import { checkPadelCategoryPlayerCapacity } from "@/domain/padelCategoryCapacity";
import { readNumericParam } from "@/lib/routeParams";
import { getPadelOnboardingMissing, isPadelOnboardingComplete } from "@/domain/padelOnboarding";
import { validatePadelCategoryAccess } from "@/domain/padelCategoryAccess";
import { INACTIVE_REGISTRATION_STATUSES } from "@/domain/padelRegistration";

// Apenas valida e delega criação de intent ao endpoint central (/api/payments/intent).
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) return jsonWrap({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const ticketTypeId = body && typeof body.ticketTypeId === "number" ? body.ticketTypeId : null;
  const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken : null;
  if (!ticketTypeId) return jsonWrap({ ok: false, error: "MISSING_TICKET_TYPE" }, { status: 400 });

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    include: {
      slots: true,
      event: { select: { organizationId: true, slug: true, id: true } },
    },
  });
  if (!pairing) return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (inviteToken && pairing.partnerInviteToken && pairing.partnerInviteToken !== inviteToken) {
    return jsonWrap({ ok: false, error: "INVALID_TOKEN" }, { status: 403 });
  }
  if (pairing.pairingStatus === "CANCELLED") {
    return jsonWrap({ ok: false, error: "PAIRING_CANCELLED" }, { status: 400 });
  }

  const [profile] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: {
        gender: true,
        fullName: true,
        username: true,
        contactPhone: true,
        padelLevel: true,
        padelPreferredSide: true,
      },
    }),
  ]);

  const missing = getPadelOnboardingMissing({
    profile,
    email: user.email ?? null,
  });
  if (!isPadelOnboardingComplete(missing)) {
    return jsonWrap(
      { ok: false, error: "PADEL_ONBOARDING_REQUIRED", missing },
      { status: 409 },
    );
  }

  const pending =
    pairing.payment_mode === PadelPaymentMode.SPLIT
      ? pairing.slots.find((s) => s.slotStatus === "PENDING")
      : null;
  if (pairing.payment_mode === PadelPaymentMode.SPLIT) {
    if (!pending) {
      return jsonWrap({ ok: false, error: "NO_PENDING_SLOT" }, { status: 400 });
    }
    if (pending.paymentStatus === PadelPairingPaymentStatus.PAID) {
      return jsonWrap({ ok: false, error: "SLOT_ALREADY_PAID" }, { status: 400 });
    }
  }
  if (pairing.payment_mode === PadelPaymentMode.SPLIT && pairing.deadlineAt && pairing.deadlineAt.getTime() < Date.now()) {
    return jsonWrap({ ok: false, error: "PAIRING_EXPIRED" }, { status: 409 });
  }

  // Apenas capitão pode iniciar checkout se for "assume resto"; parceiro também pode iniciar, mas validamos que não há ticket já atribuído
  const isCaptain = pairing.createdByUserId === user.id;
  const isPendingOwner = !pending?.profileId || pending.profileId === user.id;
  if (!isCaptain && !isPendingOwner) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
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
    return jsonWrap({ ok: false, error: "INVALID_TICKET_TYPE" }, { status: 400 });
  }
  if (pairing.categoryId && ticketType.padelEventCategoryLink?.padelCategoryId !== pairing.categoryId) {
    return jsonWrap({ ok: false, error: "TICKET_CATEGORY_MISMATCH" }, { status: 409 });
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
    return jsonWrap(
      { ok: false, error: eligibility.code },
      { status: eligibility.code === "GENDER_REQUIRED_FOR_TOURNAMENT" ? 403 : 409 },
    );
  }

  const category = pairing.categoryId
    ? await prisma.padelCategory.findUnique({
        where: { id: pairing.categoryId },
        select: { genderRestriction: true, minLevel: true, maxLevel: true },
      })
    : null;
  const categoryAccess = validatePadelCategoryAccess({
    genderRestriction: category?.genderRestriction ?? null,
    minLevel: category?.minLevel ?? null,
    maxLevel: category?.maxLevel ?? null,
    playerGender: partnerProfile?.gender as Gender | null,
    partnerGender: captainProfile?.gender as Gender | null,
    playerLevel: profile?.padelLevel ?? null,
  });
  if (!categoryAccess.ok) {
    if (categoryAccess.code === "GENDER_REQUIRED_FOR_CATEGORY" || categoryAccess.code === "LEVEL_REQUIRED_FOR_CATEGORY") {
      return jsonWrap(
        { ok: false, error: "PADEL_ONBOARDING_REQUIRED", missing: categoryAccess.missing },
        { status: 409 },
      );
    }
    return jsonWrap({ ok: false, error: categoryAccess.code }, { status: 409 });
  }

  // Não permitir checkout se utilizador já tiver pairing ativo no torneio
  const existingActive = await prisma.padelPairing.findFirst({
    where: {
      eventId: pairing.event.id,
      categoryId: pairing.categoryId ?? undefined,
      AND: [
        {
          OR: [
            { registration: { is: null } },
            { registration: { status: { notIn: INACTIVE_REGISTRATION_STATUSES } } },
          ],
        },
        { OR: [{ player1UserId: user.id }, { player2UserId: user.id }] },
      ],
      NOT: { id: pairing.id },
    },
    select: { id: true },
  });
  if (existingActive) {
    return jsonWrap({ ok: false, error: "PAIRING_ALREADY_ACTIVE" }, { status: 409 });
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
    return jsonWrap(
      {
        ok: false,
        error: limitCheck.code === "ALREADY_IN_CATEGORY" ? "ALREADY_IN_CATEGORY" : "MAX_CATEGORIES",
      },
      { status: 409 },
    );
  }

  const playerCapacity = await prisma.$transaction((tx) =>
    checkPadelCategoryPlayerCapacity({
      tx,
      eventId: pairing.event.id,
      categoryId: pairing.categoryId ?? null,
    }),
  );
  if (!playerCapacity.ok) {
    return jsonWrap({ ok: false, error: playerCapacity.code }, { status: 409 });
  }

  const currency = ticketType.currency || "EUR";
  if (currency.toUpperCase() !== "EUR") {
    return jsonWrap({ ok: false, error: "CURRENCY_NOT_SUPPORTED" }, { status: 400 });
  }
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
    return jsonWrap({ ok: false, error: "APP_BASE_URL_NOT_CONFIGURED" }, { status: 500 });
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
      return jsonWrap(
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

    return jsonWrap(
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
    return jsonWrap({ ok: false, error: "INTENT_ERROR" }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);