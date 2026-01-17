export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { env } from "@/lib/env";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { z } from "zod";

const downloadSchema = z.object({
  grantId: z.number().int().positive(),
  assetId: z.number().int().positive(),
});

function parseAssetId(raw: string | null) {
  const assetId = raw ? Number(raw) : null;
  if (!assetId || !Number.isFinite(assetId)) {
    return { ok: false as const, error: "Asset invalido." };
  }
  return { ok: true as const, assetId };
}

async function issueSignedUrl(params: { grantId: number; assetId: number; productId: number }) {
  const asset = await prisma.storeDigitalAsset.findFirst({
    where: { id: params.assetId, productId: params.productId, isActive: true },
    select: {
      id: true,
      storagePath: true,
      filename: true,
      sizeBytes: true,
      mimeType: true,
      maxDownloads: true,
    },
  });

  if (!asset) {
    return { ok: false as const, error: "Ficheiro nao encontrado." };
  }

  if (asset.maxDownloads !== null) {
    const updated = await prisma.storeDigitalGrant.updateMany({
      where: { id: params.grantId, downloadsCount: { lt: asset.maxDownloads } },
      data: { downloadsCount: { increment: 1 } },
    });
    if (updated.count === 0) {
      return { ok: false as const, error: "Limite de downloads atingido." };
    }
  } else {
    await prisma.storeDigitalGrant.update({
      where: { id: params.grantId },
      data: { downloadsCount: { increment: 1 } },
    });
  }

  const bucket = env.uploadsBucket || "uploads";
  const signed = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(asset.storagePath, env.storageSignedTtlSeconds);

  if (signed.error || !signed.data?.signedUrl) {
    console.error("/api/store/digital/download signed url error", signed.error);
    return { ok: false as const, error: "Erro ao gerar download." };
  }

  return {
    ok: true as const,
    url: signed.data.signedUrl,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const tokenRaw = req.nextUrl.searchParams.get("token");
    const token = tokenRaw?.trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: "Token invalido." }, { status: 400 });
    }

    const assetParsed = parseAssetId(req.nextUrl.searchParams.get("assetId"));
    if (!assetParsed.ok) {
      return NextResponse.json({ ok: false, error: assetParsed.error }, { status: 400 });
    }

    const grant = await prisma.storeDigitalGrant.findUnique({
      where: { downloadToken: token },
      select: {
        id: true,
        expiresAt: true,
        downloadsCount: true,
        orderLine: { select: { productId: true } },
      },
    });

    if (!grant) {
      return NextResponse.json({ ok: false, error: "Download nao encontrado." }, { status: 404 });
    }

    if (grant.expiresAt && grant.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "Download expirado." }, { status: 410 });
    }

    const issued = await issueSignedUrl({
      grantId: grant.id,
      assetId: assetParsed.assetId,
      productId: grant.orderLine.productId,
    });

    if (!issued.ok) {
      const status =
        issued.error === "Ficheiro nao encontrado."
          ? 404
          : issued.error === "Limite de downloads atingido."
            ? 409
            : 400;
      return NextResponse.json({ ok: false, error: issued.error }, { status });
    }

    return NextResponse.json({ ok: true, ...issued });
  } catch (err) {
    console.error("GET /api/store/digital/download error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao gerar download." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const body = await req.json().catch(() => null);
    const parsed = downloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const grant = await prisma.storeDigitalGrant.findFirst({
      where: { id: parsed.data.grantId, userId: user.id },
      select: {
        id: true,
        expiresAt: true,
        orderLine: { select: { productId: true } },
      },
    });

    if (!grant) {
      return NextResponse.json({ ok: false, error: "Download nao encontrado." }, { status: 404 });
    }

    if (grant.expiresAt && grant.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "Download expirado." }, { status: 410 });
    }

    const issued = await issueSignedUrl({
      grantId: grant.id,
      assetId: parsed.data.assetId,
      productId: grant.orderLine.productId,
    });

    if (!issued.ok) {
      const status =
        issued.error === "Ficheiro nao encontrado."
          ? 404
          : issued.error === "Limite de downloads atingido."
            ? 409
            : 400;
      return NextResponse.json({ ok: false, error: issued.error }, { status });
    }

    return NextResponse.json({ ok: true, ...issued });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return NextResponse.json({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("POST /api/store/digital/download error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao gerar download." }, { status: 500 });
  }
}
