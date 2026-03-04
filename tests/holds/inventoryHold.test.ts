import { beforeEach, describe, expect, it, vi } from "vitest";

type RedisRecord = { value: string; expiresAt: number | null };

const redisStore = vi.hoisted(() => new Map<string, RedisRecord>());

const nowMs = () => Date.now();

const readRedis = (key: string) => {
  const entry = redisStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= nowMs()) {
    redisStore.delete(key);
    return null;
  }
  return entry.value;
};

const writeRedis = (key: string, value: string, ttlMs?: number | null) => {
  redisStore.set(key, {
    value,
    expiresAt:
      typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0
        ? nowMs() + ttlMs
        : null,
  });
};

const readInt = (key: string) => {
  const raw = readRedis(key);
  const parsed = Number(raw ?? "0");
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
};

const redisClient = vi.hoisted(() => ({
  get: vi.fn(async (key: string) => readRedis(key)),
  set: vi.fn(
    async (
      key: string,
      value: string,
      opts?: { NX?: boolean; XX?: boolean; PX?: number },
    ) => {
      const current = readRedis(key);
      if (opts?.NX && current) return null;
      if (opts?.XX && !current) return null;
      writeRedis(key, value, opts?.PX ?? null);
      return "OK";
    },
  ),
  del: vi.fn(async (...keys: string[]) => {
    let removed = 0;
    for (const key of keys) {
      if (redisStore.delete(key)) removed += 1;
    }
    return removed;
  }),
  incrBy: vi.fn(async (key: string, by: number) => {
    const next = readInt(key) + Math.trunc(by);
    writeRedis(key, String(next));
    return next;
  }),
  decrBy: vi.fn(async (key: string, by: number) => {
    const next = readInt(key) - Math.trunc(by);
    writeRedis(key, String(next));
    return next;
  }),
  pttl: vi.fn(async (key: string) => {
    const entry = redisStore.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(0, entry.expiresAt - nowMs());
  }),
  pexpire: vi.fn(async (key: string, ttlMs: number) => {
    const current = readRedis(key);
    if (!current) return 0;
    writeRedis(key, current, ttlMs);
    return 1;
  }),
  eval: vi.fn(
    async (
      _script: string,
      params: { keys: string[]; arguments: string[] },
    ) => {
      const [reservedKey, holdsPrefix, indexKey] = params.keys;
      const [qtyRaw, ttlRaw, holdId, holdJson, maxStockRaw] = params.arguments;
      const qty = Math.max(1, Math.trunc(Number(qtyRaw)));
      const ttlMs = Math.max(1, Math.trunc(Number(ttlRaw)));
      const maxStock = Math.max(0, Math.trunc(Number(maxStockRaw)));
      const reserved = readInt(reservedKey);
      if (reserved + qty > maxStock) {
        return JSON.stringify({
          ok: false,
          code: "OUT_OF_STOCK",
          available: Math.max(0, maxStock - reserved),
        });
      }
      const holdKey = `${holdsPrefix}:${holdId}`;
      writeRedis(reservedKey, String(reserved + qty));
      writeRedis(holdKey, holdJson, ttlMs);
      if (indexKey) {
        writeRedis(indexKey, holdJson, ttlMs);
      }
      const ttl = await redisClient.pttl(reservedKey);
      if (ttl < 0) {
        await redisClient.pexpire(reservedKey, ttlMs);
      }
      return JSON.stringify({
        ok: true,
        reserved: reserved + qty,
        available: Math.max(0, maxStock - (reserved + qty)),
      });
    },
  ),
}));

const isRedisConfigured = vi.hoisted(() => vi.fn(() => true));
const getRedisCommandClient = vi.hoisted(
  () => vi.fn(async () => redisClient),
);

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

describe("inventory hold service", () => {
  beforeEach(() => {
    redisStore.clear();
    redisClient.get.mockClear();
    redisClient.set.mockClear();
    redisClient.del.mockClear();
    redisClient.incrBy.mockClear();
    redisClient.decrBy.mockClear();
    redisClient.pttl.mockClear();
    redisClient.pexpire.mockClear();
    redisClient.eval.mockClear();
    isRedisConfigured.mockReset();
    isRedisConfigured.mockReturnValue(true);
    getRedisCommandClient.mockClear();
    prisma.$executeRaw.mockClear();
    prisma.$queryRaw.mockClear();
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.$transaction.mockClear();
  });

  it("reserva inventory hold até ao limite e bloqueia over-reserve", async () => {
    const { createInventoryHold } = await import("@/lib/holds/inventoryHold");
    const base = {
      orgId: 21,
      subjectType: "STORE_PRODUCT",
      storeId: 9,
      productId: 55,
      quantity: 2,
      maxStock: 3,
      clientSessionId: "sess_inventory_owner_123456",
      metadata: { label: "Produto X" },
    } as const;

    const first = await createInventoryHold(base);
    const second = await createInventoryHold(base);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("OUT_OF_STOCK");
      expect(second.available).toBe(1);
    }

    const rawPayload = [...redisStore.values()]
      .map((entry) => entry.value)
      .find((value) => value.includes("sess_inventory_owner_123456"));
    expect(rawPayload).toBeTruthy();
    expect(rawPayload ?? "").not.toContain("userId");
  });

  it("normaliza maxStock=0 como OUT_OF_STOCK (não INVALID_HOLD_INPUT)", async () => {
    const { createInventoryHold } = await import("@/lib/holds/inventoryHold");
    const result = await createInventoryHold({
      orgId: 21,
      subjectType: "TICKET_TYPE",
      eventId: 88,
      ticketTypeId: 99,
      quantity: 1,
      maxStock: 0,
      clientSessionId: "sess_inventory_zero_stock_123456",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("OUT_OF_STOCK");
      expect(result.available).toBe(0);
    }
  });

  it("valida ownership por clientSessionId", async () => {
    const { createInventoryHold, verifyInventoryHoldOwnership } = await import(
      "@/lib/holds/inventoryHold"
    );
    const created = await createInventoryHold({
      orgId: 21,
      subjectType: "TICKET_TYPE",
      eventId: 88,
      ticketTypeId: 11,
      quantity: 1,
      maxStock: 10,
      clientSessionId: "sess_inventory_owner_abcdef",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const ok = await verifyInventoryHoldOwnership({
      holdId: created.data.holdId,
      clientSessionId: "sess_inventory_owner_abcdef",
    });
    const denied = await verifyInventoryHoldOwnership({
      holdId: created.data.holdId,
      clientSessionId: "sess_inventory_other_abcdef",
    });

    expect(ok.ok).toBe(true);
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(denied.code).toBe("SLOT_NOT_AVAILABLE");
    }
  });

  it("liberta hold e permite nova reserva para o mesmo subject", async () => {
    const { createInventoryHold, releaseInventoryHold } = await import(
      "@/lib/holds/inventoryHold"
    );
    const sessionId = "sess_inventory_release_123456";
    const created = await createInventoryHold({
      orgId: 21,
      subjectType: "STORE_VARIANT",
      storeId: 9,
      productId: 55,
      variantId: 77,
      quantity: 2,
      maxStock: 2,
      clientSessionId: sessionId,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const blocked = await createInventoryHold({
      orgId: 21,
      subjectType: "STORE_VARIANT",
      storeId: 9,
      productId: 55,
      variantId: 77,
      quantity: 1,
      maxStock: 2,
      clientSessionId: "sess_inventory_other_123456",
    });
    expect(blocked.ok).toBe(false);

    const released = await releaseInventoryHold({
      holdId: created.data.holdId,
      clientSessionId: sessionId,
    });
    expect(released.ok).toBe(true);

    const afterRelease = await createInventoryHold({
      orgId: 21,
      subjectType: "STORE_VARIANT",
      storeId: 9,
      productId: 55,
      variantId: 77,
      quantity: 2,
      maxStock: 2,
      clientSessionId: "sess_inventory_new_123456",
    });
    expect(afterRelease.ok).toBe(true);
  });

  it("double-hold concorrente: só uma reserva passa quando stock remanescente é 1", async () => {
    const { createInventoryHold } = await import("@/lib/holds/inventoryHold");
    const payload = {
      orgId: 44,
      subjectType: "TICKET_TYPE",
      eventId: 77,
      ticketTypeId: 10,
      quantity: 1,
      maxStock: 1,
    } as const;

    const [first, second] = await Promise.all([
      createInventoryHold({
        ...payload,
        clientSessionId: "sess_inventory_race_a_123456",
      }),
      createInventoryHold({
        ...payload,
        clientSessionId: "sess_inventory_race_b_123456",
      }),
    ]);

    const succeeded = [first, second].filter((result) => result.ok).length;
    const failed = [first, second].filter((result) => !result.ok).length;
    expect(succeeded).toBe(1);
    expect(failed).toBe(1);
    const failure = first.ok ? second : first;
    if (!failure.ok) {
      expect(failure.code).toBe("OUT_OF_STOCK");
    }
  });
});
