import { beforeEach, describe, expect, it, vi } from "vitest";

type RedisRecord = { value: string; expiresAt: number };

const redisStore = vi.hoisted(() => new Map<string, RedisRecord>());

const nowMs = () => Date.now();

const readRedis = (key: string) => {
  const entry = redisStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= nowMs()) {
    redisStore.delete(key);
    return null;
  }
  return entry.value;
};

const redisClient = vi.hoisted(() => ({
  get: vi.fn(async (key: string) => readRedis(key)),
  set: vi.fn(async (key: string, value: string, opts?: { NX?: boolean; XX?: boolean; PX?: number }) => {
    const current = readRedis(key);
    if (opts?.NX && current) return null;
    if (opts?.XX && !current) return null;
    const ttlMs = Math.max(1, Number(opts?.PX ?? 300_000));
    redisStore.set(key, { value, expiresAt: nowMs() + ttlMs });
    return "OK";
  }),
  del: vi.fn(async (key: string) => (redisStore.delete(key) ? 1 : 0)),
}));

const isRedisConfigured = vi.hoisted(() => vi.fn(() => true));
const getRedisCommandClient = vi.hoisted(() => vi.fn(async () => redisClient));

const prisma = vi.hoisted(() => ({
  $executeRaw: vi.fn(async () => 1),
  $queryRaw: vi.fn(async () => []),
  $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(prisma)),
}));

vi.mock("@/lib/prisma", () => ({ prisma }));
vi.mock("@/lib/redis/client", () => ({
  isRedisConfigured,
  getRedisCommandClient,
}));

describe("hold service", () => {
  beforeEach(() => {
    redisStore.clear();
    redisClient.get.mockClear();
    redisClient.set.mockClear();
    redisClient.del.mockClear();
    isRedisConfigured.mockReset();
    isRedisConfigured.mockReturnValue(true);
    getRedisCommandClient.mockClear();
    prisma.$executeRaw.mockClear();
    prisma.$queryRaw.mockClear();
    prisma.$transaction.mockClear();
    prisma.$queryRaw.mockResolvedValue([]);
  });

  it("double-checkout: segundo hold para o mesmo slot falha com SLOT_NOT_AVAILABLE", async () => {
    const { createCheckoutHold } = await import("@/lib/holds/service");

    const payload = {
      orgId: 77,
      subjectType: "SERVICE",
      subjectFingerprint: "org:77|type:SERVICE|service:10|start:2030-02-01T10:00:00.000Z|duration:60|resources:|professional:",
      clientSessionId: "sess_abc123456789",
      metadata: { subjectLabel: "Teste" },
    } as const;

    const first = await createCheckoutHold(payload);
    const second = await createCheckoutHold(payload);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("SLOT_NOT_AVAILABLE");
    }

    const redisKey = [...redisStore.keys()][0] ?? "";
    const redisRaw = redisKey ? redisStore.get(redisKey)?.value ?? "" : "";
    expect(redisRaw).not.toContain("userId");
  });

  it("valida ownership do hold por clientSessionId", async () => {
    const { createCheckoutHold, verifyCheckoutHoldOwnership } = await import("@/lib/holds/service");

    const created = await createCheckoutHold({
      orgId: 99,
      subjectType: "SERVICE",
      subjectFingerprint: "slot:fingerprint:123",
      clientSessionId: "sess_owner_123456",
      metadata: {},
    });

    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const ok = await verifyCheckoutHoldOwnership({
      holdId: created.data.holdId,
      orgId: 99,
      subjectType: "SERVICE",
      subjectFingerprint: "slot:fingerprint:123",
      clientSessionId: "sess_owner_123456",
    });
    const denied = await verifyCheckoutHoldOwnership({
      holdId: created.data.holdId,
      orgId: 99,
      subjectType: "SERVICE",
      subjectFingerprint: "slot:fingerprint:123",
      clientSessionId: "sess_other_123456",
    });

    expect(ok.ok).toBe(true);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe("SLOT_NOT_AVAILABLE");
    }
  });
});
