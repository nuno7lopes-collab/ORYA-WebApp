export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/auth/rateLimit";
import { ChatContextError, requireChatContext } from "@/lib/chat/context";
import { isChatV2Enabled } from "@/lib/chat/featureFlags";
import { isUnauthenticatedError } from "@/lib/security";
import { CHAT_MAX_ATTACHMENT_BYTES } from "@/lib/chat/constants";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

async function ensureBucketExists(bucket: string, isPublic: boolean) {
  const list = await supabaseAdmin.storage.listBuckets();
  if (list.error) {
    return { ok: false as const, error: list.error };
  }
  const exists = list.data?.some((entry) => entry.name === bucket);
  if (exists) {
    return { ok: true as const };
  }
  const created = await supabaseAdmin.storage.createBucket(bucket, { public: isPublic });
  if (created.error) {
    const statusCode =
      typeof (created.error as { statusCode?: number }).statusCode === "number"
        ? (created.error as { statusCode?: number }).statusCode
        : undefined;
    if (statusCode !== 409) {
      return { ok: false as const, error: created.error };
    }
  }
  return { ok: true as const };
}

async function _POST(req: NextRequest) {
  try {
    if (!isChatV2Enabled()) {
      return jsonWrap({ ok: false, error: "CHAT_DISABLED" }, { status: 404 });
    }

    const { user, organization } = await requireChatContext(req);

    const limiter = await rateLimit(req, {
      windowMs: 60 * 1000,
      max: 30,
      keyPrefix: "chat:attachments:presign",
      identifier: user.id,
    });
    if (!limiter.allowed) {
      return jsonWrap(
        { ok: false, error: "RATE_LIMITED" },
        { status: 429, headers: { "Retry-After": String(limiter.retryAfter) } },
      );
    }

    const payload = (await req.json().catch(() => null)) as {
      type?: unknown;
      mime?: unknown;
      size?: unknown;
      metadata?: unknown;
    } | null;

    const type = typeof payload?.type === "string" ? payload.type.trim().toUpperCase() : "";
    const mime = typeof payload?.mime === "string" ? payload.mime.trim() : "";
    const size = typeof payload?.size === "number" ? payload.size : Number(payload?.size);

    if (!type || !["IMAGE", "VIDEO", "FILE"].includes(type)) {
      return jsonWrap({ ok: false, error: "INVALID_TYPE" }, { status: 400 });
    }
    if (!mime) {
      return jsonWrap({ ok: false, error: "INVALID_MIME" }, { status: 400 });
    }
    if (!Number.isFinite(size) || size <= 0) {
      return jsonWrap({ ok: false, error: "INVALID_SIZE" }, { status: 400 });
    }
    if (size > CHAT_MAX_ATTACHMENT_BYTES) {
      return jsonWrap({ ok: false, error: "ATTACHMENT_TOO_LARGE" }, { status: 400 });
    }

    const bucket = process.env.CHAT_ATTACHMENTS_BUCKET ?? env.uploadsBucket ?? "uploads";
    const isPublic = process.env.CHAT_ATTACHMENTS_PUBLIC === "true";
    const ensured = await ensureBucketExists(bucket, isPublic);
    if (!ensured.ok) {
      console.error("[chat][presign] erro a garantir bucket", ensured.error);
      return jsonWrap({ ok: false, error: "STORAGE_ERROR" }, { status: 500 });
    }

    const ext = EXTENSIONS[mime] ?? "bin";
    const randomName = crypto.randomBytes(12).toString("hex");
    const objectPath = `chat-attachments/${organization.id}/${user.id}/${Date.now()}-${randomName}.${ext}`;

    const signed = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(objectPath);
    if (signed.error || !signed.data?.signedUrl || !signed.data?.path) {
      console.error("[chat][presign] signed upload error", signed.error);
      return jsonWrap({ ok: false, error: "STORAGE_ERROR" }, { status: 500 });
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(signed.data.path);
    let resolvedUrl = publicUrlData.publicUrl;
    if (!isPublic) {
      const signedRead = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrl(signed.data.path, env.storageSignedTtlSeconds);
      if (signedRead.data?.signedUrl) {
        resolvedUrl = signedRead.data.signedUrl;
      }
    }

    return jsonWrap({
      ok: true,
      uploadUrl: signed.data.signedUrl,
      uploadToken: signed.data.token,
      path: signed.data.path,
      bucket,
      url: resolvedUrl,
    });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
    }
    if (err instanceof ChatContextError) {
      return jsonWrap({ ok: false, error: err.code }, { status: err.status });
    }
    console.error("POST /api/messages/attachments/presign error:", err);
    return jsonWrap({ ok: false, error: "Erro ao gerar upload." }, { status: 500 });
  }
}
export const POST = withApiEnvelope(_POST);