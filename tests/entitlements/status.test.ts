import { describe, expect, it, vi } from "vitest";

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<any>("@prisma/client");
  return {
    ...actual,
    EntitlementStatus: {
      PENDING: "PENDING",
      ACTIVE: "ACTIVE",
      EXPIRED: "EXPIRED",
      REVOKED: "REVOKED",
      SUSPENDED: "SUSPENDED",
    },
    CheckinResultCode: {
      OK: "OK",
      ALREADY_USED: "ALREADY_USED",
      INVALID: "INVALID",
      REVOKED: "REVOKED",
      SUSPENDED: "SUSPENDED",
      NOT_ALLOWED: "NOT_ALLOWED",
      OUTSIDE_WINDOW: "OUTSIDE_WINDOW",
    },
  };
});

import { EntitlementStatus, CheckinResultCode } from "@prisma/client";
import {
  getCheckinResultFromExisting,
  getEntitlementEffectiveStatus,
  isConsumed,
  mapEntitlementStatusToV7,
  resolveDisputeOutcome,
} from "@/lib/entitlements/status";
import { resolveActions } from "@/lib/entitlements/accessResolver";

describe("entitlements v7 compatibility", () => {
  it("status mapper mantém ACTIVE como efetivo", () => {
    expect(mapEntitlementStatusToV7(EntitlementStatus.ACTIVE)).toBe("ACTIVE");
    expect(getEntitlementEffectiveStatus({ status: EntitlementStatus.ACTIVE })).toBe("ACTIVE");
  });

  it("revoked bloqueia acesso pelo status efetivo", () => {
    const actions = resolveActions({
      type: "EVENT_TICKET" as any,
      status: EntitlementStatus.REVOKED,
      isOwner: true,
      isOrganization: false,
      isAdmin: false,
      outsideWindow: false,
    });
    expect(actions.canShowQr).toBe(false);
    expect(actions.canCheckIn).toBe(false);
  });

  it("check-in consume idempotente via helper", () => {
    const existing = { resultCode: CheckinResultCode.OK };
    expect(getCheckinResultFromExisting(existing)).toBe(CheckinResultCode.ALREADY_USED);
    expect(isConsumed({ status: EntitlementStatus.ACTIVE, checkins: [existing] })).toBe(true);
  });

  it("consumo só via metadata de check-in", () => {
    expect(isConsumed({ status: EntitlementStatus.ACTIVE, checkins: [] })).toBe(false);
    expect(
      isConsumed({ status: EntitlementStatus.ACTIVE, checkins: [{ resultCode: CheckinResultCode.OK }] }),
    ).toBe(true);
  });

  it("payment.dispute_opened/closed mapeia Ticket + Entitlement conforme v7", () => {
    expect(resolveDisputeOutcome("OPENED")).toEqual({
      entitlementStatus: "SUSPENDED",
      ticketStatus: "DISPUTED",
    });
    expect(resolveDisputeOutcome("WON")).toEqual({
      entitlementStatus: "ACTIVE",
      ticketStatus: "ACTIVE",
    });
    expect(resolveDisputeOutcome("LOST")).toEqual({
      entitlementStatus: "REVOKED",
      ticketStatus: "CHARGEBACK_LOST",
    });
  });
});
