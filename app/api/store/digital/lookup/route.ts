import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreOrderStatus } from "@prisma/client";
import { z } from "zod";

const lookupSchema = z.object({
  email: z.string().email().trim(),
  orderNumber: z.string().trim().min(3).max(120),
});

function parseStoreId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("storeId");
  const storeId = raw ? Number(raw) : null;
  if (!storeId || !Number.isFinite(storeId)) {
    return { ok: false as const, error: "Store invalida." };
  }
  return { ok: true as const, storeId };
}

export async function POST(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return NextResponse.json({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const storeParsed = parseStoreId(req);
    if (!storeParsed.ok) {
      return NextResponse.json({ ok: false, error: storeParsed.error }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Dados invalidos." }, { status: 400 });
    }

    const payload = parsed.data;
    const order = await prisma.storeOrder.findFirst({
      where: {
        storeId: storeParsed.storeId,
        orderNumber: payload.orderNumber.trim(),
        customerEmail: { equals: payload.email.trim(), mode: "insensitive" },
        status: { in: [StoreOrderStatus.PAID, StoreOrderStatus.FULFILLED] },
      },
      select: { id: true, orderNumber: true, createdAt: true },
    });

    if (!order) {
      return NextResponse.json({ ok: false, error: "Encomenda nao encontrada." }, { status: 404 });
    }

    const grants = await prisma.storeDigitalGrant.findMany({
      where: {
        orderLine: { orderId: order.id },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        downloadToken: true,
        downloadsCount: true,
        expiresAt: true,
        createdAt: true,
        orderLine: {
          select: {
            id: true,
            productId: true,
            nameSnapshot: true,
            product: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    const productIds = Array.from(
      new Set(grants.map((grant) => grant.orderLine.productId).filter(Boolean)),
    ) as number[];

    const assets = productIds.length
      ? await prisma.storeDigitalAsset.findMany({
          where: { productId: { in: productIds }, isActive: true },
          orderBy: [{ createdAt: "asc" }],
          select: {
            id: true,
            productId: true,
            filename: true,
            sizeBytes: true,
            mimeType: true,
            maxDownloads: true,
            isActive: true,
            createdAt: true,
          },
        })
      : [];

    const assetsByProduct = new Map<number, typeof assets>();
    for (const asset of assets) {
      const list = assetsByProduct.get(asset.productId) ?? [];
      list.push(asset);
      assetsByProduct.set(asset.productId, list);
    }

    const items = grants.map((grant) => {
      const product = grant.orderLine.product ?? {
        id: grant.orderLine.productId ?? 0,
        name: grant.orderLine.nameSnapshot,
        slug: "",
      };
      const assets = grant.orderLine.productId
        ? assetsByProduct.get(grant.orderLine.productId) ?? []
        : [];
      return {
        id: grant.id,
        downloadToken: grant.downloadToken,
        downloadsCount: grant.downloadsCount,
        expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
        createdAt: grant.createdAt.toISOString(),
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          createdAt: order.createdAt.toISOString(),
        },
        product,
        assets,
      };
    });

    return NextResponse.json({ ok: true, grants: items });
  } catch (err) {
    console.error("POST /api/store/digital/lookup error:", err);
    return NextResponse.json({ ok: false, error: "Erro ao carregar downloads." }, { status: 500 });
  }
}
