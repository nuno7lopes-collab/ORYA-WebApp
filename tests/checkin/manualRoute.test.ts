import { beforeEach, describe, expect, it, vi } from "vitest";
import { CheckinMethod, CheckinResultCode, EntitlementStatus, EntitlementType } from "@prisma/client";
import { NextRequest } from "next/server";

const entitlementId = "11111111-1111-4111-8111-111111111111";
const actorUserId = "user-operator";

let authUser: { id: string } | null = { id: actorUserId };
let groupAccessOk = true;
let policyMethods: CheckinMethod[] = [CheckinMethod.MANUAL];
let existingCheckin: { resultCode: CheckinResultCode; checkedInAt: Date | null } | null = null;
let createdCheckinPayload: Record<string, unknown> | null = null;

const prisma = vi.hoisted(() => {
  const state = {
    eventDetails: {
      id: 7,
      title: "Evento Teste",
      slug: "evento-teste",
      startsAt: new Date("2026-02-16T10:00:00.000Z"),
      endsAt: new Date("2026-02-16T18:00:00.000Z"),
      organizationId: 99,
    },
    entitlement: {
      id: "11111111-1111-4111-8111-111111111111",
      eventId: 7,
      status: "ACTIVE",
      type: "EVENT_TICKET",
      ownerUserId: "holder-1",
      ownerIdentityId: null,
      purchaseId: "purchase-1",
      policyVersionApplied: 3,
      checkins: [] as Array<{ resultCode: CheckinResultCode; checkedInAt: Date | null }>,
    },
  };

  const client: any = {
    event: {
      findUnique: vi.fn(async ({ select }: any) => {
        if (select?.organizationId && !select?.id) {
          return { organizationId: state.eventDetails.organizationId };
        }
        return state.eventDetails;
      }),
    },
    organization: {
      findUnique: vi.fn(async () => ({
        officialEmail: "ops@org.test",
        officialEmailVerifiedAt: new Date(),
      })),
    },
    profile: {
      findUnique: vi.fn(async ({ where }: any) => {
        if (where?.id === actorUserId) {
          return {
            roles: [],
            onboardingDone: true,
            fullName: "Operador",
            username: "operador",
          };
        }
        return null;
      }),
    },
    entitlement: {
      findUnique: vi.fn(async () => state.entitlement),
    },
    entitlementCheckin: {
      findUnique: vi.fn(async () => existingCheckin),
      create: vi.fn(async ({ data }: any) => {
        createdCheckinPayload = data;
        existingCheckin = { resultCode: CheckinResultCode.OK, checkedInAt: new Date() };
        return { checkedInAt: existingCheckin.checkedInAt };
      }),
    },
    $transaction: vi.fn(async (fn: any) => fn(client)),
  };

  return { prisma: client, __state: state };
});

vi.mock("@/lib/prisma", () => prisma);

vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      getUser: async () => ({ data: { user: authUser }, error: authUser ? null : new Error("auth") }),
    },
  })),
}));

vi.mock("@/lib/auth/getUserWithPolicy", () => ({
  getUserWithPolicy: vi.fn(async () => ({
    data: { user: authUser },
    error: null,
  })),
}));

vi.mock("@/lib/auth/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));

vi.mock("@/lib/organizationWriteAccess", () => ({
  ensureOrganizationEmailVerified: vi.fn(() => ({ ok: true })),
}));

vi.mock("@/lib/organizationMemberAccess", () => ({
  ensureGroupMemberCheckinAccess: vi.fn(async () => ({ ok: groupAccessOk })),
}));

vi.mock("@/lib/checkin/policy", () => ({
  buildDefaultCheckinWindow: vi.fn(() => ({ start: null, end: null })),
  isOutsideWindow: vi.fn(() => false),
}));

vi.mock("@/lib/checkin/accessPolicy", () => ({
  resolvePolicyForCheckin: vi.fn(async () => ({
    ok: true,
    policy: { checkinMethods: policyMethods },
  })),
}));

vi.mock("@/lib/crm/ingest", () => ({
  ingestCrmInteraction: vi.fn(async () => null),
}));

vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog: vi.fn(async () => null),
}));

vi.mock("@/lib/chat/invites", () => ({
  ensureEventChatInvite: vi.fn(async () => ({ ok: true, created: false })),
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(async () => null),
}));

vi.mock("@/lib/observability/logger", () => ({
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { POST } from "@/app/api/org/[orgId]/checkin/manual/route";

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/org/99/checkin/manual", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("org checkin manual route", () => {
  beforeEach(() => {
    process.env.CHECKIN_MANUAL_LIST_ENABLED = "true";
    authUser = { id: actorUserId };
    groupAccessOk = true;
    policyMethods = [CheckinMethod.MANUAL];
    existingCheckin = null;
    createdCheckinPayload = null;
    prisma.__state.entitlement.status = EntitlementStatus.ACTIVE;
    prisma.__state.entitlement.eventId = 7;
    prisma.__state.entitlement.checkins = [];
  });

  it("returns 403 when user lacks EDIT permission", async () => {
    groupAccessOk = false;

    const res = await POST(
      makeReq({
        eventId: 7,
        entitlementId,
        deviceId: "device-1",
        reason: "QR ilegível no balcão",
      }) as any,
    );
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.errorCode).toBe("FORBIDDEN_CHECKIN_ACCESS");
  });

  it("returns NOT_ALLOWED when policy excludes MANUAL method", async () => {
    policyMethods = [CheckinMethod.QR_TICKET];

    const res = await POST(
      makeReq({
        eventId: 7,
        entitlementId,
        deviceId: "device-1",
        reason: "Participante sem acesso a QR",
      }) as any,
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.code).toBe(CheckinResultCode.NOT_ALLOWED);
  });

  it("returns ALREADY_USED on duplicate manual confirmation", async () => {
    existingCheckin = { resultCode: CheckinResultCode.OK, checkedInAt: new Date("2026-02-16T10:30:00.000Z") };

    const res = await POST(
      makeReq({
        eventId: 7,
        entitlementId,
        deviceId: "device-1",
        reason: "Fallback manual no posto",
      }) as any,
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.code).toBe(CheckinResultCode.ALREADY_USED);
    expect(createdCheckinPayload).toBeNull();
  });
});
