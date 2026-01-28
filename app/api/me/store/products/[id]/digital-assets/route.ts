export const runtime = "nodejs";

import { NextRequest } from "next/server";
import crypto from "crypto";
import path from "path";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { jsonWrap } from "@/lib/api/wrapResponse";

const MAX_DIGITAL_BYTES = 100 * 1024 * 1024; // 100MB

async function ensureBucketExists(bucket: string) {
  const list = await supabaseAdmin.storage.listBuckets();
  if (list.error) {
    return { ok: false as const, error: list.error };
  }
  const exists = list.data?.some((entry) => entry.name === bucket);
  if (exists) {
    return { ok: true as const };
  }
  const created = await supabaseAdmin.storage.createBucket(bucket, { public: false });
  const statusCode =
    (created.error as { statusCode?: number; status?: number } | null)?.statusCode ??
    (created.error as { status?: number } | null)?.status;
  if (created.error && statusCode !== 409) {
    return { ok: false as const, error: created.error };
  }
  return { ok: true as const };
}

function sanitizeFilename(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "download";
  const cleaned = base.replace(/[^A-Za-z0-9_.()\- ]+/g, "").trim();
  return cleaned || "download";
}

function parseBoolean(raw: unknown, fallback: boolean) {
  if (typeof raw !== "string") return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

async function getStoreContext(userId: string) {
  const store = await prisma.store.findFirst({
    where: { ownerUserId: userId },
    select: { id: true, catalogLocked: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, store };
}

function parseId(value: string) {
  const id = Number(value);
  if (!Number.isFinite(id)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, id };
}

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return jsonWrap({ ok: false, error: productId.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return jsonWrap({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const items = await prisma.storeDigitalAsset.findMany({
      where: { productId: productId.id },
      orderBy: [{ createdAt: "asc" }],
      select: {
        id: true,
        filename: true,
        sizeBytes: true,
        mimeType: true,
        maxDownloads: true,
        isActive: true,
        createdAt: true,
      },
    });

    return jsonWrap({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/me/store/products/[id]/digital-assets error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar ficheiros." }, { status: 500 });
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getStoreContext(user.id);
    if (!context.ok) {
      return jsonWrap({ ok: false, error: context.error }, { status: 403 });
    }

    if (context.store.catalogLocked) {
      return jsonWrap({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const resolvedParams = await params;
    const productId = parseId(resolvedParams.id);
    if (!productId.ok) {
      return jsonWrap({ ok: false, error: productId.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: productId.id, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return jsonWrap({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonWrap({ ok: false, error: "Ficheiro em falta." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.byteLength === 0) {
      return jsonWrap({ ok: false, error: "Ficheiro vazio." }, { status: 400 });
    }
    if (buffer.byteLength > MAX_DIGITAL_BYTES) {
      return jsonWrap({ ok: false, error: "Ficheiro demasiado grande." }, { status: 413 });
    }

    const maxDownloadsRaw = formData.get("maxDownloads");
    let maxDownloads: number | null = null;
    if (typeof maxDownloadsRaw === "string" && maxDownloadsRaw.trim()) {
      const parsed = Number(maxDownloadsRaw);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return jsonWrap({ ok: false, error: "Max downloads invalido." }, { status: 400 });
      }
      maxDownloads = Math.trunc(parsed);
    }

    const isActive = parseBoolean(formData.get("isActive"), true);

    const safeName = sanitizeFilename(file.name || "download");
    const ext = path.extname(safeName).toLowerCase();
    const randomName = crypto.randomBytes(16).toString("hex");
    const objectName = `${Date.now()}-${randomName}${ext}`;
    const objectPath = `store-digital-assets/${productId.id}/${objectName}`;

    const bucket = env.uploadsBucket || "uploads";
    const ensured = await ensureBucketExists(bucket);
    if (!ensured.ok) {
      console.error("[POST /api/me/store/products/[id]/digital-assets] ensure bucket error", ensured.error);
      return jsonWrap({ ok: false, error: "Storage indisponivel." }, { status: 500 });
    }
    const uploadRes = await supabaseAdmin.storage.from(bucket).upload(objectPath, buffer, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadRes.error) {
      console.error("[POST /api/me/store/products/[id]/digital-assets] upload error", uploadRes.error);
      return jsonWrap({ ok: false, error: "Erro ao fazer upload." }, { status: 500 });
    }

    const created = await prisma.storeDigitalAsset.create({
      data: {
        productId: productId.id,
        storagePath: objectPath,
        filename: safeName,
        sizeBytes: buffer.byteLength,
        mimeType: file.type || "application/octet-stream",
        maxDownloads,
        isActive,
      },
      select: {
        id: true,
        filename: true,
        sizeBytes: true,
        mimeType: true,
        maxDownloads: true,
        isActive: true,
        createdAt: true,
      },
    });

    return jsonWrap({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/me/store/products/[id]/digital-assets error:", err);
    return jsonWrap({ ok: false, error: "Erro ao criar ficheiro." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
