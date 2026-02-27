import { describe, expect, it, beforeEach, vi } from "vitest";

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
    EntitlementType: {
      EVENT_TICKET: "EVENT_TICKET",
      PADEL_ENTRY: "PADEL_ENTRY",
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
type ChatAccessGrantRow = {
  id: string;
  kind: string;
  eventId: number | null;
  entitlementId: string | null;
  status: string;
  threadId: string | null;
  conversationId: string | null;
  targetUserId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const { createNotificationMock, logErrorMock, logWarnMock } = vi.hoisted(() => ({
  createNotificationMock: vi.fn(),
  logErrorMock: vi.fn(),
  logWarnMock: vi.fn(),
}));

let checkins: CheckinRow[] = [];
let entitlementState: any = null;
let policyState: any = null;
let eventState: any = null;
let chatAccessGrants: ChatAccessGrantRow[] = [];
let failInviteLookup = false;

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
  const chatConversation = {
    findFirst: vi.fn(() => {
      if (failInviteLookup) throw new TypeError("chatConversation.findFirst unavailable");
      return { id: "conv-1" };
    }),
  };
  const chatAccessGrant = {
    findFirst: vi.fn(({ where }: any) => {
      const rows = chatAccessGrants.filter(
        (row) =>
          row.kind === (where?.kind ?? row.kind) &&
          row.eventId === (where?.eventId ?? row.eventId) &&
          row.entitlementId === (where?.entitlementId ?? row.entitlementId),
      );
      const row = rows[rows.length - 1] ?? null;
      if (!row) return null;
      return { id: row.id, status: row.status, threadId: row.threadId };
    }),
    update: vi.fn(({ where, data }: any) => {
      const row = chatAccessGrants.find((item) => item.id === where?.id);
      if (!row) throw new Error("chatAccessGrant not found");
      row.status = data?.status ?? row.status;
      row.threadId = data?.threadId ?? row.threadId;
      row.conversationId = data?.conversationId ?? row.conversationId;
      row.targetUserId = data?.targetUserId ?? row.targetUserId;
      row.expiresAt = data?.expiresAt ?? row.expiresAt;
      row.updatedAt = data?.updatedAt ?? new Date();
      return row;
    }),
    create: vi.fn(({ data, select }: any) => {
      const row: ChatAccessGrantRow = {
        id: `grant-${chatAccessGrants.length + 1}`,
        kind: data.kind,
        eventId: data.eventId ?? null,
        entitlementId: data.entitlementId ?? null,
        status: data.status ?? "PENDING",
        threadId: data.threadId ?? null,
        conversationId: data.conversationId ?? null,
        targetUserId: data.targetUserId ?? null,
        expiresAt: data.expiresAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      chatAccessGrants.push(row);
      return select ? { id: row.id, threadId: row.threadId } : row;
    }),
  };
  const prisma = {
    entitlementCheckin,
    entitlementQrToken,
    event,
    eventAccessPolicy,
    chatConversation,
    chatAccessGrant,
    $transaction: async (fn: any) => fn(prisma),
  };
  return { prisma };
});

vi.mock("@/lib/organizationAudit", () => ({
  recordOrganizationAuditSafe: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: createNotificationMock,
}));

vi.mock("@/lib/observability/logger", () => ({
  logError: logErrorMock,
  logWarn: logWarnMock,
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
    chatAccessGrants = [];
    failInviteLookup = false;
    createNotificationMock.mockReset();
    logErrorMock.mockReset();
    logWarnMock.mockReset();
    policyState = {
      eventId: 1,
      policyVersion: 2,
      checkinMethods: [CheckinMethod.QR_TICKET],
      requiresEntitlementForEntry: true,
    };
    eventState = {
      id: 1,
      title: "Evento Teste",
      slug: "evento-teste",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 60_000),
      organizationId: 10,
      status: "PUBLISHED",
      isDeleted: false,
    };
    entitlementState = {
      id: "ent-1",
      eventId: 1,
      type: EntitlementType.EVENT_TICKET,
      status: EntitlementStatus.ACTIVE,
      ownerUserId: "user-1",
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
    expect(createNotificationMock).toHaveBeenCalledTimes(1);
    entitlementState.checkins = checkins;

    const res2 = await POST(makeReq({ qrPayload: "token", eventId: 1, deviceId: "dev-1" }) as any);
    const json2 = await res2.json();
    expect(json2.data.allow).toBe(false);
    expect(json2.data.reasonCode).toBe(CheckinResultCode.ALREADY_USED);
    expect(createNotificationMock).toHaveBeenCalledTimes(1);
    expect(logErrorMock).not.toHaveBeenCalled();
  });

  it("não bloqueia o checkin quando o convite de chat falha", async () => {
    failInviteLookup = true;

    const res = await POST(makeReq({ qrPayload: "token", eventId: 1, deviceId: "dev-1" }) as any);
    const json = await res.json();
    expect(json.data.allow).toBe(true);
    expect(json.data.entitlementId).toBe("ent-1");
    expect(createNotificationMock).not.toHaveBeenCalled();
    expect(logErrorMock).toHaveBeenCalledWith(
      "internal.checkin.invite_failed",
      expect.any(Error),
      expect.objectContaining({ requestId: expect.any(String) }),
    );
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

  it("PENDING/EXPIRED bloqueiam check-in", async () => {
    entitlementState.status = EntitlementStatus.PENDING;
    let res = await POST(makeReq({ qrPayload: "token", eventId: 1 }) as any);
    let json = await res.json();
    expect(json.data.reasonCode).toBe(CheckinResultCode.NOT_ALLOWED);

    entitlementState.status = EntitlementStatus.EXPIRED;
    res = await POST(makeReq({ qrPayload: "token", eventId: 1 }) as any);
    json = await res.json();
    expect(json.data.reasonCode).toBe(CheckinResultCode.NOT_ALLOWED);
  });

  it("bloqueia check-in interno quando evento está cancelado", async () => {
    eventState.status = "CANCELLED";

    const res = await POST(makeReq({ qrPayload: "token", eventId: 1, deviceId: "dev-1" }) as any);
    const json = await res.json();

    expect(json.data.allow).toBe(false);
    expect(json.data.reasonCode).toBe(CheckinResultCode.NOT_ALLOWED);
    expect(createNotificationMock).not.toHaveBeenCalled();
  });
});
