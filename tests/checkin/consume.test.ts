import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("@prisma/client", async () => {
  const actual = await vi.importActual<any>("@prisma/client");
  return {
    ...actual,
    EntitlementStatus: {
      ACTIVE: "ACTIVE",
      USED: "USED",
      REFUNDED: "REFUNDED",
      REVOKED: "REVOKED",
      SUSPENDED: "SUSPENDED",
    },
    EntitlementType: {
      EVENT_TICKET: "EVENT_TICKET",
      PADEL_ENTRY: "PADEL_ENTRY",
    },
    CheckinResultCode: {
      OK: "OK",
      ALREADY_USED: "ALREADY_USED",
      INVALID: "INVALID",
      REFUNDED: "REFUNDED",
      REVOKED: "REVOKED",
      SUSPENDED: "SUSPENDED",
      NOT_ALLOWED: "NOT_ALLOWED",
      OUTSIDE_WINDOW: "OUTSIDE_WINDOW",
    },
    CheckinMethod: {
      QR_TICKET: "QR_TICKET",
      QR_REGISTRATION: "QR_REGISTRATION",
      QR_BOOKING: "QR_BOOKING",
      MANUAL: "MANUAL",
    },
  };
});

import { POST } from "@/app/api/internal/checkin/consume/route";
import { CheckinResultCode, EntitlementStatus, EntitlementType, CheckinMethod } from "@prisma/client";

type CheckinRow = { resultCode: string; checkedInAt: Date };

let checkins: CheckinRow[] = [];
let entitlementState: any = null;
let policyState: any = null;
let eventState: any = null;

vi.mock("@/lib/prisma", () => {
  const entitlementCheckin = {
    findUnique: vi.fn(({ where }: any) => {
      const key = where?.eventId_entitlementId;
      if (!key) return null;
      return checkins.length ? checkins[0] : null;
    }),
    create: vi.fn(({ data, select }: any) => {
      const row = { resultCode: data.resultCode, checkedInAt: new Date() };
      checkins.push(row);
      return select ? row : { ...data, ...row };
    }),
  };
  const entitlementQrToken = {
    findUnique: vi.fn(() => ({
      id: 1,
      tokenHash: "hash",
      entitlement: entitlementState,
      expiresAt: null,
    })),
  };
  const event = {
    findUnique: vi.fn(() => eventState),
  };
  const eventAccessPolicy = {
    findFirst: vi.fn(() => policyState),
    findUnique: vi.fn(() => policyState),
  };
  const prisma = {
    entitlementCheckin,
    entitlementQrToken,
    event,
    eventAccessPolicy,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

vi.mock("@/lib/organizationAudit", () => ({
  recordOrganizationAuditSafe: vi.fn(),
}));

function makeReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/internal/checkin/consume", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-ORYA-CRON-SECRET": "secret",
    },
    body: JSON.stringify(body),
  });
}

describe("checkin.consume v7", () => {
  beforeEach(() => {
    process.env.ORYA_CRON_SECRET = "secret";
    checkins = [];
    policyState = {
      eventId: 1,
      policyVersion: 2,
      checkinMethods: [CheckinMethod.QR_TICKET],
      requiresEntitlementForEntry: true,
    };
    eventState = { id: 1, startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 60_000), organizationId: 10 };
    entitlementState = {
      id: "ent-1",
      eventId: 1,
      type: EntitlementType.EVENT_TICKET,
      status: EntitlementStatus.ACTIVE,
      purchaseId: "p-1",
      policyVersionApplied: 2,
      checkins: [],
    };
  });

  it("happy path consume + idempotência", async () => {
    const res1 = await POST(makeReq({ qrPayload: "token", eventId: 1, deviceId: "dev-1" }) as any);
    const json1 = await res1.json();
    expect(json1.data.allow).toBe(true);
    expect(json1.data.entitlementId).toBe("ent-1");
    entitlementState.checkins = checkins;

    const res2 = await POST(makeReq({ qrPayload: "token", eventId: 1, deviceId: "dev-1" }) as any);
    const json2 = await res2.json();
    expect(json2.data.allow).toBe(false);
    expect(json2.data.reasonCode).toBe(CheckinResultCode.ALREADY_USED);
  });

  it("policyVersionApplied obrigatório quando existe policy", async () => {
    entitlementState.policyVersionApplied = null;
    const res = await POST(makeReq({ qrPayload: "token", eventId: 1 }) as any);
    const json = await res.json();
    expect(json.data.allow).toBe(false);
    expect(json.data.reasonCode).toBe(CheckinResultCode.NOT_ALLOWED);
  });

  it("SUSPENDED/REVOKED bloqueiam check-in", async () => {
    entitlementState.status = EntitlementStatus.SUSPENDED;
    let res = await POST(makeReq({ qrPayload: "token", eventId: 1 }) as any);
    let json = await res.json();
    expect(json.data.reasonCode).toBe(CheckinResultCode.SUSPENDED);

    entitlementState.status = EntitlementStatus.REVOKED;
    res = await POST(makeReq({ qrPayload: "token", eventId: 1 }) as any);
    json = await res.json();
    expect(json.data.reasonCode).toBe(CheckinResultCode.REVOKED);
  });
});
