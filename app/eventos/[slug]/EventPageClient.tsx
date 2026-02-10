"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ModalCheckout from "@/app/components/checkout/ModalCheckout";
import { useCheckout } from "@/app/components/checkout/contextoCheckout";
import { getTicketCopy } from "@/app/components/checkout/checkoutCopy";
import { t } from "@/lib/i18n";
import PairingInviteCard from "@/app/components/notifications/PairingInviteCard";

type WaveTicket = {
  id: string;
  name: string;
  price: number;
  currency: string;
  remaining: number | null;
  status: "on_sale" | "upcoming" | "closed" | "sold_out";
  startsAt: string | null;
  endsAt: string | null;
  available: boolean;
  isVisible: boolean;
  padelCategoryId?: number | null;
  padelCategoryLinkId?: number | null;
};

type EventPageClientProps = {
  slug: string;
  uiTickets: WaveTicket[];
  checkoutUiVariant: "DEFAULT" | "PADEL";
  locale?: string | null;
  eventIsActive?: boolean;
  padelMeta?: {
    eventId: number;
    organizationId: number | null;
    categoryId?: number | null;
    categoryLinkId?: number | null;
  };
  defaultPadelTicketId?: number | null;
};

type InvitePairing = {
  id: number;
  paymentMode?: "FULL" | "SPLIT" | string;
  payment_mode?: "FULL" | "SPLIT" | string;
  eventId: number;
  categoryId?: number | null;
  slots: Array<{
    id: number;
    slotStatus: string;
    paymentStatus: string;
    profileId: string | null;
    invitedContact: string | null;
    slotRole?: string;
    slot_role?: string;
  }>;
};

export default function EventPageClient({
  slug,
  uiTickets,
  checkoutUiVariant,
  locale,
  eventIsActive = true,
  padelMeta,
  defaultPadelTicketId,
}: EventPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { abrirCheckout, atualizarDados, irParaPasso } = useCheckout();
  const ticketCopy = getTicketCopy(checkoutUiVariant, locale);
  const fallbackTicketLabel = ticketCopy.isPadel
    ? t("ticketLabelPadel", locale)
    : t("ticketLabelDefault", locale);
  const inviteHandledRef = useRef<string | null>(null);
  const checkoutHandledRef = useRef(false);
  const pairingHandledRef = useRef<string | null>(null);
  const [inviteNotice, setInviteNotice] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inviteToken = searchParams.get("inviteToken");
  const pairingIdParam = searchParams.get("pairingId");
  const slotIdParam = searchParams.get("slotId");
  const promoParamRaw = searchParams.get("promo");
  const promoParam = promoParamRaw ? promoParamRaw.trim().toUpperCase() : null;
  const clearInviteToken = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("inviteToken");
    const query = params.toString();
    router.replace(query ? `/eventos/${slug}?${query}` : `/eventos/${slug}`);
  };

  const showInviteNotice = (message: string, tone: "success" | "error" = "success") => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setInviteNotice({ message, tone });
    noticeTimerRef.current = setTimeout(() => setInviteNotice(null), 4200);
  };

  const fallbackWaves = useMemo(() => {
    if (uiTickets && uiTickets.length > 0) return uiTickets;
    return [];
  }, [uiTickets]);

  const pairingIdValue = pairingIdParam ? Number(pairingIdParam) : null;
  const showPairingCard = Number.isFinite(pairingIdValue);

  useEffect(() => {
    const wantsCheckout = searchParams.get("checkout");
    if (!wantsCheckout || checkoutHandledRef.current) return;
    if (!eventIsActive) return;

    const visibleTickets = fallbackWaves.filter((ticket) => ticket.isVisible);
    const purchasableTickets = visibleTickets.filter(
      (ticket) => ticket.status === "on_sale" || ticket.status === "upcoming",
    );
    const preferredTicket =
      typeof defaultPadelTicketId === "number"
        ? visibleTickets.find((ticket) => Number(ticket.id) === defaultPadelTicketId)
        : null;
    const selectedTicket = preferredTicket ?? purchasableTickets[0] ?? visibleTickets[0];

    if (!selectedTicket) return;
    checkoutHandledRef.current = true;

    atualizarDados({
      slug,
      waves: visibleTickets,
      additional: { checkoutUiVariant, padelMeta, promoCode: promoParam ?? undefined },
    });

    abrirCheckout({
      slug,
      ticketId: selectedTicket.id,
      price: selectedTicket.price,
      ticketName: selectedTicket.name,
      eventId: padelMeta?.eventId ? String(padelMeta.eventId) : undefined,
      waves: visibleTickets,
      additional: { checkoutUiVariant, padelMeta, promoCode: promoParam ?? undefined },
    });

    setTimeout(() => {
      try {
        const evt = new Event("ORYA_CHECKOUT_FORCE_STEP1");
        window.dispatchEvent(evt);
      } catch {}
    }, 30);
  }, [
    abrirCheckout,
    atualizarDados,
    checkoutUiVariant,
    defaultPadelTicketId,
    fallbackWaves,
    padelMeta,
    promoParam,
    searchParams,
    slug,
    eventIsActive,
  ]);

  useEffect(() => {
    if (!inviteToken) return;
    if (inviteHandledRef.current === inviteToken) return;
    inviteHandledRef.current = inviteToken;

    let cancelled = false;

    const handleInvite = async () => {
      try {
        const resolveInviteError = (code?: string | null) => {
          switch (code) {
            case "EVENT_NOT_PUBLISHED":
              return t("inviteErrorEventNotPublished", locale);
            case "INSCRIPTIONS_NOT_OPEN":
              return t("inviteErrorInscriptionNotOpen", locale);
            case "INSCRIPTIONS_CLOSED":
              return t("inviteErrorInscriptionClosed", locale);
            case "TOURNAMENT_STARTED":
              return t("inviteErrorTournamentStarted", locale);
            case "INVITE_EXPIRED":
              return t("inviteErrorInviteExpired", locale);
            case "INVITE_ALREADY_USED":
              return t("inviteErrorInviteUsed", locale);
            case "PAIRING_EXPIRED":
              return t("inviteErrorPairingExpired", locale);
            case "PAIRING_CANCELLED":
              return t("inviteErrorPairingCancelled", locale);
            case "CATEGORY_PLAYERS_FULL":
              return t("inviteErrorCategoryFull", locale);
            case "NOT_FOUND":
              return t("inviteErrorNotFound", locale);
            case "EVENT_NOT_FOUND":
              return t("inviteErrorEventNotFound", locale);
            default:
              return code || t("inviteErrorDefault", locale);
          }
        };
        const res = await fetch(`/api/padel/pairings/claim/${encodeURIComponent(inviteToken)}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok || !json?.pairing?.id) {
          if (json?.error === "PADEL_ONBOARDING_REQUIRED") {
            const params = new URLSearchParams();
            params.set("redirectTo", `/eventos/${slug}?inviteToken=${encodeURIComponent(inviteToken)}`);
            router.push(`/onboarding/padel?${params.toString()}`);
            return;
          }
          if (json?.error === "NOT_FOUND" || json?.error === "EVENT_NOT_FOUND") {
            showInviteNotice(resolveInviteError(json?.error), "error");
            clearInviteToken();
            return;
          }
          throw new Error(resolveInviteError(json?.error));
        }

        if (cancelled) return;

        const pairing = json.pairing as InvitePairing;
        const paymentMode = pairing.paymentMode ?? pairing.payment_mode;
        const pairingMode = paymentMode === "FULL" ? "GROUP_FULL" : "GROUP_SPLIT";
        const pendingSlot =
          pairing.slots.find((s) => s.slotStatus === "PENDING" || s.paymentStatus === "UNPAID") ??
          pairing.slots[0];

        if (!pendingSlot) {
          throw new Error(t("inviteSlotMissing", locale));
        }

        const ticketTypes: Array<{ id: number; name: string; price: number; currency?: string | null }> =
          Array.isArray(json.ticketTypes) ? json.ticketTypes : [];

        const preferredTicketId =
          typeof defaultPadelTicketId === "number" && ticketTypes.some((t) => t.id === defaultPadelTicketId)
            ? defaultPadelTicketId
            : ticketTypes.length > 0
              ? ticketTypes[0].id
              : null;

        const fallbackTicket =
          typeof preferredTicketId === "number"
            ? ticketTypes.find((t) => t.id === preferredTicketId) ?? ticketTypes[0]
            : ticketTypes[0];

        const ticketFromWaves =
          typeof preferredTicketId === "number"
            ? fallbackWaves.find((w) => Number(w.id) === preferredTicketId)
            : null;

        const ticketId = ticketFromWaves
          ? Number(ticketFromWaves.id)
          : fallbackTicket?.id ?? null;

        if (!ticketId) {
          throw new Error(t("invalidTicketForInvite", locale));
        }

        const unitPrice =
          ticketFromWaves?.price ??
          (typeof fallbackTicket?.price === "number" ? fallbackTicket.price : 0);

        const ticketName =
          ticketFromWaves?.name ??
          (fallbackTicket?.name || fallbackTicketLabel);

        const waves =
          fallbackWaves.length > 0
            ? fallbackWaves
            : ticketTypes.map((t) => ({
                id: String(t.id),
                name: t.name ?? ticketCopy.singularCap,
                price: t.price ?? 0,
                currency: t.currency ?? "EUR",
                remaining: null,
                status: "on_sale" as const,
                startsAt: null,
                endsAt: null,
                available: true,
                isVisible: true,
              }));

        const quantity = pairingMode === "GROUP_FULL" ? 2 : 1;
        const total = unitPrice * quantity;

        const pairingCategoryId =
          typeof json?.pairing?.categoryId === "number" ? json.pairing.categoryId : null;
        const metaFromInvite = {
          eventId: pairing.eventId,
          organizationId: json.organizationId ?? null,
          categoryId: pairingCategoryId,
          categoryLinkId: ticketFromWaves?.padelCategoryLinkId ?? null,
        };

        if (pendingSlot.paymentStatus === "PAID") {
          showInviteNotice(t("invitePaymentConfirmed", locale), "success");
          clearInviteToken();
          return;
        }

        const additional = {
          checkoutUiVariant,
          padelMeta: metaFromInvite,
          pairingId: pairing.id,
          pairingSlotId: pendingSlot.id,
          ticketTypeId: ticketId,
          inviteToken,
          quantidades: { [ticketId]: quantity },
          total,
          promoCode: promoParam ?? undefined,
        };

        abrirCheckout({
          slug,
          ticketId: String(ticketId),
          price: unitPrice,
          ticketName,
          eventId: String(pairing.eventId),
          waves,
          additional,
          pairingId: pairing.id,
          pairingSlotId: pendingSlot.id,
          ticketTypeId: ticketId,
        });
        atualizarDados({
          paymentScenario: pairingMode,
          additional,
        });
        irParaPasso(2);
        clearInviteToken();
      } catch (err) {
        console.error("[EventPageClient] convite padel", err);
        showInviteNotice(
          err instanceof Error ? err.message : t("inviteProcessError", locale),
          "error",
        );
      }
    };

    void handleInvite();

    return () => {
      cancelled = true;
    };
  }, [
    abrirCheckout,
    atualizarDados,
    checkoutUiVariant,
    defaultPadelTicketId,
    fallbackWaves,
    inviteToken,
    irParaPasso,
    padelMeta,
    promoParam,
    router,
    searchParams,
    slug,
    locale,
  ]);

  useEffect(() => {
    if (!pairingIdParam || inviteToken) return;
    if (pairingHandledRef.current === pairingIdParam) return;
    pairingHandledRef.current = pairingIdParam;

    let cancelled = false;

    const handlePairingCheckout = async () => {
      try {
        const res = await fetch(`/api/padel/pairings?id=${encodeURIComponent(pairingIdParam)}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok || !json?.pairing?.id) {
          throw new Error(json?.error || t("inviteCheckoutUnavailable", locale));
        }

        if (cancelled) return;

        const pairing = json.pairing as InvitePairing;
        const pendingSlot =
          typeof slotIdParam === "string"
            ? pairing.slots.find((s) => String(s.id) === slotIdParam)
            : pairing.slots.find((s) => s.slotStatus === "PENDING" || s.paymentStatus === "UNPAID");

        if (!pendingSlot) {
          showInviteNotice(t("inviteNoPendingPayment", locale), "error");
          return;
        }

        const ticketTypes: Array<{ id: number; name: string; price: number; currency?: string | null }> =
          Array.isArray(json.ticketTypes) ? json.ticketTypes : [];
        const preferredTicketId =
          typeof defaultPadelTicketId === "number" && ticketTypes.some((t) => t.id === defaultPadelTicketId)
            ? defaultPadelTicketId
            : ticketTypes.length > 0
              ? ticketTypes[0].id
              : null;
        const fallbackTicket =
          typeof preferredTicketId === "number"
            ? ticketTypes.find((t) => t.id === preferredTicketId) ?? ticketTypes[0]
            : ticketTypes[0];

        const ticketId = fallbackTicket?.id ?? null;
        if (!ticketId) {
          throw new Error(t("invalidTicketForCheckout", locale));
        }

        const unitPrice =
          typeof fallbackTicket?.price === "number" ? fallbackTicket.price : 0;
        const ticketName = fallbackTicket?.name || fallbackTicketLabel;
        const waves =
          fallbackWaves.length > 0
            ? fallbackWaves
            : ticketTypes.map((t) => ({
                id: String(t.id),
                name: t.name ?? ticketCopy.singularCap,
                price: t.price ?? 0,
                currency: t.currency ?? "EUR",
                remaining: null,
                status: "on_sale" as const,
                startsAt: null,
                endsAt: null,
                available: true,
                isVisible: true,
              }));

        const pairingMode = pairing.paymentMode === "FULL" ? "GROUP_FULL" : "GROUP_SPLIT";
        const quantity = pairingMode === "GROUP_FULL" ? 2 : 1;

        const metaFromPairing = {
          eventId: pairing.eventId,
          organizationId: json.padelEvent?.organizationId ?? padelMeta?.organizationId ?? null,
          categoryId: pairing.categoryId ?? padelMeta?.categoryId ?? null,
          categoryLinkId: null,
        };

        const additional = {
          checkoutUiVariant,
          padelMeta: metaFromPairing,
          pairingId: pairing.id,
          pairingSlotId: pendingSlot.id,
          ticketTypeId: ticketId,
          quantidades: { [ticketId]: quantity },
          total: unitPrice * quantity,
          promoCode: promoParam ?? undefined,
        };

        abrirCheckout({
          slug,
          ticketId: String(ticketId),
          price: unitPrice,
          ticketName,
          eventId: String(pairing.eventId),
          waves,
          additional,
          pairingId: pairing.id,
          pairingSlotId: pendingSlot.id,
          ticketTypeId: ticketId,
        });
        atualizarDados({
          paymentScenario: pairingMode,
          additional,
        });
        irParaPasso(2);
      } catch (err) {
        console.error("[EventPageClient] pairing checkout", err);
        showInviteNotice(
          err instanceof Error ? err.message : t("inviteCheckoutError", locale),
          "error",
        );
      }
    };

    void handlePairingCheckout();

    return () => {
      cancelled = true;
    };
  }, [
    abrirCheckout,
    atualizarDados,
    checkoutUiVariant,
    defaultPadelTicketId,
    fallbackWaves,
    inviteToken,
    irParaPasso,
    padelMeta,
    pairingIdParam,
    promoParam,
    slotIdParam,
    slug,
    locale,
  ]);

  return (
    <>
      {inviteNotice && (
        <div className="fixed top-24 right-6 z-50 max-w-sm">
          <div
            className={`rounded-2xl border px-4 py-3 text-sm shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur ${
              inviteNotice.tone === "success"
                ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                : "border-rose-300/40 bg-rose-300/10 text-rose-100"
            }`}
          >
            {inviteNotice.message}
          </div>
        </div>
      )}
      {showPairingCard && (
        <div className="fixed bottom-6 right-6 z-40 w-[320px] max-w-[90vw]">
          <PairingInviteCard
            title="Estado da dupla"
            payload={{ pairingId: pairingIdValue as number }}
            fallbackUrl="/me/carteira"
            fallbackLabel="Ver carteira"
            compact
          />
        </div>
      )}
      <ModalCheckout />
    </>
  );
}
