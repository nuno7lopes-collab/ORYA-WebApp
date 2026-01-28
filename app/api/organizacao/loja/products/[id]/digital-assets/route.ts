export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
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
  if (created.error && created.error.statusCode !== 409) {
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

async function _GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    const resolvedParams = await params;
    const resolved = resolveProductId(resolvedParams);
    if (!resolved.ok) {
      return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: resolved.productId, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
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

    return NextResponse.json({ ok: true, items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/organizacao/loja/products/[id]/digital-assets error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar ficheiros." }, { status: 500 });
  }
}

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const context = await getOrganizationContext(req, user.id, { requireVerifiedEmail: req.method !== "GET" });
    if (!context.ok) {
      return NextResponse.json({ ok: false, error: context.error }, { status: 403 });
    }

    if (context.store.catalogLocked) {
      return NextResponse.json({ ok: false, error: "Catalogo bloqueado." }, { status: 403 });
    }

    const resolvedParams = await params;
    const resolved = resolveProductId(resolvedParams);
    if (!resolved.ok) {
      return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 });
    }

    const product = await prisma.storeProduct.findFirst({
      where: { id: resolved.productId, storeId: context.store.id },
      select: { id: true },
    });
    if (!product) {
      return NextResponse.json({ ok: false, error: "Produto nao encontrado." }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Ficheiro em falta." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    if (buffer.byteLength === 0) {
      return NextResponse.json({ ok: false, error: "Ficheiro vazio." }, { status: 400 });
    }
    if (buffer.byteLength > MAX_DIGITAL_BYTES) {
      return NextResponse.json({ ok: false, error: "Ficheiro demasiado grande." }, { status: 413 });
    }

    const maxDownloadsRaw = formData.get("maxDownloads");
    let maxDownloads: number | null = null;
    if (typeof maxDownloadsRaw === "string" && maxDownloadsRaw.trim()) {
      const parsed = Number(maxDownloadsRaw);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return NextResponse.json({ ok: false, error: "Max downloads invalido." }, { status: 400 });
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
      return NextResponse.json({ ok: false, error: "Storage indisponivel." }, { status: 500 });
    }
    const uploadRes = await supabaseAdmin.storage.from(bucket).upload(objectPath, buffer, {
      contentType: file.type || "application/octet-stream",
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadRes.error) {
      console.error("[POST /api/organizacao/loja/products/[id]/digital-assets] upload error", uploadRes.error);
      return NextResponse.json({ ok: false, error: "Erro ao fazer upload." }, { status: 500 });
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

    return NextResponse.json({ ok: true, item: created }, { status: 201 });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/organizacao/loja/products/[id]/digital-assets error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao criar ficheiro." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);
export const POST = withApiEnvelope(_POST);
