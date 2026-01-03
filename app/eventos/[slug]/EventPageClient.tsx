"use client";

import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import ModalCheckout from "@/app/components/checkout/ModalCheckout";
import { useCheckout } from "@/app/components/checkout/contextoCheckout";

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
  paymentMode: "FULL" | "SPLIT" | string;
  eventId: number;
  slots: Array<{
    id: number;
    slotStatus: string;
    paymentStatus: string;
    profileId: string | null;
    invitedContact: string | null;
    slotRole: string;
  }>;
};

export default function EventPageClient({
  slug,
  uiTickets,
  checkoutUiVariant,
  padelMeta,
  defaultPadelTicketId,
}: EventPageClientProps) {
  const searchParams = useSearchParams();
  const { abrirCheckout, atualizarDados, irParaPasso } = useCheckout();
  const inviteHandledRef = useRef<string | null>(null);
  const checkoutHandledRef = useRef(false);

  const inviteToken = searchParams.get("inviteToken");

  const fallbackWaves = useMemo(() => {
    if (uiTickets && uiTickets.length > 0) return uiTickets;
    return [];
  }, [uiTickets]);

  useEffect(() => {
    const wantsCheckout = searchParams.get("checkout");
    if (!wantsCheckout || checkoutHandledRef.current) return;

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
      additional: { checkoutUiVariant, padelMeta },
    });

    abrirCheckout({
      slug,
      ticketId: selectedTicket.id,
      price: selectedTicket.price,
      ticketName: selectedTicket.name,
      eventId: padelMeta?.eventId ? String(padelMeta.eventId) : undefined,
      waves: visibleTickets,
      additional: { checkoutUiVariant, padelMeta },
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
    searchParams,
    slug,
  ]);

  useEffect(() => {
    if (!inviteToken) return;
    if (inviteHandledRef.current === inviteToken) return;
    inviteHandledRef.current = inviteToken;

    let cancelled = false;

    const handleInvite = async () => {
      try {
        const res = await fetch(`/api/padel/pairings/claim/${encodeURIComponent(inviteToken)}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok || !json?.pairing?.id) {
          throw new Error(json?.error || "Convite inválido.");
        }

        if (cancelled) return;

        const pairing = json.pairing as InvitePairing;
        const pairingMode = pairing.paymentMode === "FULL" ? "GROUP_FULL" : "GROUP_SPLIT";
        const pendingSlot =
          pairing.slots.find((s) => s.slotStatus === "PENDING" || s.paymentStatus === "UNPAID") ??
          pairing.slots[0];

        if (!pendingSlot) {
          throw new Error("Não foi possível identificar o slot da dupla.");
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
          throw new Error("Bilhete inválido para este convite.");
        }

        const unitPrice =
          ticketFromWaves?.price ??
          (typeof fallbackTicket?.price === "number" ? fallbackTicket.price : 0);

        const ticketName =
          ticketFromWaves?.name ??
          (fallbackTicket?.name || "Bilhete Padel");

        const waves =
          fallbackWaves.length > 0
            ? fallbackWaves
            : ticketTypes.map((t) => ({
                id: String(t.id),
                name: t.name ?? "Bilhete",
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
          const claimRes = await fetch(`/api/padel/pairings/claim/${encodeURIComponent(inviteToken)}`, {
            method: "POST",
          });
          const claimJson = await claimRes.json().catch(() => null);
          if (!claimRes.ok || !claimJson?.ok) {
            throw new Error(claimJson?.error || "Não foi possível aceitar o convite.");
          }
          alert("Convite aceite. Já estás inscrito.");
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
        console.error("[EventPageClient] convite padel", err);
        alert(err instanceof Error ? err.message : "Erro ao processar o convite.");
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
    slug,
  ]);

  return <ModalCheckout />;
}
