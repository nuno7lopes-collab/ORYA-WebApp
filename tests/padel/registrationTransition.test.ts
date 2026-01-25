import { describe, expect, it, vi, beforeEach } from "vitest";
import { PadelPaymentMode, PadelRegistrationStatus } from "@prisma/client";
import { transitionPadelRegistrationStatus } from "@/domain/padelRegistration";
import { recordOutboxEvent } from "@/domain/outbox/producer";

vi.mock("@/domain/outbox/producer", () => ({
  recordOutboxEvent: vi.fn(async () => ({ eventId: "evt_1" })),
}));
vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: vi.fn(async () => null),
}));

const recordOutboxEventMock = vi.mocked(recordOutboxEvent);

describe("padel registration transitions (D12.2)", () => {
  let registration: { id: string; pairingId: number; status: PadelRegistrationStatus } | null;
  let tx: any;

  beforeEach(() => {
    registration = { id: "reg_1", pairingId: 10, status: PadelRegistrationStatus.PENDING_PAYMENT };
    recordOutboxEventMock.mockClear();
    tx = {
      padelPairing: {
        findUnique: vi.fn(() => ({
          eventId: 1,
          organizationId: 2,
          payment_mode: PadelPaymentMode.SPLIT,
        })),
      },
      padelRegistration: {
        findUnique: vi.fn(() => registration),
        update: vi.fn(({ data }: any) => {
          registration = registration ? { ...registration, ...data } : null;
          return registration;
        }),
        create: vi.fn(({ data }: any) => {
          registration = { id: "reg_1", pairingId: data.pairingId, status: data.status };
          return registration;
        }),
      },
    };
  });

  it("escreve outbox em mudança de estado", async () => {
    await transitionPadelRegistrationStatus(tx, {
      pairingId: 10,
      status: PadelRegistrationStatus.CONFIRMED,
      paymentMode: PadelPaymentMode.SPLIT,
      secondChargeConfirmed: true,
      reason: "TEST_STATUS_CHANGE",
    });

    expect(recordOutboxEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "PADREG_STATUS_CHANGED" }),
      tx,
    );
  });

  it("bloqueia transição inválida após terminal", async () => {
    registration = { id: "reg_1", pairingId: 10, status: PadelRegistrationStatus.CANCELLED };
    await expect(
      transitionPadelRegistrationStatus(tx, {
        pairingId: 10,
        status: PadelRegistrationStatus.PENDING_PAYMENT,
      }),
    ).rejects.toThrow("PADREG_TERMINAL_STATUS");
  });

  it("emite second charge due sem mudar estado", async () => {
    await transitionPadelRegistrationStatus(tx, {
      pairingId: 10,
      status: PadelRegistrationStatus.PENDING_PAYMENT,
      emitSecondChargeDue: true,
      reason: "SECOND_CHARGE_DUE",
    });

    const eventTypes = recordOutboxEventMock.mock.calls.map((call) => call[0].eventType);
    expect(eventTypes).toContain("PADREG_SPLIT_SECOND_CHARGE_DUE");
    expect(eventTypes).not.toContain("PADREG_STATUS_CHANGED");
  });
});
