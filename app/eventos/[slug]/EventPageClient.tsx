"use client";

import ModalCheckout from "@/app/components/checkout/ModalCheckout";

type EventPageClientProps = {
  cover: string | null;
  event: Record<string, unknown>;
  uiTickets: Record<string, unknown>[];
  currentUserId: string | null;
};

export default function EventPageClient(props: EventPageClientProps) {
  void props;
  return <ModalCheckout />;
}
