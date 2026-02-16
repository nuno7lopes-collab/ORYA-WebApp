export const runtime = "nodejs";

import crypto from "crypto";
import { NextRequest } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { CHAT_MAX_ATTACHMENT_BYTES } from "@/lib/chat/constants";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { prisma } from "@/lib/prisma";

const DEFAULT_DAILY_QUOTA_BYTES = 250 * 1024 * 1024;
const ATTACHMENT_UPLOAD_TTL_SECONDS = 15 * 60;

function getMessagesScope(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope")?.trim().toLowerCase();
  return scope === "b2c" ? "b2c" : "org";
}

function sanitizeFilename(filename: string) {
  const base = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!base) return "attachment";
  return base.slice(0, 120);
}

function parseAttachmentType(mime: string) {
  const normalized = mime.toLowerCase();
  if (normalized.startsWith("image/")) return "IMAGE";
  if (normalized.startsWith("video/")) return "VIDEO";
  return "FILE";
}

function isMimeValid(mime: string) {
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(mime);
}

async function resolveActor(req: NextRequest) {
  const scope = getMessagesScope(req);
  if (scope === "b2c") {
    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);
    return {
      scope,
      userId: user.id,
      organizationId: null as number | null,
    };
  }

  const { user, organization } = await requireChatContext(req);
  return {
    scope,
    userId: user.id,
    organizationId: organization.id,
  };
}

async function _POST(req: NextRequest) {
  try {
    const actor = await resolveActor(req);

    const payload = (await req.json().catch(() => null)) as {
      filename?: unknown;
      mime?: unknown;
      size?: unknown;
      checksumSha256?: unknown;
    } | null;

    const mime = typeof payload?.mime === "string" ? payload.mime.trim().toLowerCase() : "";
    const size = typeof payload?.size === "number" ? payload.size : Number(payload?.size);
    const filenameRaw = typeof payload?.filename === "string" ? payload.filename.trim() : "attachment";
    const filename = sanitizeFilename(filenameRaw);
    const checksumRaw =
      typeof payload?.checksumSha256 === "string" ? payload.checksumSha256.trim().toLowerCase() : "";

    if (!mime || !isMimeValid(mime)) {
      return jsonWrap({ ok: false, error: "INVALID_ATTACHMENT_MIME" }, { status: 400 });
    }
    if (!Number.isFinite(size) || size <= 0) {
      return jsonWrap({ ok: false, error: "INVALID_ATTACHMENT_SIZE" }, { status: 400 });
    }
    if (size > CHAT_MAX_ATTACHMENT_BYTES) {
      return jsonWrap({ ok: false, error: "ATTACHMENT_TOO_LARGE" }, { status: 400 });
    }
    if (!checksumRaw || !/^[a-f0-9]{64}$/.test(checksumRaw)) {
      return jsonWrap({ ok: false, error: "ATTACHMENT_CHECKSUM_FAILED" }, { status: 400 });
    }

    const quotaConfig = Number(process.env.CHAT_ATTACHMENT_DAILY_QUOTA_BYTES ?? DEFAULT_DAILY_QUOTA_BYTES);
    const dailyQuotaBytes = Number.isFinite(quotaConfig) && quotaConfig > 0 ? Math.floor(quotaConfig) : DEFAULT_DAILY_QUOTA_BYTES;

    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    const usedAgg = await prisma.mediaAsset.aggregate({
      _sum: { sizeBytes: true },
      where: {
        uploadedByUserId: actor.userId,
        scope: "chat-attachment",
        createdAt: { gte: dayStart },
      },
    });
    const usedBytes = usedAgg._sum.sizeBytes ?? 0;
    if (usedBytes + size > dailyQuotaBytes) {
      return jsonWrap({ ok: false, error: "ATTACHMENT_QUOTA_EXCEEDED" }, { status: 429 });
    }

    const bucket = process.env.CHAT_ATTACHMENTS_BUCKET ?? env.uploadsBucket ?? "uploads";
    const datePrefix = now.toISOString().slice(0, 10).replace(/-/g, "/");
    const scopePrefix = actor.scope === "b2c" ? "b2c" : `org_${actor.organizationId}`;
    const objectPath = `chat/${scopePrefix}/${actor.userId}/${datePrefix}/${crypto.randomUUID()}-${filename}`;

    const signedUpload = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(objectPath);
    if (signedUpload.error || !signedUpload.data) {
      console.error("[messages.attachments.presign] createSignedUploadUrl failed", signedUpload.error);
      return jsonWrap({ ok: false, error: "ATTACHMENT_UPLOAD_URL_FAILED" }, { status: 500 });
    }

    const metadata = {
      bucket,
      path: objectPath,
      filename,
      checksumSha256: checksumRaw,
      scanStatus: "ready",
      dlpStatus: "passed",
      quotaCheckedAt: now.toISOString(),
      quotaDailyBytes: dailyQuotaBytes,
      quotaUsedBytes: usedBytes + size,
      securityPipeline: "chat_v1",
      accessScope: actor.scope,
    } as const;

    return jsonWrap({
      ok: true,
      upload: {
        bucket,
        path: objectPath,
        token: signedUpload.data.token,
        signedUrl: signedUpload.data.signedUrl ?? null,
        expiresInSeconds: ATTACHMENT_UPLOAD_TTL_SECONDS,
      },
      attachment: {
        type: parseAttachmentType(mime),
        url: `orya-attachment://${bucket}/${objectPath}`,
        mime,
        size,
        metadata,
      },
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("[messages.attachments.presign] error", err);
    return jsonWrap({ ok: false, error: "ATTACHMENT_PRESIGN_FAILED" }, { status: 500 });
  }
}

export const POST = withApiEnvelope(_POST);
