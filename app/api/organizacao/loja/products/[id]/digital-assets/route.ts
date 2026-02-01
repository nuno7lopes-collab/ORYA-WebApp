export const runtime = "nodejs";

import { NextRequest } from "next/server";
import crypto from "crypto";
import path from "path";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { getActiveOrganizationForUser } from "@/lib/organizationContext";
import { resolveOrganizationIdFromRequest } from "@/lib/organizationId";
import { ensureLojaModuleAccess } from "@/lib/loja/access";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { OrganizationMemberRole } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";
import { getRequestContext } from "@/lib/http/requestContext";
import { respondError, respondOk } from "@/lib/http/envelope";

const MAX_DIGITAL_BYTES = 100 * 1024 * 1024; // 100MB

const ROLE_ALLOWLIST: OrganizationMemberRole[] = [
  OrganizationMemberRole.OWNER,
  OrganizationMemberRole.CO_OWNER,
  OrganizationMemberRole.ADMIN,
  OrganizationMemberRole.STAFF,
];

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
  if (created.error) {
    const status = typeof (created.error as { status?: number }).status === "number"
      ? (created.error as { status?: number }).status
      : null;
    if (status !== 409) {
      return { ok: false as const, error: created.error };
    }
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

async function getOrganizationContext(req: NextRequest, userId: string, options?: { requireVerifiedEmail?: boolean }) {
  const organizationId = resolveOrganizationIdFromRequest(req);
  const { organization, membership } = await getActiveOrganizationForUser(userId, {
    organizationId: organizationId ?? undefined,
    roles: [...ROLE_ALLOWLIST],
  });

  if (!organization || !membership) {
    return { ok: false as const, error: "Sem permissoes." };
  }

  const lojaAccess = await ensureLojaModuleAccess(organization, undefined, options);
  if (!lojaAccess.ok) {
    return { ok: false as const, error: lojaAccess.error };
  }

  const store = await prisma.store.findFirst({
    where: { ownerOrganizationId: organization.id },
    select: { id: true, catalogLocked: true },
  });

  if (!store) {
    return { ok: false as const, error: "Loja ainda nao criada." };
  }

  return { ok: true as const, organization, store };
}

function resolveProductId(params: { id: string }) {
  const productId = Number(params.id);
  if (!Number.isFinite(productId)) {
    return { ok: false as const, error: "ID invalido." };
  }
  return { ok: true as const, productId };
}

function errorCodeForStatus(status: number) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 413) return "PAYLOAD_TOO_LARGE";
  if (status === 422) return "VALIDATION_FAILED";
  if (status === 400) return "BAD_REQUEST";
  return "INTERNAL_ERROR";
}
async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    if (!isStoreFeatureEnabled()) {
      return fail(403, "Loja desativada.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return fail(403, context.error);
    }

    const resolvedParams = await params;
    const resolved = resolveProductId(resolvedParams);
    if (!resolved.ok) {
      return fail(400, resolved.error);
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: resolved.productId, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return fail(404, "Produto nao encontrado.");
    }

    const items = await prisma.storeDigitalAsset.findMany({
      where: { productId: resolved.productId },
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

    return respondOk(ctx, {items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("GET /api/organizacao/loja/products/[id]/digital-assets error:", err);
    return fail(500, "Erro ao carregar ficheiros.");
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = getRequestContext(req);
  const fail = (
    status: number,
    message: string,
    errorCode = errorCodeForStatus(status),
    retryable = status >= 500,
  ) => {
    const resolvedMessage = typeof message === "string" ? message : String(message);
    const resolvedCode = /^[A-Z0-9_]+$/.test(resolvedMessage) ? resolvedMessage : errorCode;
    return respondError(ctx, { errorCode: resolvedCode, message: resolvedMessage, retryable }, { status });
  };
  try {
    if (!isStoreFeatureEnabled()) {
      return fail(403, "Loja desativada.");
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return fail(403, context.error);
    }

    if (context.store.catalogLocked) {
      return fail(403, "Catalogo bloqueado.");
    }

    const resolvedParams = await params;
    const resolved = resolveProductId(resolvedParams);
    if (!resolved.ok) {
      return fail(400, resolved.error);
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: resolved.productId, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return fail(404, "Produto nao encontrado.");
    }

    const formData = (await req.formData()) as unknown as { get(name: string): FormDataEntryValue | null };
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail(400, "Ficheiro em falta.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.byteLength === 0) {
      return fail(400, "Ficheiro vazio.");
    }
    if (buffer.byteLength > MAX_DIGITAL_BYTES) {
      return fail(413, "Ficheiro demasiado grande.");
    }

    const maxDownloadsRaw = formData.get("maxDownloads");
    let maxDownloads: number | null = null;
    if (typeof maxDownloadsRaw === "string" && maxDownloadsRaw.trim()) {
      const parsed = Number(maxDownloadsRaw);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return fail(400, "Max downloads invalido.");
      }
      maxDownloads = Math.trunc(parsed);
    }

    const isActive = parseBoolean(formData.get("isActive"), true);

    const safeName = sanitizeFilename(file.name || "download");
    const ext = path.extname(safeName).toLowerCase();
    const randomName = crypto.randomBytes(16).toString("hex");
    const objectName = `${Date.now()}-${randomName}${ext}`;
    const objectPath = `store-digital-assets/${resolved.productId}/${objectName}`;

    const bucket = env.uploadsBucket || "uploads";
    const ensured = await ensureBucketExists(bucket);
    if (!ensured.ok) {
      console.error("[POST /api/organizacao/loja/products/[id]/digital-assets] ensure bucket error", ensured.error);
      return fail(500, "Storage indisponivel.");
    }
    const uploadRes = await supabaseAdmin.storage.from(bucket).upload(objectPath, buffer, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadRes.error) {
      console.error("[POST /api/organizacao/loja/products/[id]/digital-assets] upload error", uploadRes.error);
      return fail(500, "Erro ao fazer upload.");
    }

    const created = await prisma.storeDigitalAsset.create({
      data: {
        productId: resolved.productId,
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

    return respondOk(ctx, {item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return fail(401, "Nao autenticado.");
    }
    console.error("POST /api/organizacao/loja/products/[id]/digital-assets error:", err);
    return fail(500, "Erro ao criar ficheiro.");
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
