import { StoreOrderStatus, StoreShipmentStatus } from "@prisma/client";

type TimelineEntry = { key: string; label: string; date: string };

type PaymentEvent = { status: string; createdAt: Date };

type Shipment = {
  id: number;
  status: StoreShipmentStatus | string;
  shippedAt?: Date | null;
  deliveredAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type TimelineInput = {
  orderStatus: StoreOrderStatus | string;
  createdAt: Date;
  updatedAt: Date;
  paymentEvents?: PaymentEvent[];
  shipments?: Shipment[];
};

function shipmentLabel(status: StoreShipmentStatus | string) {
  if (status === "DELIVERED") return "Entregue";
  if (status === "SHIPPED") return "Enviado";
  return "Envio em preparacao";
}

export function buildStoreOrderTimeline(input: TimelineInput): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  entries.push({
    key: "created",
    label: "Encomenda criada",
    date: input.createdAt.toISOString(),
  });

  const paymentEvents = input.paymentEvents ?? [];
  const paidEvent = paymentEvents.find((event) => event.status === "OK");
  const disputeEvent = paymentEvents.find((event) => event.status === "DISPUTED");
  const refundEvent = paymentEvents.find((event) => event.status === "REFUNDED");

  if (paidEvent) {
    entries.push({
      key: "paid",
      label: "Pagamento confirmado",
      date: paidEvent.createdAt.toISOString(),
    });
  }
  if (disputeEvent) {
    entries.push({
      key: "dispute",
      label: "Em disputa",
      date: disputeEvent.createdAt.toISOString(),
    });
  }
  if (refundEvent) {
    entries.push({
      key: "refund",
      label: "Reembolsada",
      date: refundEvent.createdAt.toISOString(),
    });
  }

  if (!paidEvent && input.orderStatus === StoreOrderStatus.PENDING) {
    entries.push({
      key: "pending",
      label: "Pagamento pendente",
      date: input.updatedAt.toISOString(),
    });
  }

  const shipments = (input.shipments ?? []).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
  for (const shipment of shipments) {
    entries.push({
      key: `shipment-${shipment.id}`,
      label: shipmentLabel(shipment.status),
      date:
        shipment.deliveredAt?.toISOString() ??
        shipment.shippedAt?.toISOString() ??
        shipment.updatedAt.toISOString() ??
        shipment.createdAt.toISOString(),
    });
  }

  if (shipments.length === 0) {
    if (input.orderStatus === StoreOrderStatus.PAID) {
      entries.push({
        key: "preparing",
        label: "Em preparacao",
        date: input.updatedAt.toISOString(),
      });
    }
    if (input.orderStatus === StoreOrderStatus.FULFILLED) {
      entries.push({
        key: "fulfilled",
        label: "Concluida",
        date: input.updatedAt.toISOString(),
      });
    }
  }

  if (input.orderStatus === StoreOrderStatus.CANCELLED) {
    entries.push({
      key: "cancelled",
      label: "Cancelada",
      date: input.updatedAt.toISOString(),
    });
  }

  if (input.orderStatus === StoreOrderStatus.PARTIAL_REFUND && !refundEvent) {
    entries.push({
      key: "partial-refund",
      label: "Reembolso parcial",
      date: input.updatedAt.toISOString(),
    });
  }

  return entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
