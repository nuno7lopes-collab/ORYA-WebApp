import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let authUser: { id: string } | null = { id: "operator-1" };
let eventState: { organizationId: number; status: string; isDeleted: boolean } = {
  organizationId: 99,
  status: "PUBLISHED",
  isDeleted: false,
};

const prisma = vi.hoisted(() => {
  const client: any = {
    event: {
      findUnique: vi.fn(async () => eventState),
    },
    organization: {
      findUnique: vi.fn(async () => ({ officialEmail: "ops@org.test", officialEmailVerifiedAt: new Date() })),
    },
    profile: {
      findUnique: vi.fn(async () => ({
        roles: [],
        onboardingDone: true,
        fullName: "Operador",
        username: "operador",
      })),
    },
  };
  return { prisma: client };
});

vi.mock("@/lib/prisma", () => prisma);
vi.mock("@/lib/supabaseServer", () => ({
  createSupabaseServer: vi.fn(async () => ({ auth: { getUser: async () => ({ data: { user: authUser }, error: null }) } })),
}));
vi.mock("@/lib/auth/getUserWithPolicy", () => ({
  getUserWithPolicy: vi.fn(async () => ({ data: { user: authUser }, error: null })),
}));
vi.mock("@/lib/auth/rateLimit", () => ({
  rateLimit: vi.fn(async () => ({ allowed: true, retryAfter: 0 })),
}));
vi.mock("@/lib/organizationWriteAccess", () => ({
  ensureOrganizationEmailVerified: vi.fn(() => ({ ok: true })),
}));
vi.mock("@/lib/organizationMemberAccess", () => ({
  ensureGroupMemberCheckinAccess: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/checkin/policy", () => ({
  buildDefaultCheckinWindow: vi.fn(() => ({ start: null, end: null })),
  isOutsideWindow: vi.fn(() => false),
}));
vi.mock("@/lib/checkin/accessPolicy", () => ({
  resolvePolicyForCheckin: vi.fn(async () => ({ ok: true, policy: { checkinMethods: ["QR_TICKET"] } })),
  resolveCheckinMethodForEntitlement: vi.fn(() => "QR_TICKET"),
}));
vi.mock("@/domain/eventLog/append", () => ({ appendEventLog: vi.fn(async () => null) }));
vi.mock("@/lib/crm/ingest", () => ({ ingestCrmInteraction: vi.fn(async () => null) }));
vi.mock("@/lib/chat/invites", () => ({ ensureEventChatInvite: vi.fn(async () => ({ ok: true, created: false })) }));
vi.mock("@/lib/notifications", () => ({ createNotification: vi.fn(async () => null) }));
vi.mock("@/lib/observability/logger", () => ({ logWarn: vi.fn(), logError: vi.fn() }));

import { POST } from "@/app/api/org/[orgId]/checkin/route";

describe("org checkin route status guard", () => {
  beforeEach(() => {
    authUser = { id: "operator-1" };
    eventState = { organizationId: 99, status: "PUBLISHED", isDeleted: false };
  });

  it("bloqueia check-in quando evento está cancelado", async () => {
    eventState.status = "CANCELLED";

    const req = new NextRequest("http://localhost/api/org/99/checkin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ qrToken: "token", eventId: 7, deviceId: "device-1" }),
    });

    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(409);
    expect(json.ok).toBe(false);
    expect(json.errorCode).toBe("EVENT_CANCELLED_TERMINAL");
  });
});
