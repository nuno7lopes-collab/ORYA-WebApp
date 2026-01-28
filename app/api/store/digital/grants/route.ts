import { NextRequest, NextResponse } from "next/server";
import { jsonWrap } from "@/lib/api/wrapResponse";
import { prisma } from "@/lib/prisma";
import { createSupabaseServer } from "@/lib/supabaseServer";
import { ensureAuthenticated, isUnauthenticatedError } from "@/lib/security";
import { isStoreFeatureEnabled } from "@/lib/storeAccess";
import { StoreOrderStatus } from "@prisma/client";
import { withApiEnvelope } from "@/lib/http/withApiEnvelope";

type StoreLabel = {
  id: number;
  displayName: string;
  username: string | null;
};

function parseStoreId(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("storeId");
  if (!raw) return { ok: true as const, storeId: null };
  const storeId = Number(raw);
  if (!Number.isFinite(storeId)) {
    return { ok: false as const, error: "Store invalida." };
  }
  return { ok: true as const, storeId };
}

function buildStoreLabel(store: {
  id: number;
  organization: { username: string | null; publicName: string | null; businessName: string | null } | null;
  ownerUser: { username: string | null; fullName: string | null } | null;
}): StoreLabel {
  const org = store.organization;
  const owner = store.ownerUser;
  const displayName =
    org?.publicName ||
    org?.businessName ||
    org?.username ||
    owner?.fullName ||
    owner?.username ||
    `Loja ${store.id}`;
  const username = org?.username || owner?.username || null;
  return { id: store.id, displayName, username };
}

async function _GET(req: NextRequest) {
  try {
    if (!isStoreFeatureEnabled()) {
      return jsonWrap({ ok: false, error: "Loja desativada." }, { status: 403 });
    }

    const storeParsed = parseStoreId(req);
    if (!storeParsed.ok) {
      return jsonWrap({ ok: false, error: storeParsed.error }, { status: 400 });
    }

    const supabase = await createSupabaseServer();
    const user = await ensureAuthenticated(supabase);

    const grants = await prisma.storeDigitalGrant.findMany({
      where: {
        userId: user.id,
        orderLine: {
          order: {
            status: { in: [StoreOrderStatus.PAID, StoreOrderStatus.FULFILLED] },
            ...(storeParsed.storeId ? { storeId: storeParsed.storeId } : {}),
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
        downloadsCount: true,
        expiresAt: true,
        createdAt: true,
        orderLine: {
          select: {
            id: true,
            productId: true,
            nameSnapshot: true,
            product: { select: { id: true, name: true, slug: true } },
            order: {
              select: {
                id: true,
                orderNumber: true,
                createdAt: true,
                store: {
                  select: {
                    id: true,
                    organization: { select: { username: true, publicName: true, businessName: true } },
                    ownerUser: { select: { username: true, fullName: true } },
                  },
                },
              },
            },
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
      const storeLabel = buildStoreLabel(grant.orderLine.order.store);
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
        downloadsCount: grant.downloadsCount,
        expiresAt: grant.expiresAt ? grant.expiresAt.toISOString() : null,
        createdAt: grant.createdAt.toISOString(),
        order: {
          id: grant.orderLine.order.id,
          orderNumber: grant.orderLine.order.orderNumber,
          createdAt: grant.orderLine.order.createdAt.toISOString(),
        },
        store: storeLabel,
        product,
        assets,
      };
    });

    return jsonWrap({ ok: true, grants: items });
  } catch (err) {
    if (isUnauthenticatedError(err)) {
      return jsonWrap({ ok: false, error: "Nao autenticado." }, { status: 401 });
    }
    console.error("GET /api/store/digital/grants error:", err);
    return jsonWrap({ ok: false, error: "Erro ao carregar downloads." }, { status: 500 });
  }
}
export const GET = withApiEnvelope(_GET);