export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { normalizeEmail } from "@/lib/utils/email";
import { normalizePhone } from "@/lib/phone";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { resolveLocale, t } from "@/lib/i18n";
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

function genderLabel(gender: Gender | null | undefined, locale: string) {
  if (gender === "MALE") return t("genderLabelMale", locale);
  if (gender === "FEMALE") return t("genderLabelFemale", locale);
  return t("genderLabelUnknown", locale);
}

function eligibilityLabel(eligibilityType: PadelEligibilityType | null | undefined, locale: string) {
  switch (eligibilityType) {
    case "MALE_ONLY":
      return t("eligibilityLabelMaleOnly", locale);
    case "FEMALE_ONLY":
      return t("eligibilityLabelFemaleOnly", locale);
    case "MIXED":
      return t("eligibilityLabelMixed", locale);
    default:
      return t("eligibilityLabelOpen", locale);
  }
}

function categoryLabel(restriction: string | null | undefined, locale: string) {
  const value = (restriction ?? "").trim().toUpperCase();
  if (value === "MALE") return t("categoryLabelMale", locale);
  if (value === "FEMALE") return t("categoryLabelFemale", locale);
  if (value === "MIXED") return t("categoryLabelMixed", locale);
  if (value === "MIXED_FREE") return t("categoryLabelMixedFree", locale);
  return t("categoryLabelOpen", locale);
}

function levelLabel(minLevel: string | null | undefined, maxLevel: string | null | undefined, locale: string) {
  const min = (minLevel ?? "").trim();
  const max = (maxLevel ?? "").trim();
  if (min && max && min === max) return t("levelLabelExact", locale).replace("{level}", min);
  if (min && max) return t("levelLabelRange", locale).replace("{min}", min).replace("{max}", max);
  if (min) return t("levelLabelMin", locale).replace("{min}", min);
  if (max) return t("levelLabelMax", locale).replace("{max}", max);
  return t("levelLabelOpen", locale);
}

async function _GET(req: NextRequest) {
  const acceptLanguage = req.headers.get("accept-language");
  const locale = resolveLocale(
    req.nextUrl.searchParams.get("lang") ?? (acceptLanguage ? acceptLanguage.split(",")[0] : null),
  );
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
        graceUntilAt: true,
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
  const expiredGrace =
    pairing.payment_mode === PadelPaymentMode.SPLIT &&
    pairing.graceUntilAt &&
    pairing.graceUntilAt.getTime() < now &&
    unpaid;
  const isExpired = expiredInvite || expiredDeadline || expiredGrace;

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
    const captainGenderLabel = genderLabel(captainGender, locale);
    const partnerGenderLabel = genderLabel(partnerGender, locale);

    if (!partnerGender) {
      blockingReason = "PROFILE_INCOMPLETE";
      requiredAction = viewerRole === "INVITED" ? "ONBOARD" : "WAIT_PARTNER";
      blockingDetails = {
        reason: "PROFILE_INCOMPLETE",
        message:
          viewerRole === "INVITED"
            ? t("pairingGenderRequiredSelf", locale)
            : t("pairingGenderRequiredPartner", locale),
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
          message: t("pairingEligibilitySummary", locale)
            .replace("{eligibility}", eligibilityLabel(eligibilityType, locale))
            .replace("{captain}", captainGenderLabel)
            .replace("{partner}", partnerGenderLabel),
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
            message: t("pairingCategorySummary", locale)
              .replace("{category}", categoryLabel(category?.genderRestriction ?? null, locale))
              .replace("{captain}", captainGenderLabel)
              .replace("{partner}", partnerGenderLabel),
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
          if (categoryLevel.ok && categoryLevel.warning) {
            const requirementLabel = levelLabel(category?.minLevel ?? null, category?.maxLevel ?? null, locale);
            const partnerLevelLabel = (partnerProfile?.padelLevel ?? "").trim() || t("levelLabelUndefined", locale);
            const partnerLabel =
              viewerRole === "INVITED" ? t("pairingPartnerLabelSelf", locale) : t("pairingPartnerLabelPartner", locale);
            blockingDetails = {
              reason: categoryLevel.warning,
              message:
                categoryLevel.warning === "LEVEL_REQUIRED_FOR_CATEGORY"
                  ? viewerRole === "INVITED"
                    ? t("pairingLevelRequiredSelf", locale)
                    : t("pairingLevelRequiredPartner", locale)
                  : t("pairingLevelMismatch", locale)
                      .replace("{requirement}", requirementLabel)
                      .replace("{who}", partnerLabel)
                      .replace("{level}", partnerLevelLabel),
              categoryMinLevel: category?.minLevel ?? null,
              categoryMaxLevel: category?.maxLevel ?? null,
              partnerLevel: partnerProfile?.padelLevel ?? null,
            };
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
    requiredAction = "NONE";
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
    if (!captainPaid) {
      state = "AWAITING_PAYMENT";
      requiredAction = viewerRole === "CAPTAIN" ? "PAY" : "WAIT_PARTNER";
    } else if (!partnerFilled) {
      state = "AWAITING_ACCEPT";
      requiredAction = viewerRole === "INVITED" ? "ACCEPT" : "WAIT_PARTNER";
    } else if (partnerPaid) {
      state = "CONFIRMED";
      requiredAction = "NONE";
    } else {
      state = "AWAITING_PAYMENT";
      requiredAction = "PAY";
    }
  } else {
    state = "AWAITING_PAYMENT";
    requiredAction = viewerRole === "INVITED" ? "PAY" : "WAIT_PARTNER";
  }

  const canAccept = state === "AWAITING_ACCEPT" && viewerRole === "INVITED";
  const canDecline =
    viewerRole === "INVITED" &&
    !isCancelled &&
    !partnerPaid &&
    !partnerFilled &&
    (state === "AWAITING_PAYMENT" || state === "ACTION_REQUIRED");
  const canPaySplit =
    state === "AWAITING_PAYMENT" &&
    pairing.payment_mode === PadelPaymentMode.SPLIT &&
    ((viewerRole === "CAPTAIN" && (!captainPaid || (partnerFilled && !partnerPaid))) ||
      (viewerRole === "INVITED" && partnerFilled && !partnerPaid));
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
  if (userSlot.id) {
    const line = await prisma.padelRegistrationLine.findFirst({
      where: { pairingSlotId: userSlot.id },
      select: { id: true },
    });
    if (line) {
      const saleLine = await prisma.saleLine.findFirst({
        where: { padelRegistrationLineId: line.id },
        select: { id: true },
      });
      if (saleLine) {
        const entitlement = await prisma.entitlement.findFirst({
          where: {
            saleLineId: saleLine.id,
            ownerUserId: userId,
            type: "PADEL_ENTRY",
          },
          select: { id: true },
        });
        entitlementId = entitlement?.id ?? null;
      }
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
    AWAITING_PAYMENT: t("pairingStatusPending", locale),
    AWAITING_ACCEPT: t("pairingStatusPending", locale),
    CONFIRMED: t("pairingStatusConfirmed", locale),
    EXPIRED: t("pairingStatusExpired", locale),
    CANCELLED: t("pairingStatusCancelled", locale),
    ACTION_REQUIRED: t("pairingStatusPending", locale),
  };

  let statusHint: string | null = null;
  if (state === "AWAITING_PAYMENT" && pairing.payment_mode === PadelPaymentMode.FULL) {
    statusHint =
      viewerRole === "CAPTAIN"
        ? t("pairingHintAwaitYourPayment", locale)
        : t("pairingHintAwaitCaptainPayment", locale);
  } else if (state === "AWAITING_PAYMENT" && pairing.payment_mode === PadelPaymentMode.SPLIT) {
    if (!captainPaid) {
      statusHint =
        viewerRole === "CAPTAIN"
          ? t("pairingHintAwaitYourPayment", locale)
          : t("pairingHintAwaitCaptainPayment", locale);
    } else if (viewerRole === "CAPTAIN") {
      statusHint = t("pairingHintAwaitPartnerPayment", locale);
    } else {
      statusHint = t("pairingHintAwaitYourPaymentPartner", locale);
    }
  } else if (state === "AWAITING_ACCEPT" && viewerRole === "CAPTAIN") {
    statusHint = t("pairingHintAwaitPartnerAcceptance", locale);
  } else if (state === "AWAITING_ACCEPT" && viewerRole === "INVITED") {
    statusHint = t("pairingHintAwaitYourConfirmation", locale);
  } else if (state === "CANCELLED" && viewerRole === "CAPTAIN") {
    statusHint = t("pairingHintCancelledCaptain", locale);
  } else if (state === "CANCELLED") {
    statusHint = t("pairingHintCancelledViewer", locale);
  } else if (state === "ACTION_REQUIRED" && blockingReason) {
    statusHint = blockingDetails?.message ?? t("pairingHintRequirements", locale);
  }

  let statusLabel = statusLabelMap[state];
  if (state === "CONFIRMED") {
    statusLabel = t("pairingStatusConfirmed", locale);
  } else if (state === "EXPIRED") {
    statusLabel = t("pairingStatusExpired", locale);
  } else if (state === "CANCELLED") {
    statusLabel = t("pairingStatusCancelled", locale);
  } else if (pairing.pairingJoinMode === "LOOKING_FOR_PARTNER") {
    statusLabel = t("pairingStatusMatchmaking", locale);
    if (!statusHint) {
      statusHint = t("pairingHintMatchmaking", locale);
    }
  }

  const canSwap =
    viewerRole === "CAPTAIN" && partnerSlot
      ? partnerSlot.paymentStatus !== PadelPairingPaymentStatus.PAID
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
      statusLabel,
      statusHint,
      requiredAction,
      blockingReason,
      blockingDetails,
      paymentMode: pairing.payment_mode,
      pairingJoinMode: pairing.pairingJoinMode,
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
