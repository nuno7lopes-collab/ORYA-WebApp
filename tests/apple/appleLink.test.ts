import { beforeEach, describe, expect, it, vi } from "vitest";

const { identities, userIdentity, appendEventLog } = vi.hoisted(() => {
  const identities: Array<any> = [];
  const userIdentity = {
    findUnique: vi.fn(({ where }: any) => {
      const key = where.provider_providerUserId;
      return identities.find(
        (item) =>
          item.provider === key.provider && item.providerUserId === key.providerUserId,
      ) ?? null;
    }),
    upsert: vi.fn(({ where, create, update }: any) => {
      const key = where.provider_providerUserId;
      const existingIndex = identities.findIndex(
        (item) =>
          item.provider === key.provider && item.providerUserId === key.providerUserId,
      );
      if (existingIndex >= 0) {
        identities[existingIndex] = { ...identities[existingIndex], ...update };
        return identities[existingIndex];
      }
      const created = { id: `identity_${key.providerUserId}`, ...create };
      identities.push(created);
      return created;
    }),
  };
  const appendEventLog = vi.fn().mockResolvedValue({ id: "evt_1" });
  return { identities, userIdentity, appendEventLog };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    userIdentity,
    $transaction: (fn: any) => fn({ userIdentity }),
  },
}));

vi.mock("@/domain/eventLog/append", () => ({
  appendEventLog,
}));

import { linkAppleIdentity } from "@/domain/apple/linkIdentity";

describe("linkAppleIdentity", () => {
  beforeEach(() => {
    identities.length = 0;
    appendEventLog.mockClear();
  });

  it("liga identidade Apple de forma idempotente para o mesmo user", async () => {
    const first = await linkAppleIdentity({
      userId: "user_1",
      providerUserId: "apple_sub",
      email: "user@orya.pt",
      organizationId: 10,
      correlationId: "apple:apple_sub",
    });

    const second = await linkAppleIdentity({
      userId: "user_1",
      providerUserId: "apple_sub",
      email: "user@orya.pt",
      organizationId: 10,
      correlationId: "apple:apple_sub",
    });

    expect(first.id).toBe(second.id);
    expect(identities).toHaveLength(1);
    expect(appendEventLog).toHaveBeenCalled();
  });

  it("falha se o sub estiver ligado a outro user", async () => {
    await linkAppleIdentity({
      userId: "user_1",
      providerUserId: "apple_sub",
      email: "user@orya.pt",
      organizationId: 10,
      correlationId: "apple:apple_sub",
    });

    await expect(
      linkAppleIdentity({
        userId: "user_2",
        providerUserId: "apple_sub",
        email: "other@orya.pt",
        organizationId: 10,
        correlationId: "apple:apple_sub",
      }),
    ).rejects.toThrow("APPLE_IDENTITY_ALREADY_LINKED");
  });
});
