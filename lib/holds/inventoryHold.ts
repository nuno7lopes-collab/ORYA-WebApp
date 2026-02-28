import "server-only";

import crypto from "crypto";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Prisma } from "@prisma/client";
import {
  buildInventoryHoldFingerprint,
  type InventoryHoldSubjectType,
} from "@orya/shared/holds/inventoryFingerprint";
import { prisma } from "@/lib/prisma";
import { HOLD_TTL_MS } from "@/lib/holds/config";
import { buildClientSessionHash } from "@/lib/holds/fingerprint";
import { getRedisCommandClient, isRedisConfigured } from "@/lib/redis/client";
import { logInfo, logWarn } from "@/lib/observability/logger";

const INVENTORY_RESERVE_LUA = readFileSync(
  resolve(process.cwd(), "lib/holds/inventory_reserve.lua"),
  "utf8",
);

type InventoryHoldStatus = "ACTIVE" | "RELEASED" | "CONSUMED" | "EXPIRED";

type InventoryHoldRecord = {
  holdId: string;
  orgId: number;
  subjectType: string;
  subjectFingerprint: string;
  quantity: number;
  maxStock: number;
  clientSessionId: string;
  storeId: number | null;
  eventId: number | null;
  productId: number | null;
  variantId: number | null;
  ticketTypeId: number | null;
  createdAt: string;
  expiresAt: string;
  metadata: Record<string, unknown>;
};

type InventoryHoldAuditRow = {
  holdId: string;
  organizationId: number;
  subjectFingerprint: string;
  subjectType: string;
  quantity: number;
  maxStock: number;
  clientSessionHash: string;
  status: string;
  expiresAt: Date;
  storeId: number | null;
  eventId: number | null;
  productId: number | null;
  variantId: number | null;
  ticketTypeId: number | null;
};

type InventoryHoldResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code: string;
      message: string;
      retryable?: boolean;
      available?: number;
    };

type CreateInventoryHoldInput = {
  orgId: number;
  subjectType: InventoryHoldSubjectType | string;
  subjectFingerprint?: string | null;
  quantity: number;
  maxStock: number;
  clientSessionId: string;
  storeId?: number | null;
  eventId?: number | null;
  productId?: number | null;
  variantId?: number | null;
  ticketTypeId?: number | null;
  metadata?: Record<string, unknown> | null;
};

type VerifyInventoryHoldInput = {
  holdId: string;
  clientSessionId: string;
  expectedOrgId?: number | null;
  expectedSubjectFingerprint?: string | null;
};

type ReleaseInventoryHoldInput = {
  holdId: string;
  clientSessionId?: string | null;
  consumed?: boolean;
  consumedByPaymentIntent?: string | null;
  allowWithoutOwnership?: boolean;
  expireInsteadOfRelease?: boolean;
  tx?: Prisma.TransactionClient;
};

type PingInventoryHoldInput = {
  holdId: string;
  clientSessionId: string;
};

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function normalizeSubjectType(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeFingerprint(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/^[a-f0-9]{64}$/.test(normalized)) return normalized;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function normalizeClientSessionId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9._:-]{12,128}$/.test(normalized)) return null;
  return normalized;
}

function parseHoldRecord(raw: string | null): InventoryHoldRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<InventoryHoldRecord>;
    if (!parsed || typeof parsed !== "object") return null;
    if (
      typeof parsed.holdId !== "string" ||
      typeof parsed.orgId !== "number" ||
      typeof parsed.subjectType !== "string" ||
      typeof parsed.subjectFingerprint !== "string" ||
      typeof parsed.quantity !== "number" ||
      typeof parsed.maxStock !== "number" ||
      typeof parsed.clientSessionId !== "string" ||
      typeof parsed.createdAt !== "string" ||
      typeof parsed.expiresAt !== "string"
    ) {
      return null;
    }
    const metadata =
      parsed.metadata && typeof parsed.metadata === "object"
        ? (parsed.metadata as Record<string, unknown>)
        : {};
    return {
      holdId: parsed.holdId,
      orgId: parsed.orgId,
      subjectType: parsed.subjectType,
      subjectFingerprint: parsed.subjectFingerprint,
      quantity: parsed.quantity,
      maxStock: parsed.maxStock,
      clientSessionId: parsed.clientSessionId,
      storeId: typeof parsed.storeId === "number" ? parsed.storeId : null,
      eventId: typeof parsed.eventId === "number" ? parsed.eventId : null,
      productId: typeof parsed.productId === "number" ? parsed.productId : null,
      variantId: typeof parsed.variantId === "number" ? parsed.variantId : null,
      ticketTypeId:
        typeof parsed.ticketTypeId === "number" ? parsed.ticketTypeId : null,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      metadata,
    };
  } catch {
    return null;
  }
}

function isExpiredIso(iso: string, now = new Date()) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() <= now.getTime();
}

function buildInventoryHoldRedisPrefix(orgId: number, subjectFingerprint: string) {
  return `hold:inventory:org:${orgId}:subject:${subjectFingerprint}`;
}

function buildInventoryReservedKey(prefix: string) {
  return `${prefix}:reserved`;
}

function buildInventoryHoldsPrefix(prefix: string) {
  return `${prefix}:holds`;
}

function buildInventoryHoldKey(prefix: string, holdId: string) {
  return `${buildInventoryHoldsPrefix(prefix)}:${holdId}`;
}

function buildInventoryIndexKey(holdId: string) {
  return `hold:inventory:index:${holdId}`;
}

function emitInventoryHoldMetric(metric: string, payload: Record<string, unknown>) {
  logInfo("inventory_hold.metric", {
    metric,
    ...payload,
  });
}

function ensureFingerprint(input: {
  orgId: number;
  subjectType: string;
  subjectFingerprint?: string | null;
  storeId: number | null;
  eventId: number | null;
  productId: number | null;
  variantId: number | null;
  ticketTypeId: number | null;
}) {
  const provided = normalizeFingerprint(input.subjectFingerprint ?? null);
  if (provided) return provided;
  return buildInventoryHoldFingerprint({
    orgId: input.orgId,
    subjectType: input.subjectType,
    storeId: input.storeId,
    eventId: input.eventId,
    productId: input.productId,
    variantId: input.variantId,
    ticketTypeId: input.ticketTypeId,
  });
}

async function insertAuditRow(params: {
  holdId: string;
  orgId: number;
  subjectType: string;
  subjectFingerprint: string;
  quantity: number;
  maxStock: number;
  clientSessionId: string;
  storeId: number | null;
  eventId: number | null;
  productId: number | null;
  variantId: number | null;
  ticketTypeId: number | null;
  createdAt: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
  tx?: Prisma.TransactionClient;
}) {
  const db = params.tx ?? prisma;
  const clientSessionHash = buildClientSessionHash(params.clientSessionId);
  const dedupeHash = crypto
    .createHash("sha256")
    .update(
      [
        params.holdId,
        params.subjectFingerprint,
        String(params.quantity),
        params.createdAt.toISOString(),
        params.expiresAt.toISOString(),
      ].join("|"),
    )
    .digest("hex");
  const metadataJson = JSON.stringify(params.metadata ?? {});

  await db.$executeRaw`
    INSERT INTO app_v3.inventory_holds
      (hold_id, organization_id, store_id, event_id, product_id, variant_id, ticket_type_id, subject_type, subject_fingerprint, quantity, max_stock, client_session_hash, status, created_at, expires_at, dedupe_hash, metadata)
    VALUES
      (${params.holdId}::uuid, ${params.orgId}, ${params.storeId}, ${params.eventId}, ${params.productId}, ${params.variantId}, ${params.ticketTypeId}, ${params.subjectType}, ${params.subjectFingerprint}, ${params.quantity}, ${params.maxStock}, ${clientSessionHash}, 'ACTIVE', ${params.createdAt}, ${params.expiresAt}, ${dedupeHash}, ${metadataJson}::jsonb)
    ON CONFLICT (hold_id) DO NOTHING
  `;
}

async function findActiveAuditHold(params: {
  holdId: string;
  now: Date;
}) {
  const rows = await prisma.$queryRaw<InventoryHoldAuditRow[]>`
    SELECT
      hold_id::text AS "holdId",
      organization_id AS "organizationId",
      subject_fingerprint AS "subjectFingerprint",
      subject_type AS "subjectType",
      quantity,
      max_stock AS "maxStock",
      client_session_hash AS "clientSessionHash",
      status,
      expires_at AS "expiresAt",
      store_id AS "storeId",
      event_id AS "eventId",
      product_id AS "productId",
      variant_id AS "variantId",
      ticket_type_id AS "ticketTypeId"
    FROM app_v3.inventory_holds
    WHERE hold_id = ${params.holdId}::uuid
      AND status = 'ACTIVE'
      AND expires_at > ${params.now}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function findAuditHoldById(params: { holdId: string }) {
  const rows = await prisma.$queryRaw<InventoryHoldAuditRow[]>`
    SELECT
      hold_id::text AS "holdId",
      organization_id AS "organizationId",
      subject_fingerprint AS "subjectFingerprint",
      subject_type AS "subjectType",
      quantity,
      max_stock AS "maxStock",
      client_session_hash AS "clientSessionHash",
      status,
      expires_at AS "expiresAt",
      store_id AS "storeId",
      event_id AS "eventId",
      product_id AS "productId",
      variant_id AS "variantId",
      ticket_type_id AS "ticketTypeId"
    FROM app_v3.inventory_holds
    WHERE hold_id = ${params.holdId}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

async function updateAuditStatus(params: {
  holdId: string;
  status: InventoryHoldStatus;
  at: Date;
  consumedByPaymentIntent?: string | null;
  tx?: Prisma.TransactionClient;
}) {
  const db = params.tx ?? prisma;
  if (params.status === "RELEASED") {
    await db.$executeRaw`
      UPDATE app_v3.inventory_holds
      SET status = 'RELEASED', released_at = ${params.at}
      WHERE hold_id = ${params.holdId}::uuid AND status = 'ACTIVE'
    `;
    return;
  }
  if (params.status === "CONSUMED") {
    await db.$executeRaw`
      UPDATE app_v3.inventory_holds
      SET status = 'CONSUMED', consumed_at = ${params.at}, consumed_by_payment_intent = ${params.consumedByPaymentIntent ?? null}
      WHERE hold_id = ${params.holdId}::uuid AND status = 'ACTIVE'
    `;
    return;
  }
  await db.$executeRaw`
    UPDATE app_v3.inventory_holds
    SET status = 'EXPIRED'
    WHERE hold_id = ${params.holdId}::uuid AND status = 'ACTIVE'
  `;
}

function normalizeCreateInput(input: CreateInventoryHoldInput) {
  const orgId = parsePositiveInt(input.orgId);
  const subjectType = normalizeSubjectType(input.subjectType);
  const quantity = parsePositiveInt(input.quantity);
  const maxStock = parsePositiveInt(input.maxStock);
  const clientSessionId = normalizeClientSessionId(input.clientSessionId);
  const storeId = parsePositiveInt(input.storeId ?? null);
  const eventId = parsePositiveInt(input.eventId ?? null);
  const productId = parsePositiveInt(input.productId ?? null);
  const variantId = parsePositiveInt(input.variantId ?? null);
  const ticketTypeId = parsePositiveInt(input.ticketTypeId ?? null);
  if (!orgId || !subjectType || !quantity || !maxStock || !clientSessionId) {
    return null;
  }
  const subjectFingerprint = ensureFingerprint({
    orgId,
    subjectType,
    subjectFingerprint: input.subjectFingerprint ?? null,
    storeId,
    eventId,
    productId,
    variantId,
    ticketTypeId,
  });
  return {
    orgId,
    subjectType,
    subjectFingerprint,
    quantity,
    maxStock,
    clientSessionId,
    storeId,
    eventId,
    productId,
    variantId,
    ticketTypeId,
  };
}

function buildRecord(params: {
  holdId: string;
  input: ReturnType<typeof normalizeCreateInput>;
  createdAt: Date;
  expiresAt: Date;
  metadata?: Record<string, unknown> | null;
}) {
  if (!params.input) {
    throw new Error("INVALID_INVENTORY_HOLD_INPUT");
  }
  return {
    holdId: params.holdId,
    orgId: params.input.orgId,
    subjectType: params.input.subjectType,
    subjectFingerprint: params.input.subjectFingerprint,
    quantity: params.input.quantity,
    maxStock: params.input.maxStock,
    clientSessionId: params.input.clientSessionId,
    storeId: params.input.storeId,
    eventId: params.input.eventId,
    productId: params.input.productId,
    variantId: params.input.variantId,
    ticketTypeId: params.input.ticketTypeId,
    createdAt: params.createdAt.toISOString(),
    expiresAt: params.expiresAt.toISOString(),
    metadata: params.metadata ?? {},
  } satisfies InventoryHoldRecord;
}

async function releaseRedisCounter(record: InventoryHoldRecord) {
  if (!isRedisConfigured()) return;
  try {
    const redis = await getRedisCommandClient();
    const prefix = buildInventoryHoldRedisPrefix(
      record.orgId,
      record.subjectFingerprint,
    );
    const reservedKey = buildInventoryReservedKey(prefix);
    const holdKey = buildInventoryHoldKey(prefix, record.holdId);
    const indexKey = buildInventoryIndexKey(record.holdId);
    await redis.del([holdKey, indexKey]);
    const after = await redis.decrBy(reservedKey, record.quantity);
    if (after <= 0) {
      await redis.del(reservedKey);
    }
  } catch {
    // best-effort release
  }
}

export async function createInventoryHold(
  input: CreateInventoryHoldInput,
): Promise<
  InventoryHoldResult<{
    holdId: string;
    expiresAt: string;
    quantity: number;
    subjectFingerprint: string;
  }>
> {
  const normalized = normalizeCreateInput(input);
  if (!normalized) {
    return {
      ok: false,
      code: "INVALID_HOLD_INPUT",
      message: "Dados de hold inválidos.",
      retryable: false,
    };
  }
  if (normalized.quantity > normalized.maxStock) {
    emitInventoryHoldMetric("inventory_hold.failed_out_of_stock", {
      orgId: normalized.orgId,
      subjectType: normalized.subjectType,
      subjectFingerprint: normalized.subjectFingerprint,
      requestedQty: normalized.quantity,
      available: normalized.maxStock,
    });
    return {
      ok: false,
      code: "OUT_OF_STOCK",
      message: "Stock insuficiente.",
      retryable: false,
      available: normalized.maxStock,
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_TTL_MS);
  const holdId = crypto.randomUUID();
  const record = buildRecord({
    holdId,
    input: normalized,
    createdAt: now,
    expiresAt,
    metadata: input.metadata ?? {},
  });

  if (isRedisConfigured()) {
    try {
      const redis = await getRedisCommandClient();
      const prefix = buildInventoryHoldRedisPrefix(
        normalized.orgId,
        normalized.subjectFingerprint,
      );
      const rawResult = await redis.eval(INVENTORY_RESERVE_LUA, {
        keys: [
          buildInventoryReservedKey(prefix),
          buildInventoryHoldsPrefix(prefix),
          buildInventoryIndexKey(holdId),
        ],
        arguments: [
          String(normalized.quantity),
          String(HOLD_TTL_MS),
          holdId,
          JSON.stringify(record),
          String(normalized.maxStock),
        ],
      });
      const parsed =
        typeof rawResult === "string" ? JSON.parse(rawResult) as { ok?: boolean; available?: number; code?: string } : {};
      if (!parsed.ok) {
        if (parsed.code === "OUT_OF_STOCK") {
          emitInventoryHoldMetric("inventory_hold.failed_out_of_stock", {
            orgId: normalized.orgId,
            subjectType: normalized.subjectType,
            subjectFingerprint: normalized.subjectFingerprint,
            requestedQty: normalized.quantity,
            available:
              typeof parsed.available === "number"
                ? Math.max(0, parsed.available)
                : 0,
          });
        }
        return {
          ok: false,
          code: parsed.code === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "SLOT_NOT_AVAILABLE",
          message:
            parsed.code === "OUT_OF_STOCK"
              ? "Stock insuficiente."
              : "Hold indisponível.",
          retryable: false,
          available:
            typeof parsed.available === "number" ? Math.max(0, parsed.available) : 0,
        };
      }

      try {
        await insertAuditRow({
          holdId,
          orgId: normalized.orgId,
          subjectType: normalized.subjectType,
          subjectFingerprint: normalized.subjectFingerprint,
          quantity: normalized.quantity,
          maxStock: normalized.maxStock,
          clientSessionId: normalized.clientSessionId,
          storeId: normalized.storeId,
          eventId: normalized.eventId,
          productId: normalized.productId,
          variantId: normalized.variantId,
          ticketTypeId: normalized.ticketTypeId,
          createdAt: now,
          expiresAt,
          metadata: input.metadata ?? {},
        });
      } catch {
        await releaseRedisCounter(record);
        return {
          ok: false,
          code: "HOLD_PERSISTENCE_FAILED",
          message: "Não foi possível registar o hold.",
          retryable: true,
        };
      }

      emitInventoryHoldMetric("inventory_hold.created", {
        holdId,
        orgId: normalized.orgId,
        subjectType: normalized.subjectType,
        subjectFingerprint: normalized.subjectFingerprint,
        quantity: normalized.quantity,
      });
      return {
        ok: true,
        data: {
          holdId,
          expiresAt: expiresAt.toISOString(),
          quantity: normalized.quantity,
          subjectFingerprint: normalized.subjectFingerprint,
        },
      };
    } catch {
      // fallback para lock SQL em caso de indisponibilidade de Redis.
    }
  }

  const inserted = await prisma.$transaction(async (tx) => {
    const lockKey = `inventory-hold:${normalized.orgId}:${normalized.subjectFingerprint}`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const rows = await tx.$queryRaw<Array<{ reserved: number }>>`
      SELECT COALESCE(SUM(quantity), 0)::int AS reserved
      FROM app_v3.inventory_holds
      WHERE organization_id = ${normalized.orgId}
        AND subject_fingerprint = ${normalized.subjectFingerprint}
        AND status = 'ACTIVE'
        AND expires_at > ${now}
    `;
    const reserved = Math.max(0, Number(rows[0]?.reserved ?? 0));
    const available = Math.max(0, normalized.maxStock - reserved);
    if (available < normalized.quantity) {
      return { ok: false as const, available };
    }

    await insertAuditRow({
      holdId,
      orgId: normalized.orgId,
      subjectType: normalized.subjectType,
      subjectFingerprint: normalized.subjectFingerprint,
      quantity: normalized.quantity,
      maxStock: normalized.maxStock,
      clientSessionId: normalized.clientSessionId,
      storeId: normalized.storeId,
      eventId: normalized.eventId,
      productId: normalized.productId,
      variantId: normalized.variantId,
      ticketTypeId: normalized.ticketTypeId,
      createdAt: now,
      expiresAt,
      metadata: input.metadata ?? {},
      tx,
    });
    return { ok: true as const, available };
  });

  if (!inserted.ok) {
    emitInventoryHoldMetric("inventory_hold.failed_out_of_stock", {
      orgId: normalized.orgId,
      subjectType: normalized.subjectType,
      subjectFingerprint: normalized.subjectFingerprint,
      requestedQty: normalized.quantity,
      available: inserted.available,
      mode: "db_fallback",
    });
    return {
      ok: false,
      code: "OUT_OF_STOCK",
      message: "Stock insuficiente.",
      retryable: false,
      available: inserted.available,
    };
	  }

  emitInventoryHoldMetric("inventory_hold.created", {
    holdId,
    orgId: normalized.orgId,
    subjectType: normalized.subjectType,
    subjectFingerprint: normalized.subjectFingerprint,
    quantity: normalized.quantity,
    mode: "db_fallback",
  });
  return {
    ok: true,
    data: {
      holdId,
      expiresAt: expiresAt.toISOString(),
      quantity: normalized.quantity,
      subjectFingerprint: normalized.subjectFingerprint,
    },
  };
}

export async function verifyInventoryHoldOwnership(
  input: VerifyInventoryHoldInput,
): Promise<
  InventoryHoldResult<{
    holdId: string;
    orgId: number;
    subjectType: string;
    subjectFingerprint: string;
    quantity: number;
    expiresAt: string;
  }>
> {
  const holdId = typeof input.holdId === "string" ? input.holdId.trim() : "";
  const clientSessionId = normalizeClientSessionId(input.clientSessionId);
  if (!holdId || !clientSessionId) {
    return {
      ok: false,
      code: "INVALID_HOLD_INPUT",
      message: "Hold inválido.",
      retryable: false,
    };
  }
  const expectedOrgId = parsePositiveInt(input.expectedOrgId ?? null);
  const expectedFingerprint = normalizeFingerprint(
    input.expectedSubjectFingerprint ?? null,
  );
  const now = new Date();

  if (isRedisConfigured()) {
    try {
      const redis = await getRedisCommandClient();
      const index = parseHoldRecord(await redis.get(buildInventoryIndexKey(holdId)));
      if (index) {
        if (isExpiredIso(index.expiresAt, now)) {
          await releaseInventoryHold({
            holdId,
            allowWithoutOwnership: true,
            expireInsteadOfRelease: true,
          });
          return {
            ok: false,
            code: "HOLD_EXPIRED",
            message: "Hold expirado.",
            retryable: false,
          };
        }
        if (index.clientSessionId !== clientSessionId) {
          return {
            ok: false,
            code: "SLOT_NOT_AVAILABLE",
            message: "Hold indisponível.",
            retryable: false,
          };
        }
        if (expectedOrgId && expectedOrgId !== index.orgId) {
          return {
            ok: false,
            code: "SLOT_NOT_AVAILABLE",
            message: "Hold indisponível.",
            retryable: false,
          };
        }
        if (expectedFingerprint && expectedFingerprint !== index.subjectFingerprint) {
          return {
            ok: false,
            code: "SLOT_NOT_AVAILABLE",
            message: "Hold indisponível.",
            retryable: false,
          };
        }
        return {
          ok: true,
          data: {
            holdId: index.holdId,
            orgId: index.orgId,
            subjectType: index.subjectType,
            subjectFingerprint: index.subjectFingerprint,
            quantity: index.quantity,
            expiresAt: index.expiresAt,
          },
        };
      }
    } catch {
      // fallback DB
    }
  }

  const audit = await findActiveAuditHold({ holdId, now });
  if (!audit) {
    return {
      ok: false,
      code: "SLOT_NOT_AVAILABLE",
      message: "Hold indisponível.",
      retryable: false,
    };
  }
  if (audit.clientSessionHash !== buildClientSessionHash(clientSessionId)) {
    return {
      ok: false,
      code: "SLOT_NOT_AVAILABLE",
      message: "Hold indisponível.",
      retryable: false,
    };
  }
  if (expectedOrgId && expectedOrgId !== audit.organizationId) {
    return {
      ok: false,
      code: "SLOT_NOT_AVAILABLE",
      message: "Hold indisponível.",
      retryable: false,
    };
  }
  if (expectedFingerprint && expectedFingerprint !== audit.subjectFingerprint) {
    return {
      ok: false,
      code: "SLOT_NOT_AVAILABLE",
      message: "Hold indisponível.",
      retryable: false,
    };
  }
  return {
    ok: true,
    data: {
      holdId: audit.holdId,
      orgId: audit.organizationId,
      subjectType: audit.subjectType,
      subjectFingerprint: audit.subjectFingerprint,
      quantity: audit.quantity,
      expiresAt: audit.expiresAt.toISOString(),
    },
  };
}

export async function pingInventoryHold(
  input: PingInventoryHoldInput,
): Promise<InventoryHoldResult<{ holdId: string; expiresAt: string }>> {
  const verified = await verifyInventoryHoldOwnership(input);
  if (!verified.ok) return verified;
  const expiresAt = new Date(Date.now() + HOLD_TTL_MS);

  if (isRedisConfigured()) {
    try {
      const redis = await getRedisCommandClient();
      const indexKey = buildInventoryIndexKey(verified.data.holdId);
      const current = parseHoldRecord(await redis.get(indexKey));
      if (current) {
        const prefix = buildInventoryHoldRedisPrefix(
          current.orgId,
          current.subjectFingerprint,
        );
        current.expiresAt = expiresAt.toISOString();
        await redis.set(indexKey, JSON.stringify(current), {
          XX: true,
          PX: HOLD_TTL_MS,
        });
        await redis.set(
          buildInventoryHoldKey(prefix, current.holdId),
          JSON.stringify(current),
          {
            XX: true,
            PX: HOLD_TTL_MS,
          },
        );
      }
    } catch {
      // fallback DB
    }
  }

  await prisma.$executeRaw`
    UPDATE app_v3.inventory_holds
    SET expires_at = ${expiresAt}
    WHERE hold_id = ${verified.data.holdId}::uuid
      AND status = 'ACTIVE'
  `;
  return {
    ok: true,
    data: { holdId: verified.data.holdId, expiresAt: expiresAt.toISOString() },
  };
}

export async function releaseInventoryHold(
  input: ReleaseInventoryHoldInput,
): Promise<
  InventoryHoldResult<{ released: true; holdId: string; status: InventoryHoldStatus }>
> {
  const holdId = typeof input.holdId === "string" ? input.holdId.trim() : "";
  if (!holdId) {
    return {
      ok: false,
      code: "INVALID_HOLD_INPUT",
      message: "Hold inválido.",
      retryable: false,
    };
  }

  let resolvedRecord: InventoryHoldRecord | null = null;
  let resolvedStatus: InventoryHoldStatus = "RELEASED";

  if (!input.allowWithoutOwnership) {
    const clientSessionId = normalizeClientSessionId(input.clientSessionId ?? null);
    if (!clientSessionId) {
      return {
        ok: false,
        code: "INVALID_HOLD_INPUT",
        message: "Hold inválido.",
        retryable: false,
      };
    }
    const verified = await verifyInventoryHoldOwnership({ holdId, clientSessionId });
    if (!verified.ok) return verified;
    resolvedRecord = {
      holdId: verified.data.holdId,
      orgId: verified.data.orgId,
      subjectType: verified.data.subjectType,
      subjectFingerprint: verified.data.subjectFingerprint,
      quantity: verified.data.quantity,
      maxStock: 1,
      clientSessionId,
      storeId: null,
      eventId: null,
      productId: null,
      variantId: null,
      ticketTypeId: null,
      createdAt: new Date().toISOString(),
      expiresAt: verified.data.expiresAt,
      metadata: {},
    };
  }

  const audit = await findAuditHoldById({ holdId });
  if (!audit && !resolvedRecord) {
    return {
      ok: true,
      data: { released: true, holdId, status: "RELEASED" },
    };
  }

  if (!input.allowWithoutOwnership && resolvedRecord && audit?.status === "ACTIVE") {
    resolvedRecord.maxStock = audit.maxStock;
    resolvedRecord.storeId = audit.storeId;
    resolvedRecord.eventId = audit.eventId;
    resolvedRecord.productId = audit.productId;
    resolvedRecord.variantId = audit.variantId;
    resolvedRecord.ticketTypeId = audit.ticketTypeId;
  }

  if (input.allowWithoutOwnership && audit?.status === "ACTIVE") {
    resolvedRecord = {
      holdId: audit.holdId,
      orgId: audit.organizationId,
      subjectType: audit.subjectType,
      subjectFingerprint: audit.subjectFingerprint,
      quantity: audit.quantity,
      maxStock: audit.maxStock,
      clientSessionId: "",
      storeId: audit.storeId,
      eventId: audit.eventId,
      productId: audit.productId,
      variantId: audit.variantId,
      ticketTypeId: audit.ticketTypeId,
      createdAt: new Date().toISOString(),
      expiresAt: audit.expiresAt.toISOString(),
      metadata: {},
    };
  }

  const now = new Date();
  if (input.consumed) {
    resolvedStatus = "CONSUMED";
  } else if (input.expireInsteadOfRelease) {
    resolvedStatus = "EXPIRED";
  } else {
    resolvedStatus = "RELEASED";
  }

  if (resolvedRecord && isRedisConfigured()) {
    try {
      const redis = await getRedisCommandClient();
      const prefix = buildInventoryHoldRedisPrefix(
        resolvedRecord.orgId,
        resolvedRecord.subjectFingerprint,
      );
      const holdKey = buildInventoryHoldKey(prefix, holdId);
      const indexKey = buildInventoryIndexKey(holdId);
      await redis.del([holdKey, indexKey]);
      const after = await redis.decrBy(
        buildInventoryReservedKey(prefix),
        resolvedRecord.quantity,
      );
      if (after <= 0) {
        await redis.del(buildInventoryReservedKey(prefix));
      }
    } catch {
      // best-effort
    }
  }

  if (audit?.status === "ACTIVE") {
    await updateAuditStatus({
      holdId,
      status: resolvedStatus,
      at: now,
      consumedByPaymentIntent: input.consumedByPaymentIntent ?? null,
      tx: input.tx,
    });
  }

  if (resolvedStatus === "CONSUMED") {
    emitInventoryHoldMetric("inventory_hold.released_consumed", {
      holdId,
      consumedByPaymentIntent: input.consumedByPaymentIntent ?? null,
    });
    emitInventoryHoldMetric("inventory_hold.consumed_payment_success", {
      holdId,
      consumedByPaymentIntent: input.consumedByPaymentIntent ?? null,
    });
  } else if (resolvedStatus === "EXPIRED") {
    emitInventoryHoldMetric("inventory_hold.expired", { holdId });
  }

  return {
    ok: true,
    data: { released: true, holdId, status: resolvedStatus },
  };
}

export async function cleanupExpiredInventoryHolds(params?: { limit?: number }) {
  const limit = Math.max(1, Math.min(500, Number(params?.limit ?? 100)));
  const now = new Date();
  const rows = await prisma.$queryRaw<Array<{ holdId: string }>>`
    SELECT hold_id::text AS "holdId"
    FROM app_v3.inventory_holds
    WHERE status = 'ACTIVE'
      AND expires_at <= ${now}
    ORDER BY expires_at ASC
    LIMIT ${limit}
  `;
  let cleaned = 0;
  for (const row of rows) {
    const released = await releaseInventoryHold({
      holdId: row.holdId,
      allowWithoutOwnership: true,
      expireInsteadOfRelease: true,
    });
    if (released.ok) cleaned += 1;
  }
  if (cleaned > 0) {
    logWarn("inventory_hold.cleanup_expired", {
      cleaned,
      scanned: rows.length,
    });
  }
  return { ok: true, scanned: rows.length, cleaned };
}
