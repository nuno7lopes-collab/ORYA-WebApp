import "server-only";
import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getRedisCommandClient, isRedisConfigured } from "@/lib/redis/client";
import { buildClientSessionHash } from "@/lib/holds/fingerprint";
import { HOLD_TTL_MS, buildHoldRedisKey } from "@/lib/holds/config";
import type { HoldSubjectType } from "@/lib/holds/subjectFingerprint";

type HoldStatus = "ACTIVE" | "RELEASED" | "CONSUMED" | "EXPIRED";

type HoldRecord = {
  holdId: string;
  clientSessionId: string;
  createdAt: string;
  expiresAt: string;
  metadata: Record<string, unknown>;
};

type HoldInput = {
  orgId: number;
  subjectType: HoldSubjectType | string;
  subjectFingerprint: string;
  clientSessionId: string;
};

type HoldResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string; retryable?: boolean };

type HoldAuditRow = {
  holdId: string;
  subjectFingerprint: string;
  clientSessionHash: string;
  expiresAt: Date;
  status: string;
};

function parsePositiveInt(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : null;
}

function normalizeFingerprint(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (/^[a-f0-9]{64}$/.test(normalized)) return normalized;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

function normalizeSubjectType(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeClientSessionId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^[a-zA-Z0-9._:-]{12,128}$/.test(normalized)) return null;
  return normalized;
}

function parseHoldRecord(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<HoldRecord>;
    if (!parsed || typeof parsed !== "object") return null;
    if (
      typeof parsed.holdId !== "string" ||
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
      clientSessionId: parsed.clientSessionId,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      metadata,
    } satisfies HoldRecord;
  } catch {
    return null;
  }
}

function isExpiredIso(iso: string, now = new Date()) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() <= now.getTime();
}

async function insertAuditRow(params: {
  holdId: string;
  orgId: number;
  subjectType: string;
  subjectFingerprint: string;
  clientSessionId: string;
  createdAt: Date;
  expiresAt: Date;
  metadata: Record<string, unknown>;
  tx?: Prisma.TransactionClient;
}) {
  const db = params.tx ?? prisma;
  const dedupeHash = crypto
    .createHash("sha256")
    .update(
      [
        params.holdId,
        params.subjectFingerprint,
        params.createdAt.toISOString(),
        params.expiresAt.toISOString(),
      ].join("|"),
    )
    .digest("hex");
  const metadataJson = JSON.stringify(params.metadata ?? {});
  const clientSessionHash = buildClientSessionHash(params.clientSessionId);

  await db.$executeRaw`
    INSERT INTO app_v3.reservation_holds
      (hold_id, organization_id, subject_type, subject_fingerprint, client_session_hash, status, created_at, expires_at, dedupe_hash, metadata)
    VALUES
      (${params.holdId}::uuid, ${params.orgId}, ${params.subjectType}, ${params.subjectFingerprint}, ${clientSessionHash}, 'ACTIVE', ${params.createdAt}, ${params.expiresAt}, ${dedupeHash}, ${metadataJson}::jsonb)
    ON CONFLICT (hold_id) DO NOTHING
  `;
}

async function updateAuditStatus(params: {
  holdId: string;
  status: HoldStatus;
  at: Date;
  tx?: Prisma.TransactionClient;
}) {
  const db = params.tx ?? prisma;
  if (params.status === "RELEASED") {
    await db.$executeRaw`
      UPDATE app_v3.reservation_holds
      SET status = 'RELEASED', released_at = ${params.at}
      WHERE hold_id = ${params.holdId}::uuid AND status = 'ACTIVE'
    `;
    return;
  }
  if (params.status === "CONSUMED") {
    await db.$executeRaw`
      UPDATE app_v3.reservation_holds
      SET status = 'CONSUMED', consumed_at = ${params.at}
      WHERE hold_id = ${params.holdId}::uuid AND status = 'ACTIVE'
    `;
    return;
  }
  if (params.status === "EXPIRED") {
    await db.$executeRaw`
      UPDATE app_v3.reservation_holds
      SET status = 'EXPIRED'
      WHERE hold_id = ${params.holdId}::uuid AND status = 'ACTIVE'
    `;
  }
}

async function findActiveAuditHold(params: {
  holdId: string;
  orgId: number;
  subjectFingerprint: string;
  clientSessionId: string;
  now: Date;
}) {
  const clientSessionHash = buildClientSessionHash(params.clientSessionId);
  const rows = await prisma.$queryRaw<HoldAuditRow[]>`
    SELECT
      hold_id::text AS "holdId",
      subject_fingerprint AS "subjectFingerprint",
      client_session_hash AS "clientSessionHash",
      expires_at AS "expiresAt",
      status
    FROM app_v3.reservation_holds
    WHERE hold_id = ${params.holdId}::uuid
      AND organization_id = ${params.orgId}
      AND subject_fingerprint = ${params.subjectFingerprint}
      AND status = 'ACTIVE'
      AND expires_at > ${params.now}
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) return null;
  if (row.clientSessionHash !== clientSessionHash) return null;
  return row;
}

function normalizeHoldInput(input: HoldInput) {
  const orgId = parsePositiveInt(input.orgId);
  const subjectType = normalizeSubjectType(input.subjectType);
  const subjectFingerprint = normalizeFingerprint(input.subjectFingerprint);
  const clientSessionId = normalizeClientSessionId(input.clientSessionId);
  if (!orgId || !subjectType || !subjectFingerprint || !clientSessionId) {
    return null;
  }
  return { orgId, subjectType, subjectFingerprint, clientSessionId };
}

async function readRedisHold(params: { orgId: number; subjectFingerprint: string }) {
  if (!isRedisConfigured()) return { available: false, key: buildHoldRedisKey(params.orgId, params.subjectFingerprint), hold: null as HoldRecord | null };
  const key = buildHoldRedisKey(params.orgId, params.subjectFingerprint);
  try {
    const redis = await getRedisCommandClient();
    const raw = await redis.get(key);
    return { available: true, key, hold: parseHoldRecord(raw) };
  } catch {
    return { available: false, key, hold: null as HoldRecord | null };
  }
}

export async function createCheckoutHold(input: HoldInput & { metadata?: Record<string, unknown> | null }): Promise<
  HoldResult<{ holdId: string; expiresAt: string; subjectFingerprint: string }>
> {
  const normalized = normalizeHoldInput(input);
  if (!normalized) {
    return { ok: false, code: "INVALID_HOLD_INPUT", message: "Hold inválido.", retryable: false };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + HOLD_TTL_MS);
  const holdId = crypto.randomUUID();
  const record: HoldRecord = {
    holdId,
    clientSessionId: normalized.clientSessionId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    metadata: input.metadata ?? {},
  };

  const redisKey = buildHoldRedisKey(normalized.orgId, normalized.subjectFingerprint);
  let createdOnRedis = false;
  if (isRedisConfigured()) {
    try {
      const redis = await getRedisCommandClient();
      const created = await redis.set(redisKey, JSON.stringify(record), {
        NX: true,
        PX: HOLD_TTL_MS,
      });
      if (created !== "OK") {
        return {
          ok: false,
          code: "SLOT_NOT_AVAILABLE",
          message: "Slot indisponível.",
          retryable: false,
        };
      }
      createdOnRedis = true;
    } catch {
      createdOnRedis = false;
    }
  }

  if (!createdOnRedis) {
    try {
      const inserted = await prisma.$transaction(async (tx) => {
        const lockKey = `hold:${normalized.orgId}:${normalized.subjectFingerprint}`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
        const existing = await tx.$queryRaw<Array<{ holdId: string }>>`
          SELECT hold_id::text AS "holdId"
          FROM app_v3.reservation_holds
          WHERE organization_id = ${normalized.orgId}
            AND subject_fingerprint = ${normalized.subjectFingerprint}
            AND status = 'ACTIVE'
            AND expires_at > ${now}
          LIMIT 1
        `;
        if (existing.length > 0) return false;
        await insertAuditRow({
          holdId,
          orgId: normalized.orgId,
          subjectType: normalized.subjectType,
          subjectFingerprint: normalized.subjectFingerprint,
          clientSessionId: normalized.clientSessionId,
          createdAt: now,
          expiresAt,
          metadata: input.metadata ?? {},
          tx,
        });
        return true;
      });
      if (!inserted) {
        return {
          ok: false,
          code: "SLOT_NOT_AVAILABLE",
          message: "Slot indisponível.",
          retryable: false,
        };
      }
      return {
        ok: true,
        data: {
          holdId,
          expiresAt: expiresAt.toISOString(),
          subjectFingerprint: normalized.subjectFingerprint,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? "");
      if (message.includes("reservation_holds_active_subject_uidx")) {
        return {
          ok: false,
          code: "SLOT_NOT_AVAILABLE",
          message: "Slot indisponível.",
          retryable: false,
        };
      }
      throw err;
    }
  }

  try {
    await insertAuditRow({
      holdId,
      orgId: normalized.orgId,
      subjectType: normalized.subjectType,
      subjectFingerprint: normalized.subjectFingerprint,
      clientSessionId: normalized.clientSessionId,
      createdAt: now,
      expiresAt,
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    console.warn("[holds] audit row insert failed after redis hold create", err);
  }

  return {
    ok: true,
    data: {
      holdId,
      expiresAt: expiresAt.toISOString(),
      subjectFingerprint: normalized.subjectFingerprint,
    },
  };
}

export async function verifyCheckoutHoldOwnership(input: HoldInput & { holdId: string }): Promise<
  HoldResult<{ holdId: string; expiresAt: string }>
> {
  const normalized = normalizeHoldInput(input);
  if (!normalized || typeof input.holdId !== "string" || input.holdId.trim().length < 8) {
    return { ok: false, code: "INVALID_HOLD_INPUT", message: "Hold inválido.", retryable: false };
  }
  const holdId = input.holdId.trim();
  const now = new Date();

  const redisLookup = await readRedisHold({
    orgId: normalized.orgId,
    subjectFingerprint: normalized.subjectFingerprint,
  });
  if (redisLookup.hold) {
    if (isExpiredIso(redisLookup.hold.expiresAt, now)) {
      if (redisLookup.available) {
        try {
          const redis = await getRedisCommandClient();
          await redis.del(redisLookup.key);
        } catch {
          // ignore
        }
      }
      await updateAuditStatus({ holdId: redisLookup.hold.holdId, status: "EXPIRED", at: now });
      return { ok: false, code: "HOLD_EXPIRED", message: "Hold expirado.", retryable: false };
    }
    if (
      redisLookup.hold.holdId !== holdId ||
      redisLookup.hold.clientSessionId !== normalized.clientSessionId
    ) {
      return {
        ok: false,
        code: "SLOT_NOT_AVAILABLE",
        message: "Slot indisponível.",
        retryable: false,
      };
    }
    return {
      ok: true,
      data: { holdId: redisLookup.hold.holdId, expiresAt: redisLookup.hold.expiresAt },
    };
  }

  const audit = await findActiveAuditHold({
    holdId,
    orgId: normalized.orgId,
    subjectFingerprint: normalized.subjectFingerprint,
    clientSessionId: normalized.clientSessionId,
    now,
  });
  if (!audit) {
    return { ok: false, code: "SLOT_NOT_AVAILABLE", message: "Slot indisponível.", retryable: false };
  }
  return { ok: true, data: { holdId, expiresAt: audit.expiresAt.toISOString() } };
}

export async function pingCheckoutHold(input: HoldInput & { holdId: string }): Promise<
  HoldResult<{ holdId: string; expiresAt: string }>
> {
  const verified = await verifyCheckoutHoldOwnership(input);
  if (!verified.ok) return verified;

  const normalized = normalizeHoldInput(input);
  if (!normalized) return { ok: false, code: "INVALID_HOLD_INPUT", message: "Hold inválido.", retryable: false };
  const expiresAt = new Date(Date.now() + HOLD_TTL_MS);

  if (isRedisConfigured()) {
    try {
      const redis = await getRedisCommandClient();
      const key = buildHoldRedisKey(normalized.orgId, normalized.subjectFingerprint);
      const current = parseHoldRecord(await redis.get(key));
      if (current && current.holdId === input.holdId && current.clientSessionId === normalized.clientSessionId) {
        current.expiresAt = expiresAt.toISOString();
        const refreshed = await redis.set(key, JSON.stringify(current), {
          XX: true,
          PX: HOLD_TTL_MS,
        });
        if (refreshed !== "OK") {
          return { ok: false, code: "SLOT_NOT_AVAILABLE", message: "Slot indisponível.", retryable: false };
        }
      }
    } catch {
      // fallback em DB audit apenas
    }
  }

  await prisma.$executeRaw`
    UPDATE app_v3.reservation_holds
    SET expires_at = ${expiresAt}
    WHERE hold_id = ${input.holdId}::uuid
      AND organization_id = ${normalized.orgId}
      AND subject_fingerprint = ${normalized.subjectFingerprint}
      AND status = 'ACTIVE'
  `;
  return { ok: true, data: { holdId: input.holdId, expiresAt: expiresAt.toISOString() } };
}

export async function releaseCheckoutHold(
  input: HoldInput & { holdId: string; consumed?: boolean; tx?: Prisma.TransactionClient },
): Promise<HoldResult<{ released: true; holdId: string }>> {
  const verified = await verifyCheckoutHoldOwnership(input);
  if (!verified.ok) return verified;

  const normalized = normalizeHoldInput(input);
  if (!normalized) return { ok: false, code: "INVALID_HOLD_INPUT", message: "Hold inválido.", retryable: false };

  const now = new Date();
  const status: HoldStatus = input.consumed ? "CONSUMED" : "RELEASED";
  await updateAuditStatus({ holdId: input.holdId, status, at: now, tx: input.tx });

  if (isRedisConfigured()) {
    try {
      const redis = await getRedisCommandClient();
      const key = buildHoldRedisKey(normalized.orgId, normalized.subjectFingerprint);
      await redis.del(key);
    } catch {
      // ignore redis release failures; audit is authoritative fallback
    }
  }

  return { ok: true, data: { released: true, holdId: input.holdId } };
}
