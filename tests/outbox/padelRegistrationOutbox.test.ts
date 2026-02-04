import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PadelPairingPaymentStatus,
  PadelPairingSlotStatus,
  PadelPairingStatus,
  PadelPaymentMode,
  PadelRegistrationStatus,
} from "@prisma/client";
import { handlePadelRegistrationOutboxEvent } from "@/domain/padelRegistrationOutbox";
import { attemptPadelSecondChargeForPairing } from "@/domain/padelSecondCharge";
import { enqueueOperation } from "@/lib/operations/enqueue";
import { prisma } from "@/lib/prisma";

vi.mock("@/domain/padelSecondCharge", () => ({
  attemptPadelSecondChargeForPairing: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/operations/enqueue", () => ({
  enqueueOperation: vi.fn(async () => null),
}));

let pairingState: any = null;
let registrationState: any = null;

vi.mock("@/lib/prisma", () => {
  const padelRegistration = {
    findUnique: vi.fn(({ where }: any) => {
      if (where?.id === registrationState?.id) return registrationState;
      return null;
    }),
  };
  const padelPairing = {
    findUnique: vi.fn(() => ({
      id: pairingState?.id ?? 0,
      player1UserId: null,
      player2UserId: null,
      slots: [],
    })),
    update: vi.fn(({ data }: any) => {
      Object.assign(pairingState, data);
      return pairingState;
    }),
  };
  const padelPairingSlot = {
    updateMany: vi.fn(() => ({ count: 2 })),
  };
  const padelPairingHold = {
    updateMany: vi.fn(() => ({ count: 1 })),
  };
  const ticket = {
    update: vi.fn(() => ({ id: "t1" })),
  };
  const payment = {
    findMany: vi.fn(() => []),
  };
  const paymentEvent = {
    findMany: vi.fn(() => []),
  };
  const prisma = {
    padelRegistration,
    padelPairing,
    padelPairingSlot,
    padelPairingHold,
    ticket,
    payment,
    paymentEvent,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

const prismaMock = vi.mocked(prisma);
const secondChargeMock = vi.mocked(attemptPadelSecondChargeForPairing);
const enqueueMock = vi.mocked(enqueueOperation);

describe("padel registration outbox consumer", () => {
  beforeEach(() => {
    pairingState = {
      id: 10,
      payment_mode: PadelPaymentMode.SPLIT,
      pairingStatus: PadelPairingStatus.INCOMPLETE,
      slots: [
        {
          paymentStatus: PadelPairingPaymentStatus.PAID,
          ticket: { id: "t1", purchaseId: "pur_1", stripePaymentIntentId: "pi_1" },
        },
      ],
    };
    registrationState = {
      id: "reg_1",
      status: PadelRegistrationStatus.CONFIRMED,
      organizationId: 1,
      eventId: 99,
      pairingId: 10,
      pairing: pairingState,
    };
    prismaMock.padelPairing.update.mockClear();
    prismaMock.padelPairingSlot.updateMany.mockClear();
    prismaMock.padelPairingHold.updateMany.mockClear();
    prismaMock.ticket.update.mockClear();
    prismaMock.payment.findMany.mockClear();
    prismaMock.paymentEvent.findMany.mockClear();
    secondChargeMock.mockClear();
    enqueueMock.mockClear();
  });

  it("sync lifecycle status e é idempotente", async () => {
    await handlePadelRegistrationOutboxEvent({
      eventType: "PADREG_STATUS_CHANGED",
      payload: { registrationId: "reg_1" },
    });
    expect(prismaMock.padelPairing.update).not.toHaveBeenCalled();

    await handlePadelRegistrationOutboxEvent({
      eventType: "PADREG_STATUS_CHANGED",
      payload: { registrationId: "reg_1" },
    });
    expect(prismaMock.padelPairing.update).not.toHaveBeenCalled();
  });

  it("processa second charge due (idempotente)", async () => {
    await handlePadelRegistrationOutboxEvent({
      eventType: "PADREG_SPLIT_SECOND_CHARGE_DUE",
      payload: { registrationId: "reg_1" },
    });
    expect(secondChargeMock).toHaveBeenCalledWith({ pairingId: 10 });
  });

  it("expira e cancela pairing/holds", async () => {
    prismaMock.payment.findMany.mockResolvedValueOnce([{ id: "pur_1" }] as any);
    prismaMock.paymentEvent.findMany.mockResolvedValueOnce([
      { purchaseId: "pur_1", stripePaymentIntentId: "pi_1" },
    ] as any);
    await handlePadelRegistrationOutboxEvent({
      eventType: "PADREG_EXPIRED",
      payload: { registrationId: "reg_1", reason: "GRACE_EXPIRED" },
    });
    expect(prismaMock.padelPairingSlot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slotStatus: PadelPairingSlotStatus.CANCELLED }),
      }),
    );
    expect(prismaMock.padelPairingHold.updateMany).toHaveBeenCalled();
    expect(prismaMock.padelPairing.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pairingStatus: PadelPairingStatus.CANCELLED,
        }),
      }),
    );
    expect(enqueueMock).toHaveBeenCalled();
  });
});
