"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

export type CheckoutStep = 1 | 2 | 3;

export type CheckoutContextValue = {
  step: CheckoutStep;
  setStep: (s: CheckoutStep) => void;

  eventSlug: string | null;
  setEventSlug: (s: string | null) => void;

  coverImage: string | null;
  setCoverImage: (s: string | null) => void;

  selectedTicket: string | null;
  setSelectedTicket: (id: string | null) => void;

  qty: number;
  setQty: (n: number) => void;

  reservationId: string | null;
  setReservationId: (id: string | null) => void;

  userId: string | null;
  setUserId: (id: string | null) => void;

  eventId: string | null;
  setEventId: (id: string | null) => void;

  ticketId: string | null;
  setTicketId: (id: string | null) => void;

  price?: number | null;
  ticketName?: string | null;
  setPrice: (p: number | null) => void;
  setTicketName: (n: string | null) => void;

  modalOpen: boolean;
  openCheckout: (params: {
    slug: string;
    cover?: string | null;
    ticketId?: string | null;
    qty?: number;
    reservationId?: string | null;
    price?: number | null;
    ticketName?: string | null;
    eventId?: string | null;
  }) => void;
  closeCheckout: () => void;
};

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<CheckoutStep>(1);

  const [eventSlug, setEventSlug] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [qty, setQty] = useState<number>(1);

  const [reservationId, setReservationId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const [price, setPrice] = useState<number | null>(null);
  const [ticketName, setTicketName] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  const openCheckout = ({
    slug,
    cover = null,
    ticketId = null,
    qty = 1,
    reservationId = null,
    price = null,
    ticketName = null,
    eventId = null,
  }: {
    slug: string;
    cover?: string | null;
    ticketId?: string | null;
    qty?: number;
    reservationId?: string | null;
    price?: number | null;
    ticketName?: string | null;
    eventId?: string | null;
  }) => {
    setEventSlug(slug);
    setCoverImage(cover);
    setSelectedTicket(ticketId);
    setTicketId(ticketId);
    setQty(qty ?? 1);
    setReservationId(reservationId);

    setPrice(price ?? null);
    setTicketName(ticketName ?? null);
    setEventId(eventId);

    setStep(1);
    setModalOpen(true);
  };

  const closeCheckout = () => {
    setModalOpen(false);
  };

  return (
    <CheckoutContext.Provider
      value={{
        step,
        setStep,
        eventSlug,
        setEventSlug,
        coverImage,
        setCoverImage,
        selectedTicket,
        setSelectedTicket,
        qty,
        setQty,
        reservationId,
        setReservationId,
        userId,
        setUserId,
        eventId,
        setEventId,
        ticketId,
        setTicketId,
        price,
        setPrice,
        ticketName,
        setTicketName,
        modalOpen,
        openCheckout,
        closeCheckout,
      }}
    >
      {children}
    </CheckoutContext.Provider>
  );
}

export function useCheckout(): CheckoutContextValue {
  const ctx = useContext(CheckoutContext);
  if (!ctx)
    throw new Error("useCheckout must be used inside <CheckoutProvider>");
  return ctx;
}

// 🔥 O que tu estavas a importar na page.tsx
export const openCheckout = (...args: Parameters<CheckoutContextValue["openCheckout"]>) => {
  throw new Error(
    "openCheckout só pode ser usado dentro de um componente React com <CheckoutProvider>. Não pode ser usado num servidor."
  );
};