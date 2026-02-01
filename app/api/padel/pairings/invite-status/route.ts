export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { normalizeEmail } from "@/lib/utils/email";
import { normalizePhone } from "@/lib/phone";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import {
  Gender,
  PadelEligibilityType,
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPaymentMode,
} from "@prisma/client";
import { validateEligibility } from "@/domain/padelEligibility";
import { validatePadelCategoryGender } from "@/domain/padelCategoryGender";
import { validatePadelCategoryLevel } from "@/domain/padelCategoryLevel";
import { mapRegistrationToPairingLifecycle } from "@/domain/padelRegistration";
import { PadelRegistrationStatus } from "@prisma/client";

type InviteState =
  | "AWAITING_PAYMENT"
  | "AWAITING_ACCEPT"
  | "CONFIRMED"
  | "EXPIRED"
  | "CANCELLED"
  | "ACTION_REQUIRED";

function normalizeIdentifier(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function genderLabel(gender?: Gender | null) {
  if (gender === "MALE") return "masculino";
  if (gender === "FEMALE") return "feminino";
  return "não definido";
}

function eligibilityLabel(eligibilityType: PadelEligibilityType | null | undefined) {
  switch (eligibilityType) {
    case "MALE_ONLY":
      return "Torneio masculino";
    case "FEMALE_ONLY":
      return "Torneio feminino";
    case "MIXED":
      return "Torneio misto";
    default:
      return "Torneio open";
  }
}

function categoryLabel(restriction?: string | null) {
  const value = (restriction ?? "").trim().toUpperCase();
  if (value === "MALE") return "Categoria masculina";
  if (value === "FEMALE") return "Categoria feminina";
  if (value === "MIXED") return "Categoria mista";
  return "Categoria aberta";
}

function levelLabel(minLevel?: string | null, maxLevel?: string | null) {
  const min = (minLevel ?? "").trim();
  const max = (maxLevel ?? "").trim();
  if (min && max && min === max) return `Nível ${min}`;
  if (min && max) return `Nível ${min}-${max}`;
  if (min) return `Nível ${min}+`;
  if (max) return `Nível até ${max}`;
  return "Nível livre";
}

async function _GET(req: NextRequest) {
  const pairingIdRaw = req.nextUrl.searchParams.get("pairingId");
  const pairingId = Number(pairingIdRaw);
  if (!pairingIdRaw || !Number.isFinite(pairingId)) {
    return jsonWrap({ ok: false, error: "INVALID_PAIRING_ID" }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }
  const userId = data.user.id;
  const normalizedEmail = normalizeEmail(data.user.email ?? null);

  const [pairing, profile] = await Promise.all([
    prisma.padelPairing.findUnique({
      where: { id: pairingId },
      select: {
        id: true,
        eventId: true,
        categoryId: true,
        createdByUserId: true,
        payment_mode: true,
        pairingJoinMode: true,
        pairingStatus: true,
        registration: { select: { status: true } },
        partnerInviteToken: true,
        partnerLinkExpiresAt: true,
        deadlineAt: true,
        event: { select: { title: true, slug: true } },
        slots: {
          select: {
            id: true,
            slot_role: true,
            slotStatus: true,
            paymentStatus: true,
            invitedUserId: true,
            invitedContact: true,
            profileId: true,
            ticketId: true,
          },
        },
      },
    }),
    prisma.profile.findUnique({
      where: { id: userId },
      select: { username: true, contactPhone: true, gender: true, padelLevel: true },
    }),
  ]);

  if (!pairing) {
    return jsonWrap({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const [tournamentConfig, category] = await Promise.all([
    prisma.padelTournamentConfig.findUnique({
      where: { eventId: pairing.eventId },
      select: { eligibilityType: true },
    }),
    pairing.categoryId
      ? prisma.padelCategory.findUnique({
          where: { id: pairing.categoryId },
          select: { genderRestriction: true, minLevel: true, maxLevel: true },
        })
      : Promise.resolve(null),
  ]);

  const username = normalizeIdentifier(profile?.username);
  const usernameWithAt = username ? `@${username}` : null;
  const normalizedPhone = profile?.contactPhone ? normalizePhone(profile.contactPhone) : null;

  const identifiers = new Set(
    [normalizedEmail, username, usernameWithAt, normalizedPhone].filter(Boolean) as string[],
  );

  const userSlot = pairing.slots.find((slot) => {
    if (slot.profileId === userId || slot.invitedUserId === userId) return true;
    const invited = normalizeIdentifier(slot.invitedContact);
    if (!invited) return false;
    const invitedPlain = invited.startsWith("@") ? invited.slice(1) : invited;
    const invitedPhone = normalizePhone(invitedPlain) || invitedPlain.replace(/[^\d]/g, "");
    return identifiers.has(invited) || identifiers.has(invitedPlain) || identifiers.has(invitedPhone);
  });

  if (!userSlot) {
    return jsonWrap({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const viewerRole =
    pairing.createdByUserId === userId || userSlot.slot_role === "CAPTAIN"
      ? "CAPTAIN"
      : "INVITED";
  const partnerSlot = pairing.slots.find((slot) => slot.slot_role === "PARTNER");
  const captainSlot = pairing.slots.find((slot) => slot.slot_role === "CAPTAIN");

  const now = Date.now();
  const lifecycleStatus = mapRegistrationToPairingLifecycle(
    pairing.registration?.status ?? PadelRegistrationStatus.PENDING_PARTNER,
    pairing.payment_mode,
  );
  const isCancelled =
    pairing.pairingStatus === "CANCELLED" || lifecycleStatus === "CANCELLED_INCOMPLETE";
  const partnerPaid = partnerSlot?.paymentStatus === PadelPairingPaymentStatus.PAID;
  const partnerFilled = partnerSlot?.slotStatus === PadelPairingSlotStatus.FILLED;
  const captainPaid = captainSlot?.paymentStatus === PadelPairingPaymentStatus.PAID;
  const invitePending = !partnerFilled;
  const unpaid =
    pairing.payment_mode === PadelPaymentMode.FULL
      ? !captainPaid
      : !partnerPaid;
  const expiredInvite =
    pairing.partnerLinkExpiresAt &&
    pairing.partnerLinkExpiresAt.getTime() < now &&
    invitePending;
  const expiredDeadline =
    pairing.payment_mode === PadelPaymentMode.SPLIT &&
    pairing.deadlineAt &&
    pairing.deadlineAt.getTime() < now &&
    unpaid;
  const isExpired = expiredInvite || expiredDeadline;

  let state: InviteState = "AWAITING_PAYMENT";
  let requiredAction: "PAY" | "ACCEPT" | "ONBOARD" | "WAIT_PARTNER" | "SUPPORT" | "NONE" = "NONE";
  let blockingReason:
    | "PROFILE_INCOMPLETE"
    | "GENDER_MISMATCH"
    | "CATEGORY_GENDER_MISMATCH"
    | "LEVEL_REQUIRED_FOR_CATEGORY"
    | "CATEGORY_LEVEL_MISMATCH"
    | null = null;
  let blockingDetails:
    | {
        reason:
          | "PROFILE_INCOMPLETE"
          | "GENDER_MISMATCH"
          | "CATEGORY_GENDER_MISMATCH"
          | "LEVEL_REQUIRED_FOR_CATEGORY"
          | "CATEGORY_LEVEL_MISMATCH";
        message: string;
        captainGender?: Gender | null;
        partnerGender?: Gender | null;
        eligibilityType?: PadelEligibilityType | null;
        categoryRestriction?: string | null;
        categoryMinLevel?: string | null;
        categoryMaxLevel?: string | null;
        partnerLevel?: string | null;
      }
    | null = null;

  const shouldCheckEligibility =
    viewerRole === "INVITED" || (viewerRole === "CAPTAIN" && partnerSlot?.invitedUserId);
  if (shouldCheckEligibility) {
    const captainProfile = pairing.createdByUserId
      ? await prisma.profile.findUnique({
          where: { id: pairing.createdByUserId },
          select: { gender: true },
        })
      : null;
    const partnerProfile =
      viewerRole === "INVITED"
        ? profile
        : partnerSlot?.invitedUserId
          ? await prisma.profile.findUnique({
              where: { id: partnerSlot.invitedUserId },
              select: { gender: true, padelLevel: true },
            })
          : null;

    const eligibilityType =
      (tournamentConfig?.eligibilityType as PadelEligibilityType) ?? PadelEligibilityType.OPEN;
    const captainGender = captainProfile?.gender ?? null;
    const partnerGender = partnerProfile?.gender ?? null;
    const captainGenderLabel = genderLabel(captainGender);
    const partnerGenderLabel = genderLabel(partnerGender);

    if (!partnerGender) {
      blockingReason = "PROFILE_INCOMPLETE";
      requiredAction = viewerRole === "INVITED" ? "ONBOARD" : "WAIT_PARTNER";
      blockingDetails = {
        reason: "PROFILE_INCOMPLETE",
        message:
          viewerRole === "INVITED"
            ? "Define o teu sexo no perfil de padel para continuares."
            : "O parceiro precisa definir o sexo no perfil de padel.",
        captainGender,
        partnerGender,
      };
    } else {
      const eligibility = validateEligibility(
        eligibilityType,
        captainGender,
        partnerGender,
      );
      if (!eligibility.ok) {
        blockingReason = "GENDER_MISMATCH";
        requiredAction = "NONE";
        blockingDetails = {
          reason: "GENDER_MISMATCH",
          message: `${eligibilityLabel(eligibilityType)}: capitão ${captainGenderLabel}, parceiro ${partnerGenderLabel}.`,
          captainGender,
          partnerGender,
          eligibilityType,
        };
      } else {
        const categoryGender = validatePadelCategoryGender(
          category?.genderRestriction ?? null,
          captainGender,
          partnerGender,
        );
        if (!categoryGender.ok) {
          blockingReason = "CATEGORY_GENDER_MISMATCH";
          requiredAction = "NONE";
          blockingDetails = {
            reason: "CATEGORY_GENDER_MISMATCH",
            message: `${categoryLabel(category?.genderRestriction ?? null)}: capitão ${captainGenderLabel}, parceiro ${partnerGenderLabel}.`,
            captainGender,
            partnerGender,
            categoryRestriction: category?.genderRestriction ?? null,
          };
        } else {
          const categoryLevel = validatePadelCategoryLevel(
            category?.minLevel ?? null,
            category?.maxLevel ?? null,
            partnerProfile?.padelLevel ?? null,
          );
          if (!categoryLevel.ok) {
            const requirementLabel = levelLabel(category?.minLevel ?? null, category?.maxLevel ?? null);
            const partnerLevelLabel = (partnerProfile?.padelLevel ?? "").trim() || "não definido";
            if (categoryLevel.code === "LEVEL_REQUIRED_FOR_CATEGORY") {
              blockingReason = "LEVEL_REQUIRED_FOR_CATEGORY";
              requiredAction = viewerRole === "INVITED" ? "ONBOARD" : "WAIT_PARTNER";
              blockingDetails = {
                reason: "LEVEL_REQUIRED_FOR_CATEGORY",
                message:
                  viewerRole === "INVITED"
                    ? "Define o teu nível de padel para continuares."
                    : "O parceiro precisa definir o nível de padel.",
                categoryMinLevel: category?.minLevel ?? null,
                categoryMaxLevel: category?.maxLevel ?? null,
                partnerLevel: partnerProfile?.padelLevel ?? null,
              };
            } else {
              const partnerLabel = viewerRole === "INVITED" ? "teu" : "do parceiro";
              blockingReason = "CATEGORY_LEVEL_MISMATCH";
              requiredAction = "NONE";
              blockingDetails = {
                reason: "CATEGORY_LEVEL_MISMATCH",
                message: `${requirementLabel}: nível ${partnerLabel} ${partnerLevelLabel}.`,
                categoryMinLevel: category?.minLevel ?? null,
                categoryMaxLevel: category?.maxLevel ?? null,
                partnerLevel: partnerProfile?.padelLevel ?? null,
              };
            }
          }
        }
      }
    }
  }
  if (isCancelled) {
    state = "CANCELLED";
    requiredAction = "NONE";
    blockingReason = null;
  } else if (isExpired) {
    state = "EXPIRED";
    requiredAction = "NONE";
    blockingReason = null;
  } else if (blockingReason) {
    state = "ACTION_REQUIRED";
  } else if (pairing.pairingStatus === "COMPLETE") {
    state = "CONFIRMED";
  } else if (pairing.payment_mode === PadelPaymentMode.FULL) {
    if (!captainPaid) {
      state = "AWAITING_PAYMENT";
      requiredAction = viewerRole === "CAPTAIN" ? "PAY" : "WAIT_PARTNER";
    } else if (!partnerFilled) {
      state = "AWAITING_ACCEPT";
      requiredAction = viewerRole === "INVITED" ? "ACCEPT" : "WAIT_PARTNER";
    } else {
      state = "CONFIRMED";
      requiredAction = "NONE";
    }
  } else if (pairing.payment_mode === PadelPaymentMode.SPLIT) {
    if (partnerPaid) {
      state = "CONFIRMED";
      requiredAction = "NONE";
    } else {
      state = "AWAITING_PAYMENT";
      requiredAction = viewerRole === "INVITED" ? "PAY" : "WAIT_PARTNER";
    }
  } else {
    state = "AWAITING_PAYMENT";
    requiredAction = viewerRole === "INVITED" ? "PAY" : "WAIT_PARTNER";
  }

  const canAccept =
    state === "AWAITING_ACCEPT" &&
    viewerRole === "INVITED" &&
    pairing.payment_mode === PadelPaymentMode.FULL;
  const canDecline =
    viewerRole === "INVITED" &&
    !isCancelled &&
    !partnerPaid &&
    !partnerFilled &&
    (state === "AWAITING_PAYMENT" || state === "ACTION_REQUIRED");
  const canPaySplit =
    state === "AWAITING_PAYMENT" &&
    pairing.payment_mode === PadelPaymentMode.SPLIT &&
    Boolean(partnerSlot && !partnerPaid) &&
    (viewerRole === "INVITED" || Boolean(partnerSlot?.invitedUserId));
  const canPayFull =
    state === "AWAITING_PAYMENT" &&
    pairing.payment_mode === PadelPaymentMode.FULL &&
    viewerRole === "CAPTAIN" &&
    !captainPaid;
  const canPay = canPaySplit || canPayFull;
  const canReinvite = state === "CANCELLED" && viewerRole === "CAPTAIN";
  const canMatchmake = state === "CANCELLED" && viewerRole === "CAPTAIN";
  const canRefreshInvite =
    viewerRole === "CAPTAIN" &&
    !isCancelled &&
    pairing.pairingJoinMode === "INVITE_PARTNER" &&
    Boolean(partnerSlot) &&
    partnerSlot?.slotStatus !== PadelPairingSlotStatus.FILLED;

  const eventSlug = pairing.event?.slug ?? null;
  const token = pairing.partnerInviteToken;
  const payUrl =
    eventSlug
      ? viewerRole === "INVITED" && token
        ? `/eventos/${eventSlug}?inviteToken=${encodeURIComponent(token)}`
        : `/eventos/${eventSlug}?pairingId=${pairing.id}${
            partnerSlot?.id ? `&slotId=${partnerSlot.id}` : ""
          }`
      : null;
  const acceptUrl = `/api/padel/pairings/${pairing.id}/accept`;
  const declineUrl = `/api/padel/pairings/${pairing.id}/decline`;

  let entitlementId: string | null = null;
  if (userSlot.ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: userSlot.ticketId },
      select: {
        purchaseId: true,
        saleSummary: { select: { purchaseId: true, paymentIntentId: true } },
      },
    });
    const purchaseId =
      ticket?.purchaseId ??
      ticket?.saleSummary?.purchaseId ??
      ticket?.saleSummary?.paymentIntentId ??
      null;
    if (purchaseId) {
      const entitlement = await prisma.entitlement.findFirst({
        where: {
          purchaseId,
          ownerUserId: userId,
          type: "PADEL_ENTRY",
        },
        select: { id: true },
      });
      entitlementId = entitlement?.id ?? null;
    }
  }

  const detailUrl = entitlementId ? `/me/bilhetes/${entitlementId}` : null;

  const captainProfile = pairing.createdByUserId
    ? await prisma.profile.findUnique({
        where: { id: pairing.createdByUserId },
        select: { fullName: true, username: true },
      })
    : null;
  const partnerProfile =
    partnerSlot?.profileId
      ? await prisma.profile.findUnique({
          where: { id: partnerSlot.profileId },
          select: { fullName: true, username: true },
        })
      : partnerSlot?.invitedUserId
        ? await prisma.profile.findUnique({
            where: { id: partnerSlot.invitedUserId },
            select: { fullName: true, username: true },
          })
        : null;

  const captainName =
    captainProfile?.fullName ||
    (captainProfile?.username ? `@${captainProfile.username}` : null) ||
    "Capitão";
  const partnerName =
    partnerProfile?.fullName ||
    (partnerProfile?.username ? `@${partnerProfile.username}` : null) ||
    partnerSlot?.invitedContact ||
    "Parceiro";

  const categoryLink = await prisma.padelEventCategoryLink.findFirst({
    where: {
      eventId: pairing.eventId,
      isEnabled: true,
      ...(pairing.categoryId ? { padelCategoryId: pairing.categoryId } : {}),
    },
    select: { pricePerPlayerCents: true, currency: true },
    orderBy: { pricePerPlayerCents: "asc" },
  });
  const unitPriceCents = categoryLink?.pricePerPlayerCents ?? null;
  const currency = (categoryLink?.currency || "EUR").toUpperCase();
  const amountDueCents =
    state === "AWAITING_PAYMENT"
      ? pairing.payment_mode === PadelPaymentMode.SPLIT
        ? unitPriceCents
        : viewerRole === "CAPTAIN" && unitPriceCents !== null
          ? unitPriceCents * 2
          : null
      : null;

  const statusLabelMap: Record<InviteState, string> = {
    AWAITING_PAYMENT: "Pagamento pendente",
    AWAITING_ACCEPT: "Aguardando confirmação",
    CONFIRMED: "Dupla confirmada",
    EXPIRED: "Convite expirado",
    CANCELLED: "Dupla cancelada",
    ACTION_REQUIRED: "Ação necessária",
  };

  let statusHint: string | null = null;
  if (state === "AWAITING_PAYMENT" && pairing.payment_mode === PadelPaymentMode.FULL) {
    statusHint =
      viewerRole === "CAPTAIN"
        ? "Falta o teu pagamento para garantir a inscrição."
        : "A aguardar pagamento do capitão.";
  } else if (state === "AWAITING_PAYMENT" && viewerRole === "CAPTAIN") {
    statusHint = "O parceiro ainda não pagou.";
  } else if (state === "AWAITING_ACCEPT" && viewerRole === "CAPTAIN") {
    statusHint = "Aguardamos a confirmação do parceiro.";
  } else if (state === "AWAITING_ACCEPT" && viewerRole === "INVITED") {
    statusHint = "Confirma a tua presença para fechar a dupla.";
  } else if (state === "CANCELLED" && viewerRole === "CAPTAIN") {
    statusHint = "Podes criar um novo convite ou entrar em matchmaking.";
  } else if (state === "CANCELLED") {
    statusHint = "Esta dupla foi cancelada.";
  } else if (state === "ACTION_REQUIRED" && blockingReason) {
    statusHint = blockingDetails?.message ?? "A dupla não cumpre os requisitos.";
  }

  const canSwap =
    viewerRole === "CAPTAIN" && partnerSlot
      ? partnerSlot.paymentStatus !== PadelPairingPaymentStatus.PAID &&
        partnerSlot.slotStatus !== PadelPairingSlotStatus.FILLED
      : false;
  const canCancel =
    viewerRole === "CAPTAIN" &&
    !isCancelled &&
    (pairing.payment_mode === PadelPaymentMode.FULL || !partnerPaid) &&
    (partnerSlot ? partnerSlot.slotStatus !== PadelPairingSlotStatus.FILLED : true);

  return jsonWrap(
    {
      ok: true,
      pairingId: pairing.id,
      viewerRole,
      state,
      statusLabel: statusLabelMap[state],
      statusHint,
      requiredAction,
      blockingReason,
      blockingDetails,
      paymentMode: pairing.payment_mode,
      pairingStatus: pairing.pairingStatus,
      lifecycleStatus,
      deadlineAt: pairing.deadlineAt?.toISOString() ?? null,
      event: pairing.event
        ? { title: pairing.event.title ?? null, slug: pairing.event.slug ?? null }
        : null,
      actions: {
        canPay,
        canAccept,
        canDecline,
        canSwap,
        canCancel,
        canReinvite,
        canMatchmake,
        canRefreshInvite,
      },
      urls: {
        payUrl,
        acceptUrl,
        declineUrl,
        detailUrl,
        inviteUrl: eventSlug && token ? `/eventos/${eventSlug}?inviteToken=${encodeURIComponent(token)}` : null,
        inviteRefreshUrl: `/api/padel/pairings/${pairing.id}/invite`,
        onboardingUrl: eventSlug
          ? `/onboarding/padel?redirectTo=${encodeURIComponent(
              `/eventos/${eventSlug}?inviteToken=${encodeURIComponent(token ?? "")}`,
            )}`
          : "/onboarding/padel",
        swapUrl: `/api/padel/pairings/${pairing.id}/swap`,
        cancelUrl: `/api/padel/pairings/${pairing.id}/cancel`,
        reopenUrl: `/api/padel/pairings/${pairing.id}/reopen`,
      },
      participants: {
        captain: {
          name: captainName,
          paid: captainSlot?.paymentStatus === PadelPairingPaymentStatus.PAID,
          slotStatus: captainSlot?.slotStatus ?? null,
        },
        partner: {
          name: partnerName,
          invitedContact: partnerSlot?.invitedContact ?? null,
          paid: partnerSlot?.paymentStatus === PadelPairingPaymentStatus.PAID,
          slotStatus: partnerSlot?.slotStatus ?? null,
        },
      },
      amounts: {
        unitPriceCents,
        amountDueCents,
        currency,
      },
    },
    { status: 200 },
  );
}
export const GET = withApiEnvelope(_GET);
