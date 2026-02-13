import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { createClient } from "@supabase/supabase-js";

type StorageObject = { bucket: string; objectPath: string };
type AppEnv = "prod" | "test";

type PurgeReport = {
  startedAt: string;
  finishedAt: string;
  mode: "dry-run" | "execute";
  totals: {
    attachmentsFound: number;
    messagesFound: number;
    conversationsImpacted: number;
    storageObjectsFound: number;
    mediaAssetsFound: number;
    memberPointersAffected: number;
    storageObjectsDeleted: number;
    mediaAssetsDeleted: number;
    messagesDeleted: number;
    conversationsRecalculated: number;
    memberPointersReconciled: number;
  };
  integrity: {
    remainingAttachmentsForPurgedMessages: number;
    remainingMediaAssetsForPurgedObjects: number;
    danglingConversationLastMessageIds: number;
    danglingMemberLastReadMessageIds: number;
  };
  errors: Array<{ step: string; detail: string }>;
};

function normalizeAppEnv(value: string | null | undefined): AppEnv | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "prod") return "prod";
  if (normalized === "test") return "test";
  return null;
}

function isTruthyFlag(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function resolveScriptAppEnv(): AppEnv {
  const forced = normalizeAppEnv(process.env.FORCE_APP_ENV ?? process.env.APP_ENV_FORCE);
  const override = normalizeAppEnv(process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV);
  if (isTruthyFlag(process.env.SINGLE_DB_MODE)) return "prod";
  return forced ?? override ?? "prod";
}

function stripUnsupportedParams(raw: string) {
  try {
    const parsed = new URL(raw);
    if (parsed.searchParams.has("options")) {
      parsed.searchParams.delete("options");
      return parsed.toString();
    }
  } catch {
    // ignore parse errors
  }
  return raw;
}

function stripSslOptions(raw: string) {
  try {
    const parsed = new URL(raw);
    const keys = ["sslmode", "ssl", "sslrootcert", "sslcert", "sslkey"];
    let changed = false;
    for (const key of keys) {
      if (parsed.searchParams.has(key)) {
        parsed.searchParams.delete(key);
        changed = true;
      }
    }
    if (changed) return parsed.toString();
  } catch {
    // ignore parse errors
  }
  return raw;
}

function resolvePgSsl(url: string): { ssl: false | { rejectUnauthorized: false } | undefined; connectionString: string } {
  const sanitized = stripUnsupportedParams(url);
  let sslMode: string | null = null;
  let host = "";
  try {
    const parsed = new URL(sanitized);
    sslMode = parsed.searchParams.get("sslmode");
    host = parsed.hostname;
  } catch {
    // ignore parse errors
  }

  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const forceDisable =
    process.env.PGSSL_DISABLE === "true" ||
    process.env.PGSSLMODE === "disable" ||
    sslMode === "disable" ||
    isLocalHost;
  if (forceDisable) {
    return { ssl: false, connectionString: stripSslOptions(sanitized) };
  }

  const allowSelfSigned =
    process.env.PGSSL_ALLOW_SELF_SIGNED === "true" ||
    process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
  if (process.env.NODE_ENV !== "production" || allowSelfSigned) {
    return { ssl: { rejectUnauthorized: false }, connectionString: stripSslOptions(sanitized) };
  }

  return { ssl: undefined, connectionString: sanitized };
}

function createScriptPrismaClient(env: AppEnv) {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("Missing env var: DATABASE_URL");
  }
  const pg = resolvePgSsl(databaseUrl);
  const pool = new Pool({
    connectionString: pg.connectionString,
    ssl: pg.ssl,
  });
  pool.on("connect", (client) => {
    client.query("select set_config('app.env', $1, true)", [env]).catch(() => {});
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter, log: ["error"] });
  return { prisma, pool };
}

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseStorageObjectFromUrl(urlRaw: string | null): StorageObject | null {
  if (!urlRaw) return null;
  try {
    const url = new URL(urlRaw);
    const markerPublic = "/storage/v1/object/public/";
    const markerSign = "/storage/v1/object/sign/";
    const marker = url.pathname.includes(markerPublic)
      ? markerPublic
      : url.pathname.includes(markerSign)
        ? markerSign
        : null;
    if (!marker) return null;
    const payload = url.pathname.split(marker)[1] || "";
    const slash = payload.indexOf("/");
    if (slash <= 0) return null;
    const bucket = payload.slice(0, slash).trim();
    const objectPath = payload.slice(slash + 1).trim();
    if (!bucket || !objectPath) return null;
    return { bucket, objectPath };
  } catch {
    return null;
  }
}

function extractStorageObject(params: {
  metadata: unknown;
  storagePath: string | null;
  url: string | null;
  defaultBucket: string;
}): StorageObject | null {
  const metadata = asRecord(params.metadata);
  const bucket = asString(metadata?.bucket) || params.defaultBucket;
  const objectPath = asString(metadata?.path) || params.storagePath;
  if (bucket && objectPath) {
    return { bucket, objectPath };
  }
  return parseStorageObjectFromUrl(params.url);
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env"));

  const execute = process.argv.includes("--execute");
  const appEnv = resolveScriptAppEnv();
  const defaultBucket =
    process.env.CHAT_ATTACHMENTS_BUCKET ||
    process.env.UPLOADS_BUCKET ||
    process.env.NEXT_PUBLIC_SUPABASE_UPLOADS_BUCKET ||
    "uploads";

  const reportStartedAt = new Date().toISOString();
  const report: PurgeReport = {
    startedAt: reportStartedAt,
    finishedAt: reportStartedAt,
    mode: execute ? "execute" : "dry-run",
    totals: {
      attachmentsFound: 0,
      messagesFound: 0,
      conversationsImpacted: 0,
      storageObjectsFound: 0,
      mediaAssetsFound: 0,
      memberPointersAffected: 0,
      storageObjectsDeleted: 0,
      mediaAssetsDeleted: 0,
      messagesDeleted: 0,
      conversationsRecalculated: 0,
      memberPointersReconciled: 0,
    },
    integrity: {
      remainingAttachmentsForPurgedMessages: 0,
      remainingMediaAssetsForPurgedObjects: 0,
      danglingConversationLastMessageIds: 0,
      danglingMemberLastReadMessageIds: 0,
    },
    errors: [],
  };

  const { prisma, pool } = createScriptPrismaClient(appEnv);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE;
  const supabase =
    execute && supabaseUrl && supabaseServiceRole
      ? createClient(supabaseUrl, supabaseServiceRole, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

  if (execute && !supabase) {
    throw new Error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE for --execute.");
  }

  try {
    const attachments = await prisma.chatConversationAttachment.findMany({
      where: { env: appEnv },
      select: {
        id: true,
        messageId: true,
        storagePath: true,
        metadata: true,
        url: true,
        message: {
          select: {
            id: true,
            conversationId: true,
          },
        },
      },
    });

    report.totals.attachmentsFound = attachments.length;
    const messageIds = Array.from(new Set(attachments.map((item) => item.messageId)));
    const conversationIds = Array.from(
      new Set(attachments.map((item) => item.message.conversationId).filter((value) => typeof value === "string")),
    );
    report.totals.messagesFound = messageIds.length;
    report.totals.conversationsImpacted = conversationIds.length;

    const removedByConversation = new Map<string, Set<string>>();
    for (const attachment of attachments) {
      const set = removedByConversation.get(attachment.message.conversationId) || new Set<string>();
      set.add(attachment.messageId);
      removedByConversation.set(attachment.message.conversationId, set);
    }

    const storageObjectMap = new Map<string, StorageObject>();
    for (const attachment of attachments) {
      const object = extractStorageObject({
        metadata: attachment.metadata,
        storagePath: attachment.storagePath,
        url: attachment.url,
        defaultBucket,
      });
      if (!object) {
        report.errors.push({
          step: "extract-storage-object",
          detail: `Attachment ${attachment.id} has no bucket/path metadata`,
        });
        continue;
      }
      storageObjectMap.set(`${object.bucket}:::${object.objectPath}`, object);
    }

    const storageObjects = Array.from(storageObjectMap.values());
    report.totals.storageObjectsFound = storageObjects.length;

    const mediaAssets = [] as Array<{ id: string }>;
    for (const batch of chunk(storageObjects, 100)) {
      const rows = await prisma.mediaAsset.findMany({
        where: {
          env: appEnv,
          OR: batch.map((item) => ({ bucket: item.bucket, objectPath: item.objectPath })),
        },
        select: { id: true },
      });
      mediaAssets.push(...rows);
    }
    report.totals.mediaAssetsFound = mediaAssets.length;

    const affectedPointersByConversation = new Map<string, string[]>();
    for (const conversationId of conversationIds) {
      const removedInConversation = removedByConversation.get(conversationId) || new Set<string>();
      const members = await prisma.chatConversationMember.findMany({
        where: { env: appEnv, conversationId, NOT: { lastReadMessageId: null } },
        select: { userId: true, lastReadMessageId: true },
      });
      const affectedUserIds = members
        .filter((member) => !!member.lastReadMessageId && removedInConversation.has(member.lastReadMessageId))
        .map((member) => member.userId);
      if (affectedUserIds.length > 0) {
        affectedPointersByConversation.set(conversationId, affectedUserIds);
      }
    }
    report.totals.memberPointersAffected = Array.from(affectedPointersByConversation.values()).reduce(
      (acc, item) => acc + item.length,
      0,
    );

    if (execute) {
      const objectsByBucket = new Map<string, string[]>();
      for (const item of storageObjects) {
        const existing = objectsByBucket.get(item.bucket) || [];
        existing.push(item.objectPath);
        objectsByBucket.set(item.bucket, existing);
      }

      for (const [bucket, paths] of objectsByBucket.entries()) {
        for (const pathBatch of chunk(paths, 100)) {
          const { error } = await supabase!.storage.from(bucket).remove(pathBatch);
          if (error) {
            report.errors.push({
              step: "storage-remove",
              detail: `bucket=${bucket}: ${error.message}`,
            });
          } else {
            report.totals.storageObjectsDeleted += pathBatch.length;
          }
        }
      }

      for (const batch of chunk(mediaAssets.map((item) => item.id), 500)) {
        const result = await prisma.mediaAsset.deleteMany({ where: { env: appEnv, id: { in: batch } } });
        report.totals.mediaAssetsDeleted += result.count;
      }

      for (const batch of chunk(messageIds, 500)) {
        const result = await prisma.chatConversationMessage.deleteMany({ where: { env: appEnv, id: { in: batch } } });
        report.totals.messagesDeleted += result.count;
      }

      for (const conversationId of conversationIds) {
        const latestRoot = await prisma.chatConversationMessage.findFirst({
          where: { env: appEnv, conversationId, deletedAt: null, replyToId: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, createdAt: true },
        });

        await prisma.chatConversation.updateMany({
          where: { env: appEnv, id: conversationId },
          data: {
            lastMessageId: latestRoot?.id ?? null,
            lastMessageAt: latestRoot?.createdAt ?? null,
          },
        });
        report.totals.conversationsRecalculated += 1;
      }

      for (const [conversationId, userIds] of affectedPointersByConversation.entries()) {
        const latestReadable = await prisma.chatConversationMessage.findFirst({
          where: { env: appEnv, conversationId, deletedAt: null },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, createdAt: true },
        });

        const update = await prisma.chatConversationMember.updateMany({
          where: { env: appEnv, conversationId, userId: { in: userIds } },
          data: {
            lastReadMessageId: latestReadable?.id ?? null,
            lastReadAt: latestReadable?.createdAt ?? null,
          },
        });
        report.totals.memberPointersReconciled += update.count;
      }
    }

    const remainingAttachments = messageIds.length
      ? await prisma.chatConversationAttachment.count({ where: { env: appEnv, messageId: { in: messageIds } } })
      : 0;
    report.integrity.remainingAttachmentsForPurgedMessages = remainingAttachments;

    let remainingMediaAssets = 0;
    for (const batch of chunk(storageObjects, 100)) {
      remainingMediaAssets += await prisma.mediaAsset.count({
        where: {
          env: appEnv,
          OR: batch.map((item) => ({ bucket: item.bucket, objectPath: item.objectPath })),
        },
      });
    }
    report.integrity.remainingMediaAssetsForPurgedObjects = remainingMediaAssets;

    const danglingConversations = await prisma.chatConversation.count({
      where: {
        env: appEnv,
        NOT: { lastMessageId: null },
        lastMessage: null,
      },
    });
    report.integrity.danglingConversationLastMessageIds = danglingConversations;

    const danglingMembers = await prisma.chatConversationMember.count({
      where: {
        env: appEnv,
        NOT: { lastReadMessageId: null },
        lastReadMessage: null,
      },
    });
    report.integrity.danglingMemberLastReadMessageIds = danglingMembers;
  } finally {
    await prisma.$disconnect();
    await pool.end().catch(() => {});
    report.finishedAt = new Date().toISOString();
    const reportDir = path.join(process.cwd(), "reports");
    fs.mkdirSync(reportDir, { recursive: true });
    const stamp = report.finishedAt.replace(/[:.]/g, "-");
    const reportPath = path.join(reportDir, `messages_attachment_purge_${stamp}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

    console.log("[messages-attachment-purge] mode:", report.mode);
    console.log("[messages-attachment-purge] report:", path.relative(process.cwd(), reportPath));
    console.log("[messages-attachment-purge] totals:", JSON.stringify(report.totals));
    console.log("[messages-attachment-purge] integrity:", JSON.stringify(report.integrity));
    if (report.errors.length > 0) {
      console.log("[messages-attachment-purge] errors:", report.errors.length);
      report.errors.slice(0, 20).forEach((entry, index) => {
        console.log(`  ${index + 1}. ${entry.step}: ${entry.detail}`);
      });
    }
  }
}

main().catch((error) => {
  console.error("[messages-attachment-purge] fatal", error);
  process.exit(1);
});
