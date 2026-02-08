export const runtime = "nodejs";

import { NextRequest } from "next/server";
import {
  Gender,
  PadelEligibilityType,
  PadelPaymentMode,
  PadelPairingPaymentStatus,
  Prisma,
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
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const pairingSelect = {
  id: true,
  eventId: true,
  organizationId: true,
  categoryId: true,
  createdByUserId: true,
  pairingStatus: true,
  pairingJoinMode: true,
  payment_mode: true,
  deadlineAt: true,
  graceUntilAt: true,
  partnerInviteToken: true,
  player1UserId: true,
  event: {
    select: {
      id: true,
      slug: true,
      organizationId: true,
    },
  },
  slots: {
    select: {
      id: true,
      slot_role: true,
      slotStatus: true,
      paymentStatus: true,
      profileId: true,
    },
  },
} satisfies Prisma.PadelPairingSelect;

// Apenas valida e delega criação de intent ao endpoint central (/api/payments/intent).
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (errorCode: string, message: string, status: number, retryable = false, details?: Record<string, unknown>) =>
    respondError(ctx, { errorCode, message, retryable, ...(details ? { details } : {}) }, { status });
  const resolved = await params;
  const pairingId = readNumericParam(resolved?.id, req, "pairings");
  if (pairingId === null) return fail("INVALID_ID", "ID inválido.", 400);

  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("UNAUTHENTICATED", "Sessão inválida.", 401);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const categoryLinkId = body && typeof body.ticketTypeId === "number" ? body.ticketTypeId : null;
  const inviteToken = typeof body?.inviteToken === "string" ? body.inviteToken : null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null;
  if (!categoryLinkId) return fail("MISSING_CATEGORY_LINK", "Categoria inválida.", 400);

  const pairing = await prisma.padelPairing.findUnique({
    where: { id: pairingId },
    select: pairingSelect,
  });
  if (!pairing) return fail("NOT_FOUND", "Pairing não encontrado.", 404);
  if (inviteToken && pairing.partnerInviteToken && pairing.partnerInviteToken !== inviteToken) {
    return fail("INVALID_TOKEN", "Token inválido.", 403);
  }
  if (pairing.pairingStatus === "CANCELLED") {
    return fail("PAIRING_CANCELLED", "Pairing cancelado.", 400);
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
    return fail("PADEL_ONBOARDING_REQUIRED", "Onboarding Padel em falta.", 409, false, { missing });
  }

  const pending =
    pairing.payment_mode === PadelPaymentMode.SPLIT
      ? pairing.slots.find((s) => s.slotStatus === "PENDING")
      : null;
  const captainSlot = pairing.slots.find((slot) => slot.slot_role === "CAPTAIN") ?? null;
  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER") ?? null;
  if (pairing.payment_mode === PadelPaymentMode.SPLIT) {
    if (!captainSlot || !partnerSlot) {
      return fail("SLOT_MISSING", "Slot em falta.", 400);
    }
    if (pairing.deadlineAt && pairing.deadlineAt.getTime() < Date.now()) {
      return fail("PAIRING_EXPIRED", "Pairing expirado.", 410);
    }
    if (pairing.graceUntilAt && pairing.graceUntilAt.getTime() < Date.now()) {
      return fail("PAIRING_EXPIRED", "Pairing expirado.", 410);
    }
  }

  const isCaptain = pairing.createdByUserId === user.id || captainSlot?.profileId === user.id;
  const isPartner = partnerSlot?.profileId === user.id;
  if (!isCaptain && !isPartner) {
    return fail("FORBIDDEN", "Sem permissões.", 403);
  }

  const categoryLink = await prisma.padelEventCategoryLink.findUnique({
    where: { id: categoryLinkId },
    select: {
      id: true,
      eventId: true,
      padelCategoryId: true,
      pricePerPlayerCents: true,
      currency: true,
      isEnabled: true,
      event: { select: { slug: true } },
    },
  });
  if (!categoryLink || categoryLink.eventId !== pairing.eventId) {
    return fail("INVALID_CATEGORY_LINK", "Categoria inválida.", 400);
  }
  if (categoryLink.isEnabled === false) {
    return fail("CATEGORY_DISABLED", "Categoria indisponível.", 409);
  }
  if (pairing.categoryId && categoryLink.padelCategoryId !== pairing.categoryId) {
    return fail("CATEGORY_MISMATCH", "Categoria inválida.", 409);
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
    return fail(
      eligibility.code,
      "Elegibilidade inválida.",
      eligibility.code === "GENDER_REQUIRED_FOR_TOURNAMENT" ? 403 : 409,
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
    if (categoryAccess.code === "GENDER_REQUIRED_FOR_CATEGORY") {
      return fail(
        "PADEL_ONBOARDING_REQUIRED",
        "Onboarding Padel em falta.",
        409,
        false,
        { missing: categoryAccess.missing },
      );
    }
    return fail(categoryAccess.code, "Categoria inválida.", 409);
  }
  if (categoryAccess.warning === "LEVEL_REQUIRED_FOR_CATEGORY") {
    return fail(
      "PADEL_ONBOARDING_REQUIRED",
      "Onboarding Padel em falta.",
      409,
      false,
      { missing: categoryAccess.missing },
    );
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
    return fail("PAIRING_ALREADY_ACTIVE", "Já existe pairing ativo.", 409);
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
    return fail(
      limitCheck.code === "ALREADY_IN_CATEGORY" ? "ALREADY_IN_CATEGORY" : "MAX_CATEGORIES",
      "Limite de categorias atingido.",
      409,
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
    return fail(playerCapacity.code, "Capacidade excedida.", 409);
  }

  const currency = categoryLink.currency || "EUR";
  if (currency.toUpperCase() !== "EUR") {
    return fail("CURRENCY_NOT_SUPPORTED", "Moeda não suportada.", 400);
  }
  const paymentScenario = pairing.payment_mode === PadelPaymentMode.FULL ? "GROUP_FULL" : "GROUP_SPLIT";
  let payerSlot =
    pairing.payment_mode === PadelPaymentMode.FULL
      ? captainSlot ?? pairing.slots.find((slot) => slot.slot_role === "CAPTAIN") ?? pairing.slots[0] ?? null
      : null;

  if (pairing.payment_mode === PadelPaymentMode.SPLIT && captainSlot && partnerSlot) {
    const partnerPending = pending && pending.id === partnerSlot.id;
    if (partnerPending) {
      if (!isCaptain) {
        return fail("PARTNER_ACCEPT_REQUIRED", "O parceiro precisa aceitar antes de pagar.", 409);
      }
      if (captainSlot.paymentStatus === PadelPairingPaymentStatus.PAID) {
        return fail("PARTNER_ACCEPT_REQUIRED", "O parceiro precisa aceitar antes de pagar.", 409);
      }
      payerSlot = captainSlot;
    } else {
      if (partnerSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
        payerSlot = partnerSlot;
      } else if (captainSlot.paymentStatus !== PadelPairingPaymentStatus.PAID) {
        payerSlot = captainSlot;
      }
    }
  }

  if (!payerSlot?.id) {
    return fail("PAIRING_SLOT_REQUIRED", "Slot da dupla em falta.", 400);
  }
  if (payerSlot.paymentStatus === PadelPairingPaymentStatus.PAID) {
    return fail("SLOT_ALREADY_PAID", "Slot já pago.", 400);
  }

  let baseUrl = env.appBaseUrl;
  if (!baseUrl) {
    console.error("[padel/pairings][checkout] APP_BASE_URL/NEXT_PUBLIC_BASE_URL em falta");
    return fail("APP_BASE_URL_NOT_CONFIGURED", "Base URL não configurada.", 500, true);
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
        slug: pairing.event.slug ?? categoryLink.event?.slug ?? null,
        sourceType: "PADEL_REGISTRATION",
        paymentScenario,
        pairingId: pairing.id,
        slotId: payerSlot.id,
        inviteToken: inviteToken ?? undefined,
        idempotencyKey: idempotencyKey ?? undefined,
        ticketTypeId: categoryLinkId,
        padelCategoryLinkId: categoryLinkId,
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      console.error("[padel/pairings][checkout] intent error", { status: res.status, data });
      return fail(
        data?.errorCode ?? data?.error ?? "INTENT_CREATION_FAILED",
        data?.message ?? "Falha ao criar intent.",
        res.status,
        false,
        { upstreamCode: data?.code ?? null },
      );
    }

    // Não existe estado PAYMENT_PENDING no enum; mantemos UNPAID
    if (pending) {
      await prisma.padelPairingSlot.update({
        where: { id: pending.id },
        data: { paymentStatus: PadelPairingPaymentStatus.UNPAID },
      });
    }

    return respondOk(ctx, {
      clientSecret: data.clientSecret,
      paymentIntentId: data.paymentIntentId,
      purchaseId: data.purchaseId,
      paymentScenario,
      breakdown: data.breakdown ?? null,
    });
  } catch (err) {
    console.error("[padel/pairings][checkout][POST]", err);
    return fail("INTENT_ERROR", "Erro ao iniciar checkout.", 500, true);
  }
}

export const POST = withApiEnvelope(_POST);
