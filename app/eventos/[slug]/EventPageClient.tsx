"use client";

import { useEffect } from "react";
import { useCheckout } from "@/app/components/checkout/checkoutContext";
import CheckoutModal from "@/app/components/checkout/CheckoutModal";
import CheckoutStep1Tickets from "@/app/components/checkout/CheckoutStep1Tickets";
import CheckoutStep2Payment from "@/app/components/checkout/CheckoutStep2Payment";
import CheckoutStep3Success from "@/app/components/checkout/CheckoutStep3Success";

type EventPageClientProps = {
  cover: string | null;
  event: any;
  uiTickets: any[];
  currentUserId: string | null;
};

export default function EventPageClient({
  cover,
  event,
  uiTickets,
  currentUserId,
}: EventPageClientProps) {
  const {
    modalOpen,
    closeCheckout,
    step,
    setEventId,
    setUserId,
  } = useCheckout();

  // Inicializar eventId e userId no contexto
  useEffect(() => {
    if (!event) return;

    if (event.id) {
      setEventId(event.id);
    }

    if (currentUserId) {
      setUserId(currentUserId);
    }
  }, [event, currentUserId, setEventId, setUserId]);

  return (
    <CheckoutModal
      open={modalOpen}
      onClose={closeCheckout}
      coverImageUrl={cover ?? null}
    >
      {step === 1 && <CheckoutStep1Tickets />}
      {step === 2 && <CheckoutStep2Payment />}
      {step === 3 && <CheckoutStep3Success />}
    </CheckoutModal>
  );
}