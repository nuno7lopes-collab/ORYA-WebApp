import { describe, expect, it, vi } from "vitest";
import { CheckinMethod, EventAccessMode, InviteIdentityMatch } from "@prisma/client";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { createEventAccessPolicyVersion } from "@/lib/checkin/accessPolicy";

describe("EventAccessPolicy lock", () => {
  it("bloqueia mudança mais restritiva após venda/entitlement", async () => {
    const client = {
      event: {
        findUnique: vi.fn().mockResolvedValue({ templateType: null }),
      },
      eventAccessPolicy: {
        findFirst: vi.fn().mockResolvedValue({
          eventId: 1,
          policyVersion: 1,
          mode: EventAccessMode.PUBLIC,
          guestCheckoutAllowed: true,
          inviteTokenAllowed: true,
          inviteIdentityMatch: InviteIdentityMatch.BOTH,
          inviteTokenTtlSeconds: 3600,
          requiresEntitlementForEntry: false,
          checkinMethods: [CheckinMethod.QR_TICKET],
          scannerRequired: false,
          allowReentry: false,
          reentryWindowMinutes: 15,
          maxEntries: 1,
          undoWindowMinutes: 10,
        }),
        create: vi.fn(),
      },
      entitlement: {
        count: vi.fn().mockResolvedValue(1),
      },
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      ticketOrder: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      padelRegistration: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    await expect(
      createEventAccessPolicyVersion(
        1,
        {
          mode: EventAccessMode.INVITE_ONLY,
          guestCheckoutAllowed: false,
          inviteTokenAllowed: false,
          inviteIdentityMatch: InviteIdentityMatch.EMAIL,
          inviteTokenTtlSeconds: 3600,
          requiresEntitlementForEntry: true,
          checkinMethods: [CheckinMethod.QR_TICKET],
        },
        client as any,
      ),
    ).rejects.toThrow("ACCESS_POLICY_LOCKED");

    expect(client.eventAccessPolicy.create).not.toHaveBeenCalled();
  });

  it("bloqueia mudança mais restritiva após pagamento SUCCEEDED", async () => {
    const client = {
      event: {
        findUnique: vi.fn().mockResolvedValue({ templateType: null }),
      },
      eventAccessPolicy: {
        findFirst: vi.fn().mockResolvedValue({
          eventId: 2,
          policyVersion: 1,
          mode: EventAccessMode.PUBLIC,
          guestCheckoutAllowed: true,
          inviteTokenAllowed: true,
          inviteIdentityMatch: InviteIdentityMatch.EMAIL,
          inviteTokenTtlSeconds: 3600,
          requiresEntitlementForEntry: false,
          checkinMethods: [CheckinMethod.QR_TICKET],
          scannerRequired: false,
          allowReentry: false,
          reentryWindowMinutes: 15,
          maxEntries: 1,
          undoWindowMinutes: 10,
        }),
        create: vi.fn(),
      },
      entitlement: {
        count: vi.fn().mockResolvedValue(0),
      },
      payment: {
        findFirst: vi.fn().mockResolvedValue({ id: "pay-1" }),
      },
      ticketOrder: {
        findMany: vi.fn().mockResolvedValue([{ id: "order-1" }]),
      },
      padelRegistration: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    await expect(
      createEventAccessPolicyVersion(
        2,
        {
          mode: EventAccessMode.INVITE_ONLY,
          guestCheckoutAllowed: false,
          inviteTokenAllowed: false,
          inviteIdentityMatch: InviteIdentityMatch.EMAIL,
          inviteTokenTtlSeconds: 3600,
          requiresEntitlementForEntry: true,
          checkinMethods: [CheckinMethod.QR_TICKET],
        },
        client as any,
      ),
    ).rejects.toThrow("ACCESS_POLICY_LOCKED");

    expect(client.eventAccessPolicy.create).not.toHaveBeenCalled();
  });

  it("permite relaxar regras após lock", async () => {
    const client = {
      event: {
        findUnique: vi.fn().mockResolvedValue({ templateType: null }),
      },
      eventAccessPolicy: {
        findFirst: vi.fn().mockResolvedValue({
          eventId: 3,
          policyVersion: 1,
          mode: EventAccessMode.INVITE_ONLY,
          guestCheckoutAllowed: false,
          inviteTokenAllowed: false,
          inviteIdentityMatch: InviteIdentityMatch.EMAIL,
          inviteTokenTtlSeconds: 3600,
          requiresEntitlementForEntry: true,
          checkinMethods: [CheckinMethod.QR_TICKET],
          scannerRequired: false,
          allowReentry: false,
          reentryWindowMinutes: 15,
          maxEntries: 1,
          undoWindowMinutes: 10,
        }),
        create: vi.fn().mockResolvedValue({ id: 99 }),
      },
      entitlement: {
        count: vi.fn().mockResolvedValue(1),
      },
      payment: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      ticketOrder: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      padelRegistration: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    await createEventAccessPolicyVersion(
      3,
      {
        mode: EventAccessMode.PUBLIC,
        guestCheckoutAllowed: true,
        inviteTokenAllowed: true,
        inviteIdentityMatch: InviteIdentityMatch.BOTH,
        inviteTokenTtlSeconds: 3600,
        requiresEntitlementForEntry: true,
        checkinMethods: [CheckinMethod.QR_TICKET],
      },
      client as any,
    );

    expect(client.eventAccessPolicy.create).toHaveBeenCalled();
  });
});
