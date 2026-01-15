// app/api/upload/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { AuthRequiredError, requireUser } from "@/lib/auth/requireUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB
const UPLOAD_WINDOW_MS = 5 * 60 * 1000; // 5 minutos
const MAX_UPLOADS_PER_WINDOW = 30;
const ipHits = new Map<string, number[]>();

type DetectedImage = { ext: string; mime: string };

function detectImageType(buffer: Buffer): DetectedImage | null {
  if (buffer.length < 12) return null;

  // PNG
  if (buffer.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: "png", mime: "image/png" };
  }

  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }

  // GIF
  const gifHeader = buffer.slice(0, 6).toString("ascii");
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
    return { ext: "gif", mime: "image/gif" };
  }

  // WebP
  const riffHeader = buffer.slice(0, 4).toString("ascii");
  const webpHeader = buffer.slice(8, 12).toString("ascii");
  if (riffHeader === "RIFF" && webpHeader === "WEBP") {
    return { ext: "webp", mime: "image/webp" };
  }

  return null;
}

function getClientIp(req: NextRequest) {
  const header = req.headers.get("x-forwarded-for") || "";
  const first = header.split(",")[0]?.trim();
  return first || "unknown";
}

function isRateLimited(ip: string) {
  const now = Date.now();
  const windowStart = now - UPLOAD_WINDOW_MS;
  const hits = ipHits.get(ip)?.filter((ts) => ts > windowStart) ?? [];
  hits.push(now);
  ipHits.set(ip, hits);
  return hits.length > MAX_UPLOADS_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  try {
    await requireUser(); // só utilizadores autenticados podem fazer upload

    const ip = getClientIp(req);
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Demasiados uploads. Tenta mais tarde." }, { status: 429 });
    }

    const contentLengthHeader = req.headers.get("content-length");
    const declaredSize = contentLengthHeader ? Number(contentLengthHeader) : null;
    if (declaredSize && (!Number.isFinite(declaredSize) || declaredSize > MAX_UPLOAD_BYTES)) {
      return NextResponse.json(
        { error: "Ficheiro demasiado grande." },
        { status: 413 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhum ficheiro enviado." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.byteLength === 0) {
      return NextResponse.json({ error: "Ficheiro vazio." }, { status: 400 });
    }
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "Ficheiro demasiado grande." }, { status: 413 });
    }

    const detected = detectImageType(buffer);
    if (!detected) {
      return NextResponse.json({ error: "Só são permitidas imagens (png, jpg, gif, webp)." }, { status: 400 });
    }

    const scope = req.nextUrl.searchParams.get("scope");
    const isPublicScope =
      scope === "avatar" ||
      scope === "event-cover" ||
      scope === "profile-cover" ||
      scope === "service-cover";

    const bucketResolution = (() => {
      if (scope === "avatar") {
        if (env.avatarsBucket) return { bucket: env.avatarsBucket, folder: "avatars" };
        // fallback para bucket geral se avatars não estiver configurado
        return { bucket: env.uploadsBucket || "uploads", folder: "avatars" };
      }
      if (scope === "event-cover") {
        if (env.eventCoversBucket) return { bucket: env.eventCoversBucket, folder: "event-covers" };
        return { bucket: env.uploadsBucket || "uploads", folder: "event-covers" };
      }
      if (scope === "service-cover") {
        if (env.eventCoversBucket) return { bucket: env.eventCoversBucket, folder: "service-covers" };
        return { bucket: env.uploadsBucket || "uploads", folder: "service-covers" };
      }
      if (scope === "profile-cover") {
        return { bucket: env.uploadsBucket || "uploads", folder: "profile-covers" };
      }
      // default/general uploads
      return { bucket: env.uploadsBucket || "uploads", folder: "uploads" };
    })();

    if (!bucketResolution.bucket) {
      return NextResponse.json({ error: "Bucket de storage não configurado." }, { status: 500 });
    }

    const randomName = crypto.randomBytes(16).toString("hex");
    const filename = `${Date.now()}-${randomName}.${detected.ext}`;
    const objectPath = `${bucketResolution.folder}/${filename}`;

    const uploadRes = await supabaseAdmin.storage
      .from(bucketResolution.bucket)
      .upload(objectPath, buffer, {
        contentType: detected.mime,
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadRes.error) {
      console.error("[POST /api/upload] supabase upload error", uploadRes.error);
      return NextResponse.json({ error: "Erro ao fazer upload da imagem." }, { status: 500 });
    }

    let url: string | null = null;
    let signedUrl: string | null = null;

    if (!isPublicScope && env.storageSignedUrls) {
      const signed = await supabaseAdmin.storage
        .from(bucketResolution.bucket)
        .createSignedUrl(objectPath, env.storageSignedTtlSeconds);
      if (signed.error || !signed.data?.signedUrl) {
        console.error("[POST /api/upload] signed url error", signed.error);
        return NextResponse.json({ error: "Erro ao gerar URL de download." }, { status: 500 });
      }
      signedUrl = signed.data.signedUrl;
      url = signedUrl;
    } else {
      const { data: publicUrlData } = supabaseAdmin.storage.from(bucketResolution.bucket).getPublicUrl(objectPath);
      url = publicUrlData.publicUrl;
    }

    return NextResponse.json(
      {
        url,
        signedUrl,
        mime: detected.mime,
        size: buffer.byteLength,
        scope: scope ?? "general",
        bucket: bucketResolution.bucket,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthRequiredError) {
      return NextResponse.json({ error: "Precisas de iniciar sessão." }, { status: 401 });
    }
    console.error("[POST /api/upload]", err);
    return NextResponse.json(
      { error: "Erro ao fazer upload da imagem." },
      { status: 500 }
    );
  }
}
